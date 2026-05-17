import { Controller, Get, Inject, Post } from '@nestjs/common';
import { IntakeService } from './intake.service';

@Controller('/v1/intake-sources')
export class IntakeController {
  constructor(@Inject(IntakeService) private readonly intakeService: IntakeService) {}

  @Get()
  async listIntakeSources() {
    return this.intakeService.listIntakeSources();
  }

  @Post('/sync')
  async runSync() {
    return this.intakeService.runSync();
  }
}
