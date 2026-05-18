import { Module } from '@nestjs/common';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { IntakeModule } from './intake/intake.module';
import { WorkItemsModule } from './work-items/work-items.module';

@Module({
  imports: [HealthModule, AuthModule, WorkItemsModule, IntakeModule, ArtifactsModule],
})
export class AppModule {}
