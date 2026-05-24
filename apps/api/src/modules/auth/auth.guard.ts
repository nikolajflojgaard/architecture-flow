import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { AuthUser } from "./auth.types";

type RequestWithUser = {
  headers: Record<string, string | string[] | undefined>;
  authUser?: AuthUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = this.authService.resolveUser(request);

    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }

    request.authUser = user;
    return true;
  }
}
