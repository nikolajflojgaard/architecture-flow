import { Inject, Injectable } from "@nestjs/common";
import { WorkerJobsService } from "../../services/worker-jobs.service";

@Injectable()
export class PdfService {
  constructor(
    @Inject(WorkerJobsService)
    private readonly workerJobsService: WorkerJobsService,
  ) {}

  async renderWorkItemPdf(workItemId: string) {
    return this.workerJobsService.runServiceTask(
      "artifact.render-pdf",
      workItemId,
    );
  }
}
