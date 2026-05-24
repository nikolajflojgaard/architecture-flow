import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ArtifactsService } from "../artifacts/artifacts.service";
import { CurrentUser } from "../auth/auth-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { WorkerJobsService } from "../../services/worker-jobs.service";
import { WorkItemsService } from "./work-items.service";

@Controller("/v1/work-items")
@UseGuards(AuthGuard)
export class WorkItemsController {
  constructor(
    @Inject(WorkItemsService)
    private readonly workItemsService: WorkItemsService,
    @Inject(ArtifactsService)
    private readonly artifactsService: ArtifactsService,
    @Inject(WorkerJobsService)
    private readonly workerJobsService: WorkerJobsService,
  ) {}

  @Get()
  async listWorkItems(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 20;
    return this.workItemsService.listWorkItems({
      status,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 20,
    });
  }

  @Get(":id")
  async getWorkItem(@Param("id") id: string) {
    return this.workItemsService.getWorkItem(id);
  }

  @Get(":id/audit-events")
  async listAuditEvents(@Param("id") id: string) {
    return this.workItemsService.listAuditEvents(id);
  }

  @Get(":id/artifacts")
  async listArtifacts(@Param("id") id: string) {
    return this.artifactsService.listArtifactsForWorkItem(id);
  }

  @Get(":id/tasks")
  async listTasks(@Param("id") id: string) {
    return this.workItemsService.listTasks(id);
  }

  @Get(":id/comments")
  async listComments(@Param("id") id: string) {
    return this.workItemsService.listComments(id);
  }

  @Patch(":id/status")
  async updateWorkflowStatus(
    @Param("id") id: string,
    @Body("status") status: string,
    @CurrentUser() user: AuthUser | null,
  ) {
    const actor = user?.email ?? user?.name ?? "system";
    return this.workItemsService.updateWorkflowStatus(id, status, actor);
  }

  @Patch(":id/assignment")
  async updateAssignment(
    @Param("id") id: string,
    @Body("assignedTo") assignedTo: string | null,
    @CurrentUser() user: AuthUser | null,
  ) {
    const actor = user?.email ?? user?.name ?? "system";
    return this.workItemsService.updateAssignment(id, assignedTo, actor);
  }

  @Post(":id/tasks/:taskId/complete")
  async completeTask(
    @Param("id") id: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: AuthUser | null,
  ) {
    const actor = user?.email ?? user?.name ?? "system";
    return this.workItemsService.completeTask(id, taskId, actor);
  }

  @Post(":id/comments")
  async createComment(
    @Param("id") id: string,
    @Body("body") body: string,
    @Body("parentCommentId") parentCommentId: string | null,
    @CurrentUser() user: AuthUser | null,
  ) {
    const author = user?.email ?? user?.name ?? "system";
    return this.workItemsService.createComment(
      id,
      body,
      author,
      parentCommentId,
    );
  }

  @Post(":id/classify-intake")
  async classifyIntake(@Param("id") id: string) {
    return this.workerJobsService.runServiceTask("intake.classify", id);
  }
}
