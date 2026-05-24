import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { Pool } from "pg";
import {
  inferIntakeMetadata,
  type IntakeMetadataInference,
} from "@architecture-flow/shared";

const execFileAsync = promisify(execFile);

export type IntakeSource = {
  id: string;
  sourceKey: string;
  displayName: string;
  driveRootName: string | null;
  driveFolderPath: string | null;
  driveFolderId: string | null;
};

export type DriveEntry = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
};

export type IntakeSyncSourceSummary = {
  sourceKey: string;
  displayName: string;
  scanned: number;
  discovered: number;
  enriched: number;
  skipped?: string;
};

export type IntakeSyncSummary = {
  ok: true;
  sources: IntakeSyncSourceSummary[];
  totals: {
    scanned: number;
    discovered: number;
    enriched: number;
  };
};

export async function runDriveIntakeSync(options?: {
  databaseUrl?: string;
  driveAccount?: string;
}): Promise<IntakeSyncSummary> {
  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL;
  const driveAccount =
    options?.driveAccount ?? process.env.GOOGLE_DRIVE_ACCOUNT;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!driveAccount) {
    throw new Error("GOOGLE_DRIVE_ACCOUNT is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const sources = await loadIntakeSources(pool);
    const summaries: IntakeSyncSourceSummary[] = [];

    for (const source of sources) {
      const folderId = await resolveFolderId(source, driveAccount);
      if (!folderId) {
        summaries.push({
          sourceKey: source.sourceKey,
          displayName: source.displayName,
          scanned: 0,
          discovered: 0,
          enriched: 0,
          skipped: "could not resolve folder",
        });
        continue;
      }

      if (source.driveFolderId !== folderId) {
        await pool.query(
          "update intake_sources set drive_folder_id = $1, updated_at = now() where id = $2",
          [folderId, source.id],
        );
      }

      const files = await listFolderFiles(folderId, driveAccount);
      let discovered = 0;
      let enriched = 0;

      for (const file of files) {
        const result = await upsertWorkItem(pool, source, file);
        if (result.discovered) {
          discovered += 1;
          await insertIntakeEvent(
            pool,
            source.id,
            result.workItemId,
            file,
            result.inferred,
          );
          await insertAuditEvent(
            pool,
            result.workItemId,
            source,
            file,
            result.inferred,
          );
        } else if (result.metadataChanged) {
          enriched += 1;
          await insertMetadataRefreshAuditEvent(
            pool,
            result.workItemId,
            source,
            file,
            result.inferred,
          );
        }
      }

      summaries.push({
        sourceKey: source.sourceKey,
        displayName: source.displayName,
        scanned: files.length,
        discovered,
        enriched,
      });
    }

    return {
      ok: true,
      sources: summaries,
      totals: summaries.reduce(
        (accumulator, source) => ({
          scanned: accumulator.scanned + source.scanned,
          discovered: accumulator.discovered + source.discovered,
          enriched: accumulator.enriched + source.enriched,
        }),
        { scanned: 0, discovered: 0, enriched: 0 },
      ),
    };
  } finally {
    await pool.end();
  }
}

