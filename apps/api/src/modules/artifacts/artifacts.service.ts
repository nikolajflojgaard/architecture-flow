import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../services/database.service';

@Injectable()
export class ArtifactsService {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async listArtifactsForWorkItem(workItemId: string) {
    const result = await this.databaseService.query(
      `
        select
          id,
          work_item_id as "workItemId",
          artifact_type as "artifactType",
          storage_backend as "storageBackend",
          storage_path as "storagePath",
          drive_file_id as "driveFileId",
          version,
          created_at as "createdAt"
        from artifacts
        where work_item_id = $1
        order by created_at desc, version desc
      `,
      [workItemId],
    );

    return {
      items: result.rows,
      count: result.rowCount,
    };
  }

  async getArtifact(id: string) {
    const result = await this.databaseService.query(
      `
        select
          id,
          work_item_id as "workItemId",
          artifact_type as "artifactType",
          storage_backend as "storageBackend",
          storage_path as "storagePath",
          drive_file_id as "driveFileId",
          version,
          created_at as "createdAt"
        from artifacts
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
