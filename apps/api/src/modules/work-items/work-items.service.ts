import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../services/database.service';

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
}
