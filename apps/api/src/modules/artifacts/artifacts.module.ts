import { Module } from '@nestjs/common';
import { DatabaseService } from '../../services/database.service';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactsService } from './artifacts.service';

@Module({
  controllers: [ArtifactsController],
  providers: [ArtifactsService, DatabaseService],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
