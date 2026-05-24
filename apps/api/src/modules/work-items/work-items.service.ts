import crypto from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../../services/database.service";

export const workflowStatuses = [
  "new",
  "triaged",
  "in_progress",
  "review",
  "done",
] as const;
export type WorkflowStatus = (typeof workflowStatuses)[number];
export const taskStatuses = [
  "open",
  "completed",
  "cancelled",
  "failed",
] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export const userTaskTypes = [
  "triage",
  "produce_artifacts",
  "review_and_approve",
] as const;
export type UserTaskType = (typeof userTaskTypes)[number];

type WorkflowTaskDefinition = {
  taskType: UserTaskType;
  title: string;
  nextStatus: WorkflowStatus;
  stepKey: string;
};

type WorkflowRunStatus = "running" | "completed";
type WorkflowStepType = "user" | "gateway" | "end";

type WorkflowRunRow = {
  id: string;
  status: WorkflowRunStatus;
  currentStepKey: string | null;
  currentStepType: WorkflowStepType | null;
};

const workflowProcessDefinitionKey = "architecture-flow-v1";

const workflowTaskByStatus: Record<
  Exclude<WorkflowStatus, "done">,
  WorkflowTaskDefinition
> = {
  new: {
    taskType: "triage",
    title: "Triage work item",
    nextStatus: "triaged",
    stepKey: "UserTask_Triage",
  },
  triaged: {
    taskType: "produce_artifacts",
    title: "Produce working artifacts",
    nextStatus: "in_progress",
    stepKey: "UserTask_WorkInProgress",
  },
  in_progress: {
    taskType: "review_and_approve",
    title: "Review and approve",
    nextStatus: "review",
    stepKey: "UserTask_Review",
  },
  review: {
    taskType: "review_and_approve",
    title: "Approve review outcome",
    nextStatus: "done",
    stepKey: "Gateway_ReviewApproved",
  },
};

type ListWorkItemsOptions = {
  status?: string;
  limit: number;
};

type WorkItemRow = {
  id: string;
  title: string;
  status: WorkflowStatus;
};

@Injectable()
export class WorkItemsService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async listWorkItems(options: ListWorkItemsOptions) {
    const limit = Math.min(Math.max(options.limit, 1), 100);
    const values: Array<string | number> = [];
    const where: string[] = [];

    if (options.status) {
      values.push(options.status);
      where.push(`workflow_status = $${values.length}`);
    }

    values.push(limit);
    const limitPlaceholder = `$${values.length}`;

    const sql = `
      select
        work_items.id,
        work_items.title,
        work_items.source_type as "sourceType",
        work_items.source_folder as "sourceFolder",
        work_items.source_file_id as "sourceFileId",
        work_items.source_link as "sourceLink",
        work_items.customer,
        work_items.domain,
        work_items.workflow_status as status,
        work_items.priority,
        work_items.assigned_to as "assignedTo",
        work_items.created_at as "createdAt",
        work_items.updated_at as "updatedAt",
        workflow_run.id as "activeWorkflowRunId",
        workflow_run.status as "activeWorkflowRunStatus",
        workflow_run.current_step_key as "activeWorkflowStepKey",
        workflow_run.current_step_type as "activeWorkflowStepType",
        workflow_run.process_instance_id as "processInstanceId"
      from work_items
      left join lateral (
        select
          id,
          status,
          current_step_key,
          current_step_type,
          process_instance_id
        from workflow_runs
        where workflow_runs.work_item_id = work_items.id
          and workflow_runs.ended_at is null
        order by workflow_runs.started_at desc
        limit 1
      ) workflow_run on true
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by work_items.created_at desc
      limit ${limitPlaceholder}
    `;

