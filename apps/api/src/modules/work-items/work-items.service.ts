import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../services/database.service';

export const workflowStatuses = ['new', 'triaged', 'in_progress', 'review', 'done'] as const;
export type WorkflowStatus = (typeof workflowStatuses)[number];

type ListWorkItemsOptions = {
  status?: string;
  limit: number;
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

    const currentResult = await this.databaseService.query<{
      id: string;
      status: WorkflowStatus;
      title: string;
    }>(
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
}
