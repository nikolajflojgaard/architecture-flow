import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ArtifactsService } from './artifacts.service';

@Controller('/v1/artifacts')
@UseGuards(AuthGuard)
export class ArtifactsController {
  constructor(@Inject(ArtifactsService) private readonly artifactsService: ArtifactsService) {}

  @Get(':id')
  async getArtifact(@Param('id') id: string) {
    return this.artifactsService.getArtifact(id);
  }
}
