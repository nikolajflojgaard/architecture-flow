import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { Pool } from 'pg';

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL;
const driveAccount = process.env.GOOGLE_DRIVE_ACCOUNT;
const workspaceRoot = path.resolve(process.cwd(), '..', '..');
const rendererRoot = path.resolve(workspaceRoot, '..', 'work-architecture-playbook');
const outputRoot = path.resolve(workspaceRoot, '.runtime', 'generated-pdfs');

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

if (!driveAccount) {
  console.error('GOOGLE_DRIVE_ACCOUNT is required');
  process.exit(1);
}

const workItemId = process.argv[2];

if (!workItemId) {
  console.error('Usage: tsx src/render-openapi-pdf.ts <workItemId>');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

void main();

async function main() {
  try {
    const workItem = await loadWorkItem(workItemId);

    if (!workItem) {
      throw new Error(`Work item ${workItemId} not found`);
    }

    if (!isYamlFile(workItem.title)) {
      throw new Error(`Work item ${workItemId} is not a YAML/OpenAPI source file`);
    }

    const tmpRoot = await mkdtemp(path.join(tmpdir(), 'architecture-flow-pdf-'));

    try {
      const inputPath = path.join(tmpRoot, sanitizeFilename(workItem.title));
      const outputDir = path.join(outputRoot, workItem.id);
      const outputPath = path.join(outputDir, buildPdfFilename(workItem.title));

      await mkdir(outputDir, { recursive: true });
      await downloadSourceYaml(workItem.sourceFileId, inputPath);
      await renderPdf(inputPath, outputPath, workItem);

      const pdfStat = await stat(outputPath);
      if (!pdfStat.size) {
        throw new Error('Generated PDF is empty');
      }

      const storagePath = path.relative(workspaceRoot, outputPath);
      const version = await getNextArtifactVersion(workItem.id, 'api_spec_pdf');
      await insertArtifact(workItem.id, storagePath, version);
      await insertAuditEvent(workItem.id, 'pdf.rendered', 'pdf-renderer', {
        outputPath: storagePath,
        version,
        sourceFileId: workItem.sourceFileId,
      });

      console.log(JSON.stringify({ ok: true, workItemId: workItem.id, outputPath: storagePath, version }));
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await insertAuditEvent(workItemId, 'pdf.render_failed', 'pdf-renderer', { message }).catch(() => undefined);
    console.error(message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function loadWorkItem(id: string) {
  const result = await pool.query<{
    id: string;
    title: string;
    sourceFileId: string;
    customer: string | null;
    domain: string | null;
  }>(
    `
      select id, title, source_file_id as "sourceFileId", customer, domain
      from work_items
      where id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function downloadSourceYaml(fileId: string, outPath: string) {
  if (fileId === 'seed-yaml-1') {
    await copyFile(path.resolve(rendererRoot, 'examples', 'sample-api.yaml'), outPath);
    return;
  }

  await execFileAsync('gog', [
    'drive',
    'download',
    fileId,
    '--account',
    driveAccount!,
    '--out',
    outPath,
    '--no-input',
  ]);
}

async function renderPdf(inputPath: string, outputPath: string, workItem: { title: string; customer: string | null; domain: string | null }) {
  const title = path.basename(workItem.title, path.extname(workItem.title));

  await execFileAsync(
    'node',
    [
      './scripts/spec-to-pdf.mjs',
      '--brand-name',
      'Architecture Flow',
      '--title',
      title,
      '--subtitle',
      'API Specification',
      '--system',
      workItem.customer ?? workItem.domain ?? 'Architecture Flow',
      inputPath,
      outputPath,
    ],
    { cwd: rendererRoot, env: process.env },
  );
}

async function getNextArtifactVersion(workItemId: string, artifactType: string) {
  const result = await pool.query<{ version: number }>(
    `
      select coalesce(max(version), 0) + 1 as version
      from artifacts
      where work_item_id = $1 and artifact_type = $2
    `,
    [workItemId, artifactType],
  );

  return Number(result.rows[0]?.version ?? 1);
}

async function insertArtifact(workItemId: string, outputPath: string, version: number) {
  await pool.query(
    `
      insert into artifacts (
        id, work_item_id, artifact_type, storage_backend, storage_path, version
      )
      values ($1,$2,$3,$4,$5,$6)
    `,
    [crypto.randomUUID(), workItemId, 'api_spec_pdf', 'local', outputPath, version],
  );
}

async function insertAuditEvent(workItemId: string, eventType: string, actor: string, payload: Record<string, unknown>) {
  await pool.query(
    `
      insert into audit_events (id, work_item_id, event_type, actor, payload_json)
      values ($1,$2,$3,$4,$5::jsonb)
    `,
    [crypto.randomUUID(), workItemId, eventType, actor, JSON.stringify(payload)],
  );
}

function isYamlFile(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith('.yaml') || lower.endsWith('.yml');
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function buildPdfFilename(sourceName: string) {
  const base = path.basename(sourceName, path.extname(sourceName));
  return `${sanitizeFilename(base)}-api-spec.pdf`;
}
