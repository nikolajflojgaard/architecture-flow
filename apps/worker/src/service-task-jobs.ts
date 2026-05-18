import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import { serviceTaskTopics, type ServiceTaskTopic } from '@architecture-flow/shared';

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL;
const driveAccount = process.env.GOOGLE_DRIVE_ACCOUNT;
const workspaceRoot = path.resolve(process.cwd(), '..', '..');
const rendererRoot = path.resolve(workspaceRoot, '..', 'work-architecture-playbook');
const outputRoot = path.resolve(workspaceRoot, '.runtime', 'generated-pdfs');

export async function runServiceTaskJob(topic: ServiceTaskTopic, workItemId: string) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    switch (topic) {
      case 'intake.classify':
        return await classifyIntake(pool, workItemId);
      case 'artifact.render-pdf':
        return await renderPdfArtifact(pool, workItemId);
      default:
        throw new Error(`Unsupported service task topic: ${topic}`);
    }
  } finally {
    await pool.end();
  }
}

export function isServiceTaskTopic(value: string): value is ServiceTaskTopic {
  return serviceTaskTopics.includes(value as ServiceTaskTopic);
}

async function classifyIntake(pool: Pool, workItemId: string) {
  const workItem = await loadWorkItem(pool, workItemId);
  if (!workItem) {
    throw new Error(`Work item ${workItemId} not found`);
  }

  const lowerTitle = workItem.title.toLowerCase();
  const isYaml = lowerTitle.endsWith('.yaml') || lowerTitle.endsWith('.yml');
  const inferred = {
    sourceType: isYaml && workItem.sourceFolder === 'API spec drop/YAML' ? 'yaml-drop' : workItem.sourceType,
    isApiRelated: isYaml || workItem.sourceFolder === 'API spec drop/YAML',
    suggestedPriority: isYaml ? 'high' : workItem.priority,
  };

  await pool.query(
    `
      update work_items
      set priority = $2,
          updated_at = now()
      where id = $1
    `,
    [workItemId, inferred.suggestedPriority],
  );

  await insertAuditEvent(pool, workItemId, 'intake.classified', 'worker-service-task', {
    sourceFolder: workItem.sourceFolder,
    inferred,
  });

  return {
    ok: true,
    topic: 'intake.classify',
    workItemId,
    inferred,
  };
}

async function renderPdfArtifact(pool: Pool, workItemId: string) {
  if (!driveAccount) {
    throw new Error('GOOGLE_DRIVE_ACCOUNT is required');
  }

  const workItem = await loadWorkItem(pool, workItemId);

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
    const version = await getNextArtifactVersion(pool, workItem.id, 'api_spec_pdf');
    await insertArtifact(pool, workItem.id, storagePath, version);
    await insertAuditEvent(pool, workItem.id, 'pdf.rendered', 'worker-service-task', {
      outputPath: storagePath,
      version,
      sourceFileId: workItem.sourceFileId,
      serviceTaskTopic: 'artifact.render-pdf',
    });

    return { ok: true, topic: 'artifact.render-pdf', workItemId: workItem.id, outputPath: storagePath, version };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await insertAuditEvent(pool, workItemId, 'pdf.render_failed', 'worker-service-task', { message }).catch(() => undefined);
    throw error;
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

async function loadWorkItem(pool: Pool, id: string) {
  const result = await pool.query<{
    id: string;
    title: string;
    sourceFileId: string;
    sourceType: string;
    sourceFolder: string;
    customer: string | null;
    domain: string | null;
    priority: string;
  }>(
    `
      select id,
             title,
             source_file_id as "sourceFileId",
             source_type as "sourceType",
             source_folder as "sourceFolder",
             customer,
             domain,
             priority
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
  await execFileAsync(
    'node',
    [
      './scripts/spec-to-pdf.mjs',
      '--logo-path',
      './assets/tdc-net-logo.png',
      '--brand-name',
      'TDC NET',
      inputPath,
      outputPath,
    ],
    { cwd: rendererRoot, env: process.env },
  );
}

async function getNextArtifactVersion(pool: Pool, workItemId: string, artifactType: string) {
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

async function insertArtifact(pool: Pool, workItemId: string, outputPath: string, version: number) {
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

async function insertAuditEvent(pool: Pool, workItemId: string, eventType: string, actor: string, payload: Record<string, unknown>) {
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
