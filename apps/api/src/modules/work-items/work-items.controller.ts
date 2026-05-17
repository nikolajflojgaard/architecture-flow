import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { WorkItemsService } from './work-items.service';

@Controller('/v1/work-items')
export class WorkItemsController {
  constructor(@Inject(WorkItemsService) private readonly workItemsService: WorkItemsService) {}

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
}
