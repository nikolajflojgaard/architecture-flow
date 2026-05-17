import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import { Pool } from 'pg';

const execFileAsync = promisify(execFile);

type IntakeSource = {
  id: string;
  sourceKey: string;
  displayName: string;
  driveRootName: string | null;
  driveFolderPath: string | null;
  driveFolderId: string | null;
};

type DriveEntry = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
};

const databaseUrl = process.env.DATABASE_URL;
const driveAccount = process.env.GOOGLE_DRIVE_ACCOUNT;

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

if (!driveAccount) {
  console.error('GOOGLE_DRIVE_ACCOUNT is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

void main();

async function main() {
  try {
    const sources = await loadIntakeSources();

    for (const source of sources) {
      const folderId = await resolveFolderId(source);
      if (!folderId) {
        console.warn(`skip ${source.sourceKey}: could not resolve folder`);
        continue;
      }

      if (source.driveFolderId !== folderId) {
        await pool.query('update intake_sources set drive_folder_id = $1, updated_at = now() where id = $2', [folderId, source.id]);
      }

      const files = await listFolderFiles(folderId);
      let discovered = 0;

      for (const file of files) {
        const result = await upsertWorkItem(source, file);
        if (result.discovered) {
          discovered += 1;
          await insertIntakeEvent(source.id, result.workItemId, file);
          await insertAuditEvent(result.workItemId, source, file);
        }
      }

      console.log(`${source.displayName}: scanned ${files.length}, discovered ${discovered}`);
    }
  } finally {
    await pool.end();
  }
}

async function loadIntakeSources(): Promise<IntakeSource[]> {
  const result = await pool.query<IntakeSource>(
    `
      select
        id,
        source_key as "sourceKey",
        display_name as "displayName",
        drive_root_name as "driveRootName",
        drive_folder_path as "driveFolderPath",
        drive_folder_id as "driveFolderId"
      from intake_sources
      where enabled = true
      order by display_name asc
    `,
  );

  return result.rows;
}

async function resolveFolderId(source: IntakeSource): Promise<string | null> {
  if (source.driveFolderId) {
    return source.driveFolderId;
  }

  if (!source.driveRootName || !source.driveFolderPath) {
    return null;
  }

  const rootMatches = await driveSearch(source.driveRootName, "mimeType='application/vnd.google-apps.folder'");
  const root = rootMatches.find((entry) => entry.name === source.driveRootName);
  if (!root) {
    return null;
  }

  const segments = source.driveFolderPath.split('/').filter(Boolean);
  let currentParentId = root.id;

  for (const segment of segments) {
    const children = await driveLs(currentParentId);
    const next = children.find((entry) => entry.mimeType === 'application/vnd.google-apps.folder' && entry.name === segment);
    if (!next) {
      return null;
    }
    currentParentId = next.id;
  }

  return currentParentId;
}

async function listFolderFiles(folderId: string): Promise<DriveEntry[]> {
  const entries = await driveLs(folderId);
  return entries.filter((entry) => entry.mimeType !== 'application/vnd.google-apps.folder');
}

async function upsertWorkItem(source: IntakeSource, file: DriveEntry): Promise<{ workItemId: string; discovered: boolean }> {
  const existing = await pool.query<{ id: string }>('select id from work_items where source_file_id = $1 limit 1', [file.id]);

  if (existing.rowCount) {
    const workItemId = existing.rows[0].id;
    await pool.query(
      `
        update work_items
        set
          title = $2,
          source_folder = $3,
          source_link = $4,
          updated_at = now()
        where id = $1
      `,
      [workItemId, file.name, source.displayName, file.webViewLink ?? null],
    );
    return { workItemId, discovered: false };
  }

  const workItemId = crypto.randomUUID();
  await pool.query(
    `
      insert into work_items (
        id, title, source_type, source_folder, source_file_id, source_link, workflow_status, priority
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [workItemId, file.name, 'drive-file', source.displayName, file.id, file.webViewLink ?? null, 'new', inferPriority(file.name)],
  );

  return { workItemId, discovered: true };
}

async function insertIntakeEvent(intakeSourceId: string, workItemId: string, file: DriveEntry) {
  await pool.query(
    `
      insert into intake_events (id, intake_source_id, work_item_id, source_file_id, event_type, payload_json)
      values ($1,$2,$3,$4,$5,$6::jsonb)
      on conflict (source_file_id, event_type) do nothing
    `,
    [
      crypto.randomUUID(),
      intakeSourceId,
      workItemId,
      file.id,
      'discovered',
      JSON.stringify({ name: file.name, mimeType: file.mimeType, modifiedTime: file.modifiedTime ?? null, webViewLink: file.webViewLink ?? null }),
    ],
  );
}

async function insertAuditEvent(workItemId: string, source: IntakeSource, file: DriveEntry) {
  await pool.query(
    `
      insert into audit_events (id, work_item_id, event_type, actor, payload_json)
      values ($1,$2,$3,$4,$5::jsonb)
    `,
    [
      crypto.randomUUID(),
      workItemId,
      'intake.discovered',
      'drive-sync',
      JSON.stringify({ sourceKey: source.sourceKey, displayName: source.displayName, fileId: file.id, fileName: file.name }),
    ],
  );
}

function inferPriority(name: string) {
  return name.toLowerCase().endsWith('.yaml') || name.toLowerCase().endsWith('.yml') ? 'high' : 'normal';
}

async function driveSearch(queryText: string, filter: string): Promise<DriveEntry[]> {
  const query = `${queryText} ${filter}`;
  const { stdout } = await execFileAsync('gog', [
    'drive',
    'search',
    query,
    '--account',
    driveAccount!,
    '--json',
    '--results-only',
    '--no-input',
  ]);

  return JSON.parse(stdout) as DriveEntry[];
}

async function driveLs(parentId: string): Promise<DriveEntry[]> {
  const { stdout } = await execFileAsync('gog', [
    'drive',
    'ls',
    '--parent',
    parentId,
    '--max',
    '200',
    '--account',
    driveAccount!,
    '--json',
    '--results-only',
    '--no-input',
  ]);

  return JSON.parse(stdout) as DriveEntry[];
}
