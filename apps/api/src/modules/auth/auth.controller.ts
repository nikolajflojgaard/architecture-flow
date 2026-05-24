import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "./auth-user.decorator";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import type { AuthUser } from "./auth.types";

@Controller("/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("me")
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: AuthUser | null) {
    return {
      mode: this.authService.getMode(),
      user,
    };
  }
}