async function loadIntakeSources(pool: Pool): Promise<IntakeSource[]> {
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

async function resolveFolderId(
  source: IntakeSource,
  driveAccount: string,
): Promise<string | null> {
  if (source.driveFolderId) {
    return source.driveFolderId;
  }

  if (!source.driveRootName || !source.driveFolderPath) {
    return null;
  }

  const rootMatches = await driveSearch(
    source.driveRootName,
    "mimeType='application/vnd.google-apps.folder'",
    driveAccount,
  );
  const root = rootMatches.find((entry) => entry.name === source.driveRootName);
  if (!root) {
    return null;
  }

  const segments = source.driveFolderPath.split("/").filter(Boolean);
  let currentParentId = root.id;

  for (const segment of segments) {
    const children = await driveLs(currentParentId, driveAccount);
    const next = children.find(
      (entry) =>
        entry.mimeType === "application/vnd.google-apps.folder" &&
        entry.name === segment,
    );
    if (!next) {
      return null;
    }
    currentParentId = next.id;
  }

  return currentParentId;
}

async function listFolderFiles(
  folderId: string,
  driveAccount: string,
): Promise<DriveEntry[]> {
  const entries = await driveLs(folderId, driveAccount);
  return entries.filter(
    (entry) => entry.mimeType !== "application/vnd.google-apps.folder",
  );
}

async function upsertWorkItem(
  pool: Pool,
  source: IntakeSource,
  file: DriveEntry,
): Promise<{
  workItemId: string;
  discovered: boolean;
  metadataChanged: boolean;
  inferred: IntakeMetadataInference;
}> {
  const existing = await pool.query<{
    id: string;
    customer: string | null;
    domain: string | null;
    priority: string;
    sourceType: string;
    title: string;
    sourceFolder: string;
    sourceLink: string | null;
  }>(
    `
      select
        id,
        customer,
        domain,
        priority,
        source_type as "sourceType",
        title,
        source_folder as "sourceFolder",
        source_link as "sourceLink"
      from work_items
      where source_file_id = $1
      limit 1
    `,
    [file.id],
  );

  const current = existing.rows[0] ?? null;
  const inferred = inferIntakeMetadata({
    sourceFolder: source.displayName,
    title: file.name,
    existingCustomer: current?.customer ?? null,
    existingDomain: current?.domain ?? null,
    existingPriority: current?.priority ?? null,
  });

  if (current) {
    const metadataChanged =
      current.title !== file.name ||
      current.sourceFolder !== source.displayName ||
      current.sourceLink !== (file.webViewLink ?? null) ||
      current.customer !== inferred.customer ||
      current.domain !== inferred.domain ||
      current.priority !== inferred.priority ||
      current.sourceType !== (inferred.sourceType ?? "drive-file");

    await pool.query(
      `
        update work_items
        set
          title = $2,
          source_folder = $3,
          source_link = $4,
          customer = $5,
          domain = $6,
          priority = $7,
          source_type = $8,
          updated_at = now()
        where id = $1
      `,
      [
        current.id,
        file.name,
        source.displayName,
        file.webViewLink ?? null,
        inferred.customer,
        inferred.domain,
        inferred.priority,
        inferred.sourceType ?? "drive-file",
      ],
    );

    return {
      workItemId: current.id,
      discovered: false,
      metadataChanged,
      inferred,
    };
  }

  const workItemId = crypto.randomUUID();
  await pool.query(
    `
      insert into work_items (
        id, title, source_type, source_folder, source_file_id, source_link, customer, domain, workflow_status, priority
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `,
    [
      workItemId,
      file.name,
      inferred.sourceType ?? "drive-file",
      source.displayName,
      file.id,
      file.webViewLink ?? null,
      inferred.customer,
      inferred.domain,
      "new",
      inferred.priority,
    ],
  );

  return { workItemId, discovered: true, metadataChanged: true, inferred };
}

async function insertIntakeEvent(
  pool: Pool,
  intakeSourceId: string,
  workItemId: string,
  file: DriveEntry,
  inferred: IntakeMetadataInference,
) {
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
      "discovered",
      JSON.stringify({
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime ?? null,
        webViewLink: file.webViewLink ?? null,
        inferred,
      }),
    ],
  );
}

async function insertAuditEvent(
  pool: Pool,
  workItemId: string,
  source: IntakeSource,
  file: DriveEntry,
  inferred: IntakeMetadataInference,
) {
  await pool.query(
    `
      insert into audit_events (id, work_item_id, event_type, actor, payload_json)
      values ($1,$2,$3,$4,$5::jsonb)
    `,
    [
      crypto.randomUUID(),
      workItemId,
      "intake.discovered",
      "drive-sync",
      JSON.stringify({
        sourceKey: source.sourceKey,
        displayName: source.displayName,
        fileId: file.id,
        fileName: file.name,
        inferred,
      }),
    ],
  );
}

async function insertMetadataRefreshAuditEvent(
  pool: Pool,
  workItemId: string,
  source: IntakeSource,
  file: DriveEntry,
  inferred: IntakeMetadataInference,
) {
  await pool.query(
    `
      insert into audit_events (id, work_item_id, event_type, actor, payload_json)
      values ($1,$2,$3,$4,$5::jsonb)
    `,
    [
      crypto.randomUUID(),
      workItemId,
      "intake.metadata_refreshed",
      "drive-sync",
      JSON.stringify({
        sourceKey: source.sourceKey,
        displayName: source.displayName,
        fileId: file.id,
        fileName: file.name,
        inferred,
      }),
    ],
  );
}

async function driveSearch(
  queryText: string,
  filter: string,
  driveAccount: string,
): Promise<DriveEntry[]> {
  const query = `${queryText} ${filter}`;
  const { stdout } = await execFileAsync("gog", [
    "drive",
    "search",
    query,
    "--account",
    driveAccount,
    "--json",
    "--results-only",
    "--no-input",
  ]);

  return JSON.parse(stdout) as DriveEntry[];
}

async function driveLs(
  parentId: string,
  driveAccount: string,
): Promise<DriveEntry[]> {
  const { stdout } = await execFileAsync("gog", [
    "drive",
    "ls",
    "--parent",
    parentId,
    "--max",
    "200",
    "--account",
    driveAccount,
    "--json",
    "--results-only",
    "--no-input",
  ]);

  return JSON.parse(stdout) as DriveEntry[];
}
