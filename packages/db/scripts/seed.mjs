import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const items = [
  {
    title: 'BPI - FAS MyView integration',
    sourceType: 'drive-file',
    sourceFolder: 'General designs',
    sourceFileId: 'seed-general-design-1',
    sourceLink: 'https://drive.google.com/file/d/seed-general-design-1/view',
    customer: 'TDC NET',
    domain: 'Customer platform',
    workflowStatus: 'new',
    priority: 'normal',
  },
  {
    title: 'customer-address-api.yaml',
    sourceType: 'drive-file',
    sourceFolder: 'API spec drop/YAML',
    sourceFileId: 'seed-yaml-1',
    sourceLink: 'https://drive.google.com/file/d/seed-yaml-1/view',
    customer: 'TDC NET',
    domain: 'Customer platform',
    workflowStatus: 'triaged',
    priority: 'high',
  },
];

const intakeSources = [
  {
    sourceKey: 'general-designs',
    sourceType: 'google-drive-folder',
    displayName: 'General designs',
    driveRootName: 'Data - NET',
    driveFolderPath: 'General designs',
    driveFolderId: '1jfj6EqzSsUsyA2_cz6ui2PeObZaTyanD',
  },
  {
    sourceKey: 'api-spec-drop-yaml',
    sourceType: 'google-drive-folder',
    displayName: 'API spec drop/YAML',
    driveRootName: 'Data - NET',
    driveFolderPath: 'API spec drop/YAML',
    driveFolderId: '1iByXnVBDwuXwV34vdXD387oM2-zezN-K',
  },
];

for (const source of intakeSources) {
  await pool.query(
    `
      insert into intake_sources (
        id, source_key, source_type, display_name, drive_root_name, drive_folder_path, drive_folder_id
      )
      values ($1,$2,$3,$4,$5,$6,$7)
      on conflict (source_key)
      do update set
        source_type = excluded.source_type,
        display_name = excluded.display_name,
        drive_root_name = excluded.drive_root_name,
        drive_folder_path = excluded.drive_folder_path,
        drive_folder_id = excluded.drive_folder_id,
        updated_at = now()
    `,
    [
      crypto.randomUUID(),
      source.sourceKey,
      source.sourceType,
      source.displayName,
      source.driveRootName,
      source.driveFolderPath,
      source.driveFolderId,
    ],
  );
}

for (const item of items) {
  await pool.query(
    `
      insert into work_items (
        id, title, source_type, source_folder, source_file_id, source_link,
        customer, domain, workflow_status, priority
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      on conflict (source_file_id) do nothing
    `,
    [
      crypto.randomUUID(),
      item.title,
      item.sourceType,
      item.sourceFolder,
      item.sourceFileId,
      item.sourceLink,
      item.customer,
      item.domain,
      item.workflowStatus,
      item.priority,
    ],
  );
}

console.log(`seeded ${items.length} work item(s) and ${intakeSources.length} intake source(s)`);
await pool.end();
