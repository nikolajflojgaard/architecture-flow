import { Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
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
  @UseGuards(RolesGuard)
  @Roles("admin", "architect")
  async runSync() {
    return this.intakeService.runSync();
  }
}
