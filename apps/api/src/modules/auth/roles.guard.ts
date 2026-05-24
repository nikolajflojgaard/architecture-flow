import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_ROLES_KEY } from "./roles.decorator";
import type { AuthUser } from "./auth.types";

type RequestWithUser = {
  authUser?: AuthUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      AUTH_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.authUser;

    if (!user) {
      throw new ForbiddenException("Authenticated user context missing");
    }

    if (requiredRoles.some((role) => user.roles.includes(role))) {
      return true;
    }

    throw new ForbiddenException(
      `Requires one of roles: ${requiredRoles.join(", ")}`,
    );
  }
}