    const result = await this.databaseService.query(sql, values);
    return {
      items: result.rows,
      count: result.rowCount,
    };
  }

  async getWorkItem(id: string) {
    await this.ensureWorkflowState(id, "system");

    const result = await this.databaseService.query(
      `
        select
          work_items.id,
          work_items.title,
          work_items.source_type as "sourceType",
          work_items.source_folder as "sourceFolder",
          work_items.source_file_id as "sourceFileId",
          work_items.source_link as "sourceLink",
          work_items.customer,
          work_items.domain,
          work_items.workflow_status as status,
          work_items.priority,
          work_items.assigned_to as "assignedTo",
          work_items.created_at as "createdAt",
          work_items.updated_at as "updatedAt",
          workflow_run.id as "activeWorkflowRunId",
          workflow_run.status as "activeWorkflowRunStatus",
          workflow_run.current_step_key as "activeWorkflowStepKey",
          workflow_run.current_step_type as "activeWorkflowStepType",
          workflow_run.process_instance_id as "processInstanceId"
        from work_items
        left join lateral (
          select
            id,
            status,
            current_step_key,
            current_step_type,
            process_instance_id
          from workflow_runs
          where workflow_runs.work_item_id = work_items.id
            and workflow_runs.ended_at is null
          order by workflow_runs.started_at desc
          limit 1
        ) workflow_run on true
        where work_items.id = $1
        limit 1
      `,
      [id],
    );

    return {
      item: result.rows[0] ?? null,
    };
  }

  async listTasks(workItemId: string) {
    await this.ensureWorkflowState(workItemId, "system");

    const result = await this.databaseService.query(
      `
        select
          id,
          work_item_id as "workItemId",
          workflow_run_id as "workflowRunId",
          task_type as "taskType",
          title,
          assigned_to as "assignedTo",
          status,
          payload_json as payload,
          due_at as "dueAt",
          external_ref as "externalRef",
          completed_at as "completedAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        from tasks
        where work_item_id = $1
        order by created_at desc
      `,
      [workItemId],
    );

    return {
      items: result.rows,
      count: result.rowCount,
    };
  }

  async listAuditEvents(workItemId: string) {
    const result = await this.databaseService.query(
      `
        select
          id,
          event_type as "eventType",
          actor,
          payload_json as payload,
          created_at as "createdAt"
        from audit_events
        where work_item_id = $1
        order by created_at desc
      `,
      [workItemId],
    );

    return {
      items: result.rows,
      count: result.rowCount,
    };
  }

  async updateWorkflowStatus(id: string, nextStatus: string, actor: string) {
    if (!workflowStatuses.includes(nextStatus as WorkflowStatus)) {
      throw new BadRequestException(
        `Unsupported workflow status: ${nextStatus}`,
      );
    }

    const current = await this.requireWorkItemRow(id);
    if (current.status === nextStatus) {
      return {
        item: (await this.getWorkItem(id)).item,
        changed: false,
      };
    }

    await this.databaseService.query("begin");

    try {
      await this.databaseService.query(
        `
          update work_items
          set workflow_status = $2,
              updated_at = now()
          where id = $1
        `,
        [id, nextStatus],
      );

      await this.insertAuditEvent(id, "workflow_status_changed", actor, {
        from: current.status,
        to: nextStatus,
        title: current.title,
        source: "manual-status-update",
      });

      const run = await this.ensureWorkflowRunForStatus(
        id,
        nextStatus as WorkflowStatus,
      );
      await this.syncTasksForStatus(
        id,
        run.id,
        nextStatus as WorkflowStatus,
        actor,
      );

      await this.databaseService.query("commit");
    } catch (error) {
      await this.databaseService.query("rollback");
      throw error;
    }

    return {
      item: (await this.getWorkItem(id)).item,
      changed: true,
    };
  }

  async completeTask(workItemId: string, taskId: string, actor: string) {
    const taskResult = await this.databaseService.query<{
      id: string;
      workItemId: string;
      workflowRunId: string | null;
      taskType: UserTaskType;
      status: TaskStatus;
    }>(
      `
        select
          id,
          work_item_id as "workItemId",
          workflow_run_id as "workflowRunId",
          task_type as "taskType",
          status
        from tasks
        where id = $1 and work_item_id = $2
        limit 1
      `,
      [taskId, workItemId],
    );

    const task = taskResult.rows[0];
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    if (task.status !== "open") {
      throw new BadRequestException("Only open tasks can be completed");
    }

    const workItem = await this.requireWorkItemRow(workItemId);
    const definition = this.getTaskDefinitionForStatus(workItem.status);

    if (!definition || definition.taskType !== task.taskType) {
      throw new BadRequestException(
        "Task does not match the current workflow state",
      );
    }

    await this.databaseService.query("begin");

    try {
      const run = await this.ensureWorkflowRunForStatus(
        workItemId,
        workItem.status,
      );

      await this.databaseService.query(
        `
          update tasks
          set workflow_run_id = $2,
              status = 'completed',
              title = coalesce(title, $3),
              completed_at = now(),
              updated_at = now(),
              payload_json = coalesce(payload_json, '{}'::jsonb)
                || jsonb_build_object('completedBy', $4, 'completedAt', now())
          where id = $1
        `,
        [taskId, run.id, definition.title, actor],
      );

      await this.insertAuditEvent(workItemId, "task.completed", actor, {
        taskId,
        taskType: task.taskType,
        fromStatus: workItem.status,
        toStatus: definition.nextStatus,
        workflowRunId: run.id,
      });

      await this.databaseService.query(
        `
          update work_items
          set workflow_status = $2,
              updated_at = now()
          where id = $1
        `,
        [workItemId, definition.nextStatus],
      );

      await this.insertAuditEvent(
        workItemId,
        "workflow_status_changed",
        actor,
        {
          from: workItem.status,
          to: definition.nextStatus,
          taskId,
          taskType: task.taskType,
          workflowRunId: run.id,
        },
      );

      await this.syncTasksForStatus(
        workItemId,
        run.id,
        definition.nextStatus,
        actor,
      );

      await this.databaseService.query("commit");
    } catch (error) {
      await this.databaseService.query("rollback");
      throw error;
    }

    return {
      item: (await this.getWorkItem(workItemId)).item,
      tasks: (await this.listTasks(workItemId)).items,
    };
  }

  private async ensureWorkflowState(workItemId: string, actor: string) {
    const workItem = await this.requireWorkItemRow(workItemId);
    const run = await this.ensureWorkflowRunForStatus(
      workItemId,
      workItem.status,
    );
    await this.syncTasksForStatus(workItemId, run.id, workItem.status, actor);
    return { workItem, run };
  }

  private async ensureWorkflowRunForStatus(
    workItemId: string,
    status: WorkflowStatus,
  ) {
    const existing = await this.databaseService.query<WorkflowRunRow>(
      `
        select
          id,
          status,
          current_step_key as "currentStepKey",
          current_step_type as "currentStepType"
        from workflow_runs
        where work_item_id = $1 and ended_at is null
        order by started_at desc
        limit 1
      `,
      [workItemId],
    );

    const target = this.getWorkflowRunTarget(status);
    const payload = JSON.stringify({
      workflowStatus: status,
      stepKey: target.stepKey,
      stepType: target.stepType,
    });

    if (!existing.rowCount) {
      const id = crypto.randomUUID();
      await this.databaseService.query(
        `
          insert into workflow_runs (
            id,
            work_item_id,
            process_definition_key,
            process_instance_id,
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
            null,
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
          id,
          workItemId,
          workflowProcessDefinitionKey,
          target.runStatus,
          target.stepKey,
          target.stepType,
          payload,
          target.runStatus === "completed" ? new Date().toISOString() : null,
        ],
      );

      return {
        id,
        status: target.runStatus,
        currentStepKey: target.stepKey,
        currentStepType: target.stepType,
      } satisfies WorkflowRunRow;
    }

    const run = existing.rows[0];
    await this.databaseService.query(
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
      [run.id, target.runStatus, target.stepKey, target.stepType, payload],
    );

    return {
      ...run,
      status: target.runStatus,
      currentStepKey: target.stepKey,
      currentStepType: target.stepType,
    };
  }

  private async syncTasksForStatus(
    workItemId: string,
    workflowRunId: string,
    status: WorkflowStatus,
    actor: string,
  ) {
    const definition = this.getTaskDefinitionForStatus(status);

    if (!definition) {
      await this.cancelOpenTasks(
        workItemId,
        null,
        workflowRunId,
        actor,
        "workflow-finished",
      );
      return;
    }

    const existingCurrentTask = await this.databaseService.query<{
      id: string;
    }>(
      `
        select id
        from tasks
        where work_item_id = $1
          and workflow_run_id = $2
          and task_type = $3
          and status = 'open'
        order by created_at desc
        limit 1
      `,
      [workItemId, workflowRunId, definition.taskType],
    );

    if (existingCurrentTask.rowCount) {
      await this.databaseService.query(
        `
          update tasks
          set title = $2,
              updated_at = now(),
              payload_json = coalesce(payload_json, '{}'::jsonb)
                || jsonb_build_object('expectedNextStatus', $3, 'stepKey', $4)
          where id = $1
        `,
        [
          existingCurrentTask.rows[0].id,
          definition.title,
          definition.nextStatus,
          definition.stepKey,
        ],
      );
    } else {
      const adoptableTask = await this.databaseService.query<{ id: string }>(
        `
          select id
          from tasks
          where work_item_id = $1
            and task_type = $2
            and status = 'open'
          order by created_at desc
          limit 1
        `,
        [workItemId, definition.taskType],
      );

      if (adoptableTask.rowCount) {
        await this.databaseService.query(
          `
            update tasks
            set workflow_run_id = $2,
                title = $3,
                updated_at = now(),
                payload_json = coalesce(payload_json, '{}'::jsonb)
                  || jsonb_build_object('expectedNextStatus', $4, 'stepKey', $5)
            where id = $1
          `,
          [
            adoptableTask.rows[0].id,
            workflowRunId,
            definition.title,
            definition.nextStatus,
            definition.stepKey,
          ],
        );
      } else {
        await this.databaseService.query(
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
              created_at,
              updated_at
            ) values ($1, $2, $3, $4, $5, $6, 'open', $7::jsonb, now(), now())
          `,
          [
            crypto.randomUUID(),
            workItemId,
            workflowRunId,
            definition.taskType,
            definition.title,
            null,
            JSON.stringify({
              expectedNextStatus: definition.nextStatus,
              title: definition.title,
              stepKey: definition.stepKey,
            }),
          ],
        );
      }
    }

    await this.cancelOpenTasks(
      workItemId,
      definition.taskType,
      workflowRunId,
      actor,
      "workflow-state-sync",
    );
  }

  private async cancelOpenTasks(
    workItemId: string,
    keepTaskType: UserTaskType | null,
    workflowRunId: string,
    actor: string,
    reason: string,
  ) {
    const params: unknown[] = [workItemId, workflowRunId];
    const conditions = [
      `work_item_id = $1`,
      `status = 'open'`,
      `workflow_run_id = $2`,
    ];

    if (keepTaskType) {
      params.push(keepTaskType);
      conditions.push(`task_type <> $${params.length}`);
    }

    params.push(actor, reason);

    const result = await this.databaseService.query<{
      id: string;
      taskType: string;
    }>(
      `
        update tasks
        set status = 'cancelled',
            completed_at = now(),
            updated_at = now(),
            payload_json = coalesce(payload_json, '{}'::jsonb)
              || jsonb_build_object('cancelledBy', $${params.length - 1}, 'cancelledAt', now(), 'cancelReason', $${params.length})
        where ${conditions.join(" and ")}
        returning id, task_type as "taskType"
      `,
      params,
    );

    if (!result.rowCount) {
      return;
    }

    await this.insertAuditEvent(workItemId, "task.cancelled", actor, {
      reason,
      taskIds: result.rows.map((row) => row.id),
      taskTypes: result.rows.map((row) => row.taskType),
      workflowRunId,
    });
  }

  private getTaskDefinitionForStatus(status: WorkflowStatus) {
    if (status === "done") {
      return null;
    }

    return workflowTaskByStatus[status];
  }

  private getWorkflowRunTarget(status: WorkflowStatus): {
    runStatus: WorkflowRunStatus;
    stepKey: string;
    stepType: WorkflowStepType;
  } {
    if (status === "done") {
      return {
        runStatus: "completed",
        stepKey: "EndEvent_Done",
        stepType: "end",
      };
    }

    const definition = workflowTaskByStatus[status];
    return {
      runStatus: "running",
      stepKey: definition.stepKey,
      stepType: definition.stepKey.startsWith("Gateway_") ? "gateway" : "user",
    };
  }

  private async requireWorkItemRow(id: string) {
    const result = await this.databaseService.query<WorkItemRow>(
      `
        select id, title, workflow_status as status
        from work_items
        where id = $1
        limit 1
      `,
      [id],
    );

    const item = result.rows[0];
    if (!item) {
      throw new NotFoundException("Work item not found");
    }

    return item;
  }

  private async insertAuditEvent(
    workItemId: string,
    eventType: string,
    actor: string,
    payload: Record<string, unknown>,
  ) {
    await this.databaseService.query(
      `
        insert into audit_events (id, work_item_id, event_type, actor, payload_json)
        values ($1, $2, $3, $4, $5::jsonb)
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
}
