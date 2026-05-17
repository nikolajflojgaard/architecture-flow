import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IntakeModule } from './intake/intake.module';
import { WorkItemsModule } from './work-items/work-items.module';

@Module({
  imports: [HealthModule, WorkItemsModule, IntakeModule],
})
export class AppModule {}
