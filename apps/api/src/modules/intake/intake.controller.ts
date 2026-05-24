import { Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { IntakeService } from "./intake.service";

@Controller("/v1/intake-sources")
@UseGuards(AuthGuard)
export class IntakeController {
  constructor(
    @Inject(IntakeService) private readonly intakeService: IntakeService,
  ) {}

  @Get()
  async listIntakeSources() {
    return this.intakeService.listIntakeSources();
  }

  @Post("/sync")
  async runSync() {
    return this.intakeService.runSync();
  }
}
