import { Module } from "@nestjs/common";
import { DatabaseService } from "../../services/database.service";
import { WorkerJobsService } from "../../services/worker-jobs.service";
import { ArtifactsModule } from "../artifacts/artifacts.module";
import { WorkItemsController } from "./work-items.controller";
import { WorkItemsService } from "./work-items.service";

@Module({
  imports: [ArtifactsModule],
  controllers: [WorkItemsController],
  providers: [WorkItemsService, DatabaseService, WorkerJobsService],
})
export class WorkItemsModule {}
