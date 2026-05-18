import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ArtifactsService } from './artifacts.service';

@Controller('/v1/artifacts')
export class ArtifactsController {
  constructor(@Inject(ArtifactsService) private readonly artifactsService: ArtifactsService) {}

  @Get(':id')
  async getArtifact(@Param('id') id: string) {
    return this.artifactsService.getArtifact(id);
  }
}
