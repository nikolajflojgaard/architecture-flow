import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import crypto from "node:crypto";
import { Pool } from "pg";
import {
  inferIntakeMetadata,
  serviceTaskTopics,
  type ServiceTaskTopic,
} from "@architecture-flow/shared";

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL;
const driveAccount = process.env.GOOGLE_DRIVE_ACCOUNT;
const workspaceRoot = path.resolve(process.cwd(), "..", "..");
const rendererRoot = path.resolve(
  workspaceRoot,
  "..",
  "work-architecture-playbook",
);
const outputRoot = path.resolve(workspaceRoot, ".runtime", "generated-pdfs");
const workflowProcessDefinitionKey = "architecture-flow-v1";

export async function runServiceTaskJob(
  topic: ServiceTaskTopic,
  workItemId: string,
) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const workflowRunId = await ensureWorkflowRun(pool, workItemId);
  const taskId = await startServiceTask(pool, workItemId, workflowRunId, topic);

  try {
    let result: Record<string, unknown>;

    switch (topic) {
      case "intake.classify":
        result = await classifyIntake(pool, workItemId);
        break;
      case "artifact.render-pdf":
        result = await renderPdfArtifact(pool, workItemId);
        break;
      default:
        throw new Error(`Unsupported service task topic: ${topic}`);
    }

    await completeServiceTask(
      pool,
      taskId,
      workItemId,
      workflowRunId,
      topic,
      result,
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failServiceTask(
      pool,
      taskId,
      workItemId,
      workflowRunId,
      topic,
      message,
    ).catch(() => undefined);
    throw error;
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

  const inferred = inferIntakeMetadata({
    sourceFolder: workItem.sourceFolder,
    title: workItem.title,
    existingCustomer: workItem.customer,
    existingDomain: workItem.domain,
    existingPriority: workItem.priority,
  });

  await pool.query(
    `
      update work_items
      set source_type = $2,
          customer = $3,
          domain = $4,
          priority = $5,
          updated_at = now()
      where id = $1
    `,
    [
      workItemId,
      inferred.sourceType ?? workItem.sourceType,
      inferred.customer,
      inferred.domain,
      inferred.priority,
    ],
  );

  await insertAuditEvent(
    pool,
    workItemId,
    "intake.classified",
    "worker-service-task",
    {
      sourceFolder: workItem.sourceFolder,
      inferred,
    },
  );

  return {
    ok: true,
    topic: "intake.classify",
    workItemId,
    inferred,
  };
}

async function renderPdfArtifact(pool: Pool, workItemId: string) {
  if (!driveAccount) {
    throw new Error("GOOGLE_DRIVE_ACCOUNT is required");
  }

  const workItem = await loadWorkItem(pool, workItemId);

  if (!workItem) {
    throw new Error(`Work item ${workItemId} not found`);
  }

  if (!isYamlFile(workItem.title)) {
    throw new Error(
      `Work item ${workItemId} is not a YAML/OpenAPI source file`,
    );
  }

  const tmpRoot = await mkdtemp(path.join(tmpdir(), "architecture-flow-pdf-"));

  try {
    const inputPath = path.join(tmpRoot, sanitizeFilename(workItem.title));
    const outputDir = path.join(outputRoot, workItem.id);
    const outputPath = path.join(outputDir, buildPdfFilename(workItem.title));

    await mkdir(outputDir, { recursive: true });
    await downloadSourceYaml(workItem.sourceFileId, inputPath);
    await renderPdf(inputPath, outputPath);

    const pdfStat = await stat(outputPath);
    if (!pdfStat.size) {
      throw new Error("Generated PDF is empty");
    }

    const storagePath = path.relative(workspaceRoot, outputPath);
    const version = await getNextArtifactVersion(
      pool,
      workItem.id,
      "api_spec_pdf",
    );
    await insertArtifact(pool, workItem.id, storagePath, version);
    await insertAuditEvent(
      pool,
      workItem.id,
      "pdf.rendered",
      "worker-service-task",
      {
        outputPath: storagePath,
        version,
        sourceFileId: workItem.sourceFileId,
        serviceTaskTopic: "artifact.render-pdf",
      },
    );

    return {
      ok: true,
      topic: "artifact.render-pdf",
      workItemId: workItem.id,
      outputPath: storagePath,
      version,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await insertAuditEvent(
      pool,
      workItemId,
      "pdf.render_failed",
      "worker-service-task",
      { message },
    ).catch(() => undefined);
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
    workflowStatus: string;
  }>(
    `
      select id,
             title,
             source_file_id as "sourceFileId",
             source_type as "sourceType",
             source_folder as "sourceFolder",
             customer,
             domain,
             priority,
             workflow_status as "workflowStatus"
      from work_items
      where id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

async function ensureWorkflowRun(pool: Pool, workItemId: string) {
  const workItem = await loadWorkItem(pool, workItemId);
  if (!workItem) {
    throw new Error(`Work item ${workItemId} not found`);
  }

  const existing = await pool.query<{ id: string }>(
    `
      select id
      from workflow_runs
      where work_item_id = $1 and ended_at is null
      order by started_at desc
      limit 1
    `,
    [workItemId],
  );

  const target = getWorkflowRunTarget(workItem.workflowStatus);
  const payload = JSON.stringify({
    workflowStatus: workItem.workflowStatus,
    stepKey: target.stepKey,
    stepType: target.stepType,
  });

  if (existing.rowCount) {
    await pool.query(
      `
        update workflow_runs
        set status = $2,
            current_step_key = $3,
            current_step_type = $4,
            payload_json = coalesce(payload_json, '{}'::jsonb) || $5::jsonb,
            updated_at = now(),
            ended_at = case when $2 = 'completed' then coalesce(ended_at, now()) else null end
        where id = $1
      `,
      [
        existing.rows[0].id,
        target.runStatus,
        target.stepKey,
        target.stepType,
        payload,
      ],
    );

    return existing.rows[0].id;
  }

  const workflowRunId = crypto.randomUUID();
  await pool.query(
    `
      insert into workflow_runs (
        id,
        work_item_id,
        process_definition_key,
        status,
        current_step_key,
        current_step_type,
        payload_json,
        started_at,
        updated_at,
        ended_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        now(),
        now(),
        $8
      )
    `,
    [
      workflowRunId,
      workItemId,
      workflowProcessDefinitionKey,
      target.runStatus,
      target.stepKey,
      target.stepType,
      payload,
      target.runStatus === "completed" ? new Date().toISOString() : null,
    ],
  );

  return workflowRunId;
}

async function startServiceTask(
  pool: Pool,
  workItemId: string,
  workflowRunId: string,
  topic: ServiceTaskTopic,
) {
  const taskId = crypto.randomUUID();
  await pool.query(
    `
      insert into tasks (
        id,
        work_item_id,
        workflow_run_id,
        task_type,
        title,
        assigned_to,
        status,
        payload_json,
        external_ref,
        created_at,
        updated_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'open',
        $7::jsonb,
        $8,
        now(),
        now()
      )
    `,
    [
      taskId,
      workItemId,
      workflowRunId,
      `service:${topic}`,
      getServiceTaskTitle(topic),
      "worker-service-task",
      JSON.stringify({
        serviceTaskTopic: topic,
        startedAt: new Date().toISOString(),
      }),
      topic,
    ],
  );

  await insertAuditEvent(
    pool,
    workItemId,
    "task.started",
    "worker-service-task",
    {
      taskId,
      taskType: `service:${topic}`,
      workflowRunId,
    },
  );

  return taskId;
}

async function completeServiceTask(
  pool: Pool,
  taskId: string,
  workItemId: string,
  workflowRunId: string,
  topic: ServiceTaskTopic,
  result: Record<string, unknown>,
) {
  await pool.query(
    `
      update tasks
      set status = 'completed',
          completed_at = now(),
          updated_at = now(),
          payload_json = coalesce(payload_json, '{}'::jsonb) || $2::jsonb
      where id = $1
    `,
    [taskId, JSON.stringify({ result, completedAt: new Date().toISOString() })],
  );

  await pool.query(
    `
      update workflow_runs
      set payload_json = coalesce(payload_json, '{}'::jsonb) || $2::jsonb,
          updated_at = now()
      where id = $1
    `,
    [
      workflowRunId,
      JSON.stringify({
        lastServiceTaskTopic: topic,
        lastServiceTaskResult: result,
      }),
    ],
  );

  await insertAuditEvent(
    pool,
    workItemId,
    "task.completed",
    "worker-service-task",
    {
      taskId,
      taskType: `service:${topic}`,
      workflowRunId,
      topic,
    },
  );
}

async function failServiceTask(
  pool: Pool,
  taskId: string,
  workItemId: string,
  workflowRunId: string,
  topic: ServiceTaskTopic,
  message: string,
) {
  await pool.query(
    `
      update tasks
      set status = 'failed',
          completed_at = now(),
          updated_at = now(),
          payload_json = coalesce(payload_json, '{}'::jsonb) || $2::jsonb
      where id = $1
    `,
    [
      taskId,
      JSON.stringify({ error: message, failedAt: new Date().toISOString() }),
    ],
  );

  await pool.query(
    `
      update workflow_runs
      set current_step_key = $2,
          current_step_type = 'user',
          payload_json = coalesce(payload_json, '{}'::jsonb) || $3::jsonb,
          updated_at = now()
      where id = $1
    `,
    [
      workflowRunId,
      getWorkflowRunTarget("new").stepKey,
      JSON.stringify({
        lastFailedServiceTaskTopic: topic,
        lastFailedServiceTaskMessage: message,
      }),
    ],
  );

  await insertAuditEvent(
    pool,
    workItemId,
    "task.failed",
    "worker-service-task",
    {
      taskId,
      taskType: `service:${topic}`,
      workflowRunId,
      topic,
      message,
    },
  );
}

async function downloadSourceYaml(fileId: string, outPath: string) {
  if (fileId === "seed-yaml-1") {
    await copyFile(
      path.resolve(rendererRoot, "examples", "sample-api.yaml"),
      outPath,
    );
    return;
  }

  await execFileAsync("gog", [
    "drive",
    "download",
    fileId,
    "--account",
    driveAccount!,
    "--out",
    outPath,
    "--no-input",
  ]);
}

async function renderPdf(inputPath: string, outputPath: string) {
  await execFileAsync(
    "node",
    [
      "./scripts/spec-to-pdf.mjs",
      "--logo-path",
      "./assets/tdc-net-logo.png",
      "--brand-name",
      "TDC NET",
      inputPath,
      outputPath,
    ],
    { cwd: rendererRoot, env: process.env },
  );
}

async function getNextArtifactVersion(
  pool: Pool,
  workItemId: string,
  artifactType: string,
) {
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

async function insertArtifact(
  pool: Pool,
  workItemId: string,
  outputPath: string,
  version: number,
) {
  await pool.query(
    `
      insert into artifacts (
        id, work_item_id, artifact_type, storage_backend, storage_path, version
      )
      values ($1,$2,$3,$4,$5,$6)
    `,
    [
      crypto.randomUUID(),
      workItemId,
      "api_spec_pdf",
      "local",
      outputPath,
      version,
    ],
  );
}

async function insertAuditEvent(
  pool: Pool,
  workItemId: string,
  eventType: string,
  actor: string,
  payload: Record<string, unknown>,
) {
  await pool.query(
    `
      insert into audit_events (id, work_item_id, event_type, actor, payload_json)
      values ($1,$2,$3,$4,$5::jsonb)
    `,
    [
      crypto.randomUUID(),
      workItemId,
      eventType,
      actor,
      JSON.stringify(payload),
    ],
  );
}

function isYamlFile(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".yaml") || lower.endsWith(".yml");
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function buildPdfFilename(sourceName: string) {
  const base = path.basename(sourceName, path.extname(sourceName));
  return `${sanitizeFilename(base)}-api-spec.pdf`;
}

function getServiceTaskTitle(topic: ServiceTaskTopic) {
  switch (topic) {
    case "intake.classify":
      return "Classify intake";
    case "artifact.render-pdf":
      return "Generate or refresh PDF";
    default:
      return topic;
  }
}

function getWorkflowRunTarget(status: string): {
  runStatus: "running" | "completed";
  stepKey: string;
  stepType: "user" | "gateway" | "end";
} {
  switch (status) {
    case "new":
      return {
        runStatus: "running",
        stepKey: "UserTask_Triage",
        stepType: "user",
      };
    case "triaged":
      return {
        runStatus: "running",
        stepKey: "UserTask_WorkInProgress",
        stepType: "user",
      };
    case "in_progress":
      return {
        runStatus: "running",
        stepKey: "UserTask_Review",
        stepType: "user",
      };
    case "review":
      return {
        runStatus: "running",
        stepKey: "Gateway_ReviewApproved",
        stepType: "gateway",
      };
    case "done":
      return {
        runStatus: "completed",
        stepKey: "EndEvent_Done",
        stepType: "end",
      };
    default:
      return {
        runStatus: "running",
        stepKey: "UserTask_Triage",
        stepType: "user",
      };
  }
}
