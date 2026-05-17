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

console.log(`seeded ${items.length} work item(s)`);
await pool.end();
