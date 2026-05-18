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
    key: 'seed-general-design-1',
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
    key: 'seed-yaml-1',
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

const artifactsBySourceFileId = {
  'seed-general-design-1': [
    {
      artifactType: 'kiss_draft',
      storageBackend: 'drive',
      storagePath: 'KISS General designs/BPI - FAS MyView integration.md',
      driveFileId: 'seed-kiss-1',
      version: 1,
    },
  ],
  'seed-yaml-1': [
    {
      artifactType: 'openapi_yaml',
      storageBackend: 'drive',
      storagePath: 'API spec drop/YAML/customer-address-api.yaml',
      driveFileId: 'seed-openapi-1',
      version: 1,
    },
    {
      artifactType: 'api_spec_pdf',
      storageBackend: 'local',
      storagePath: '.runtime/generated-pdfs/seed-yaml-1/customer-address-api-api-spec.pdf',
      driveFileId: null,
      version: 1,
    },
  ],
};

const tasksBySourceFileId = {
  'seed-general-design-1': [
    {
      taskType: 'triage',
      status: 'open',
      payload: { title: 'Triage work item', expectedNextStatus: 'triaged' },
    },
  ],
  'seed-yaml-1': [
    {
      taskType: 'produce_artifacts',
      status: 'open',
      payload: { title: 'Produce working artifacts', expectedNextStatus: 'in_progress' },
    },
  ],
};

const auditEventsBySourceFileId = {
  'seed-general-design-1': [
    {
      eventType: 'intake_discovered',
      actor: 'system',
      payload: { source: 'General designs' },
    },
  ],
  'seed-yaml-1': [
    {
      eventType: 'intake_discovered',
      actor: 'system',
      payload: { source: 'API spec drop/YAML' },
    },
    {
      eventType: 'pdf.rendered',
      actor: 'pdf-renderer',
      payload: { artifactType: 'api_spec_pdf', version: 1 },
    },
  ],
};

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

const workItemIdsBySourceFileId = new Map();

for (const item of items) {
  const existing = await pool.query(
    `select id from work_items where source_file_id = $1 limit 1`,
    [item.sourceFileId],
  );

  const workItemId = existing.rows[0]?.id ?? crypto.randomUUID();
  workItemIdsBySourceFileId.set(item.sourceFileId, workItemId);

  await pool.query(
    `
      insert into work_items (
        id, title, source_type, source_folder, source_file_id, source_link,
        customer, domain, workflow_status, priority
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      on conflict (source_file_id)
      do update set
        title = excluded.title,
        source_type = excluded.source_type,
        source_folder = excluded.source_folder,
        source_link = excluded.source_link,
        customer = excluded.customer,
        domain = excluded.domain,
        workflow_status = excluded.workflow_status,
        priority = excluded.priority,
        updated_at = now()
    `,
    [
      workItemId,
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

for (const [sourceFileId, artifacts] of Object.entries(artifactsBySourceFileId)) {
  const workItemId = workItemIdsBySourceFileId.get(sourceFileId);

  if (!workItemId) continue;

  for (const artifact of artifacts) {
    const existing = await pool.query(
      `
        select id
        from artifacts
        where work_item_id = $1
          and artifact_type = $2
          and storage_backend = $3
          and storage_path is not distinct from $4
          and drive_file_id is not distinct from $5
          and version = $6
        limit 1
      `,
      [
        workItemId,
        artifact.artifactType,
        artifact.storageBackend,
        artifact.storagePath,
        artifact.driveFileId,
        artifact.version,
      ],
    );

    if (existing.rowCount) continue;

    await pool.query(
      `
        insert into artifacts (
          id, work_item_id, artifact_type, storage_backend, storage_path, drive_file_id, version
        )
        values ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        crypto.randomUUID(),
        workItemId,
        artifact.artifactType,
        artifact.storageBackend,
        artifact.storagePath,
        artifact.driveFileId,
        artifact.version,
      ],
    );
  }
}

for (const [sourceFileId, tasks] of Object.entries(tasksBySourceFileId)) {
  const workItemId = workItemIdsBySourceFileId.get(sourceFileId);

  if (!workItemId) continue;

  for (const task of tasks) {
    const existing = await pool.query(
      `
        select id
        from tasks
        where work_item_id = $1 and task_type = $2 and status = $3 and payload_json = $4::jsonb
        limit 1
      `,
      [workItemId, task.taskType, task.status, JSON.stringify(task.payload)],
    );

    if (existing.rowCount) continue;

    await pool.query(
      `
        insert into tasks (id, work_item_id, task_type, status, payload_json)
        values ($1,$2,$3,$4,$5::jsonb)
      `,
      [crypto.randomUUID(), workItemId, task.taskType, task.status, JSON.stringify(task.payload)],
    );
  }
}

for (const [sourceFileId, events] of Object.entries(auditEventsBySourceFileId)) {
  const workItemId = workItemIdsBySourceFileId.get(sourceFileId);

  if (!workItemId) continue;

  for (const event of events) {
    const existing = await pool.query(
      `
        select id
        from audit_events
        where work_item_id = $1 and event_type = $2 and actor is not distinct from $3 and payload_json = $4::jsonb
        limit 1
      `,
      [workItemId, event.eventType, event.actor, JSON.stringify(event.payload)],
    );

    if (existing.rowCount) continue;

    await pool.query(
      `
        insert into audit_events (id, work_item_id, event_type, actor, payload_json)
        values ($1,$2,$3,$4,$5::jsonb)
      `,
      [crypto.randomUUID(), workItemId, event.eventType, event.actor, JSON.stringify(event.payload)],
    );
  }
}

console.log(`seeded ${items.length} work item(s), artifact fixtures, and ${intakeSources.length} intake source(s)`);
await pool.end();
