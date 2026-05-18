import crypto from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../services/database.service';

export const workflowStatuses = ['new', 'triaged', 'in_progress', 'review', 'done'] as const;
export type WorkflowStatus = (typeof workflowStatuses)[number];
export const taskStatuses = ['open', 'completed'] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export const userTaskTypes = ['triage', 'produce_artifacts', 'review_and_approve'] as const;
export type UserTaskType = (typeof userTaskTypes)[number];

type WorkflowTaskDefinition = {
  taskType: UserTaskType;
  title: string;
  nextStatus: WorkflowStatus;
};

const workflowTaskByStatus: Record<Exclude<WorkflowStatus, 'done'>, WorkflowTaskDefinition> = {
  new: {
    taskType: 'triage',
    title: 'Triage work item',
    nextStatus: 'triaged',
  },
  triaged: {
    taskType: 'produce_artifacts',
    title: 'Produce working artifacts',
    nextStatus: 'in_progress',
  },
  in_progress: {
    taskType: 'review_and_approve',
    title: 'Review and approve',
    nextStatus: 'review',
  },
  review: {
    taskType: 'review_and_approve',
    title: 'Approve review outcome',
    nextStatus: 'done',
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
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

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
        id,
        title,
        source_type as "sourceType",
        source_folder as "sourceFolder",
        source_file_id as "sourceFileId",
        source_link as "sourceLink",
        customer,
        domain,
        workflow_status as status,
        priority,
        assigned_to as "assignedTo",
        created_at as "createdAt",
        updated_at as "updatedAt"
      from work_items
      ${where.length ? `where ${where.join(' and ')}` : ''}
      order by created_at desc
      limit ${limitPlaceholder}
    `;

    const result = await this.databaseService.query(sql, values);
    return {
      items: result.rows,
      count: result.rowCount,
    };
  }

  async getWorkItem(id: string) {
    const result = await this.databaseService.query(
      `
        select
          id,
          title,
          source_type as "sourceType",
          source_folder as "sourceFolder",
          source_file_id as "sourceFileId",
          source_link as "sourceLink",
          customer,
          domain,
          workflow_status as status,
          priority,
          assigned_to as "assignedTo",
          created_at as "createdAt",
          updated_at as "updatedAt"
        from work_items
        where id = $1
        limit 1
      `,
      [id],
    );

    return {
      item: result.rows[0] ?? null,
    };
  }

  async listTasks(workItemId: string) {
    await this.ensureCurrentTask(workItemId);

    const result = await this.databaseService.query(
      `
        select
          id,
          work_item_id as "workItemId",
          workflow_run_id as "workflowRunId",
          task_type as "taskType",
          assigned_to as "assignedTo",
          status,
          payload_json as payload,
          due_at as "dueAt",
          created_at as "createdAt"
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
      throw new BadRequestException(`Unsupported workflow status: ${nextStatus}`);
    }

    const currentResult = await this.databaseService.query<WorkItemRow>(
      `
        select
          id,
          workflow_status as status,
          title
        from work_items
        where id = $1
        limit 1
      `,
      [id],
    );

    const current = currentResult.rows[0];
    if (!current) {
      throw new NotFoundException('Work item not found');
    }

    const currentStatus = current.status;
    if (currentStatus === nextStatus) {
      return {
        item: (await this.getWorkItem(id)).item,
        changed: false,
      };
    }

    await this.databaseService.query('begin');

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

      await this.databaseService.query(
        `
          insert into audit_events (
            work_item_id,
            event_type,
            actor,
            payload_json
          ) values (
            $1,
            $2,
            $3,
            $4::jsonb
          )
        `,
        [
          id,
          'workflow_status_changed',
          actor,
          JSON.stringify({ from: currentStatus, to: nextStatus, title: current.title }),
        ],
      );

      await this.databaseService.query('commit');
    } catch (error) {
      await this.databaseService.query('rollback');
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
      taskType: UserTaskType;
      status: TaskStatus;
    }>(
      `
        select
          id,
          work_item_id as "workItemId",
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
      throw new NotFoundException('Task not found');
    }

    if (task.status !== 'open') {
      throw new BadRequestException('Only open tasks can be completed');
    }

    const workItem = await this.requireWorkItemRow(workItemId);
    const definition = this.getTaskDefinitionForStatus(workItem.status);

    if (!definition || definition.taskType !== task.taskType) {
      throw new BadRequestException('Task does not match the current workflow state');
    }

    await this.databaseService.query('begin');

    try {
      await this.databaseService.query(
        `
          update tasks
          set status = 'completed',
              payload_json = coalesce(payload_json, '{}'::jsonb) || jsonb_build_object('completedBy', $2, 'completedAt', now())
          where id = $1
        `,
        [taskId, actor],
      );

      await this.databaseService.query(
        `
          insert into audit_events (id, work_item_id, event_type, actor, payload_json)
          values ($1, $2, $3, $4, $5::jsonb)
        `,
        [
          crypto.randomUUID(),
          workItemId,
          'task.completed',
          actor,
          JSON.stringify({ taskId, taskType: task.taskType, fromStatus: workItem.status, toStatus: definition.nextStatus }),
        ],
      );

      await this.databaseService.query(
        `
          update work_items
          set workflow_status = $2,
              updated_at = now()
          where id = $1
        `,
        [workItemId, definition.nextStatus],
      );

      await this.databaseService.query(
        `
          insert into audit_events (id, work_item_id, event_type, actor, payload_json)
          values ($1, $2, $3, $4, $5::jsonb)
        `,
        [
          crypto.randomUUID(),
          workItemId,
          'workflow_status_changed',
          actor,
          JSON.stringify({ from: workItem.status, to: definition.nextStatus, taskId, taskType: task.taskType }),
        ],
      );

      await this.databaseService.query('commit');
    } catch (error) {
      await this.databaseService.query('rollback');
      throw error;
    }

    await this.ensureCurrentTask(workItemId);

    return {
      item: (await this.getWorkItem(workItemId)).item,
      tasks: (await this.listTasks(workItemId)).items,
    };
  }

  private async ensureCurrentTask(workItemId: string) {
    const workItem = await this.requireWorkItemRow(workItemId);
    const definition = this.getTaskDefinitionForStatus(workItem.status);

    if (!definition) {
      return;
    }

    const existingOpenTask = await this.databaseService.query<{ id: string }>(
      `
        select id
        from tasks
        where work_item_id = $1 and status = 'open' and task_type = $2
        limit 1
      `,
      [workItemId, definition.taskType],
    );

    if (existingOpenTask.rowCount) {
      return;
    }

    await this.databaseService.query(
      `
        insert into tasks (
          id,
          work_item_id,
          task_type,
          assigned_to,
          status,
          payload_json
        ) values ($1, $2, $3, $4, 'open', $5::jsonb)
      `,
      [
        crypto.randomUUID(),
        workItemId,
        definition.taskType,
        null,
        JSON.stringify({ title: definition.title, expectedNextStatus: definition.nextStatus }),
      ],
    );
  }

  private getTaskDefinitionForStatus(status: WorkflowStatus) {
    if (status === 'done') {
      return null;
    }

    return workflowTaskByStatus[status];
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
      throw new NotFoundException('Work item not found');
    }

    return item;
  }
}
