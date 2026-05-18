import { Module } from '@nestjs/common';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { IntakeModule } from './intake/intake.module';
import { PdfModule } from './pdf/pdf.module';
import { WorkItemsModule } from './work-items/work-items.module';

@Module({
  imports: [HealthModule, AuthModule, WorkItemsModule, IntakeModule, ArtifactsModule, PdfModule],
})
export class AppModule {}
