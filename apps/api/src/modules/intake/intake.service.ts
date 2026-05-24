import { Inject, Injectable } from "@nestjs/common";
import { runDriveIntakeSync } from "@architecture-flow/intake-sync";
import { DatabaseService } from "../../services/database.service";

@Injectable()
export class IntakeService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async listIntakeSources() {
    const result = await this.databaseService.query<{
      id: string;
      sourceKey: string;
      displayName: string;
      sourceType: string;
      driveFolderPath: string | null;
      driveFolderId: string | null;
      enabled: boolean;
      workItemCount: string;
      discoveredCount: string;
      lastDiscoveredAt: string | null;
    }>(
      `
        select
          s.id,
          s.source_key as "sourceKey",
          s.display_name as "displayName",
          s.source_type as "sourceType",
          s.drive_folder_path as "driveFolderPath",
          s.drive_folder_id as "driveFolderId",
          s.enabled,
          coalesce(w.work_item_count, 0)::text as "workItemCount",
          coalesce(e.discovered_count, 0)::text as "discoveredCount",
          e.last_discovered_at as "lastDiscoveredAt"
        from intake_sources s
        left join (
          select source_folder, count(*) as work_item_count
          from work_items
          group by source_folder
        ) w on w.source_folder = s.display_name
        left join (
          select intake_source_id, count(*) as discovered_count, max(created_at) as last_discovered_at
          from intake_events
          where event_type = 'discovered'
          group by intake_source_id
        ) e on e.intake_source_id = s.id
        order by s.display_name asc
      `,
    );

    return {
      items: result.rows.map((row) => ({
        ...row,
        workItemCount: Number(row.workItemCount),
        discoveredCount: Number(row.discoveredCount),
      })),
    };
  }

  async runSync() {
    const summary = await runDriveIntakeSync();

    return {
      ...summary,
      stdout: summary.sources
        .map((source) =>
          source.skipped
            ? `${source.displayName}: skipped (${source.skipped})`
            : `${source.displayName}: scanned ${source.scanned}, discovered ${source.discovered}, enriched ${source.enriched}`,
        )
        .join("\n"),
      stderr: "",
    };
  }
}
