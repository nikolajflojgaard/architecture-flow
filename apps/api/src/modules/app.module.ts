import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { WorkItemsModule } from './work-items/work-items.module';

@Module({
  imports: [HealthModule, WorkItemsModule],
})
export class AppModule {}
