import { Body, Controller, Get, Inject, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ArtifactsService } from '../artifacts/artifacts.service';
import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { WorkItemsService } from './work-items.service';

@Controller('/v1/work-items')
@UseGuards(AuthGuard)
export class WorkItemsController {
  constructor(
    @Inject(WorkItemsService) private readonly workItemsService: WorkItemsService,
    @Inject(ArtifactsService) private readonly artifactsService: ArtifactsService,
  ) {}

  @Get()
  async listWorkItems(@Query('status') status?: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 20;
    return this.workItemsService.listWorkItems({
      status,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 20,
    });
  }

  @Get(':id')
  async getWorkItem(@Param('id') id: string) {
    return this.workItemsService.getWorkItem(id);
  }

  @Get(':id/audit-events')
  async listAuditEvents(@Param('id') id: string) {
    return this.workItemsService.listAuditEvents(id);
  }

  @Get(':id/artifacts')
  async listArtifacts(@Param('id') id: string) {
    return this.artifactsService.listArtifactsForWorkItem(id);
  }

  @Patch(':id/status')
  async updateWorkflowStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: AuthUser | null,
  ) {
    const actor = user?.email ?? user?.name ?? 'system';
    return this.workItemsService.updateWorkflowStatus(id, status, actor);
  }
}
