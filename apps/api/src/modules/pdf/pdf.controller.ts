import { Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PdfService } from './pdf.service';

@Controller('/v1/work-items')
@UseGuards(AuthGuard)
export class PdfController {
  constructor(@Inject(PdfService) private readonly pdfService: PdfService) {}

  @Post(':id/render-pdf')
  async renderPdf(@Param('id') id: string) {
    return this.pdfService.renderWorkItemPdf(id);
  }
}
