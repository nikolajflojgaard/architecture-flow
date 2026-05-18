import { Module } from '@nestjs/common';
import { WorkerJobsService } from '../../services/worker-jobs.service';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';

@Module({
  controllers: [PdfController],
  providers: [PdfService, WorkerJobsService],
  exports: [PdfService],
})
export class PdfModule {}
