import { Module } from '@nestjs/common';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';
import { DatabaseService } from '../../services/database.service';

@Module({
  controllers: [WorkItemsController],
  providers: [WorkItemsService, DatabaseService],
})
export class WorkItemsModule {}
