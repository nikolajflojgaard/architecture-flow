import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "./auth.types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | null => {
    const request = context
      .switchToHttp()
      .getRequest<{ authUser?: AuthUser }>();
    return request.authUser ?? null;
  },
);
