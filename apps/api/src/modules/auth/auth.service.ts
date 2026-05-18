import { Injectable } from '@nestjs/common';
import type { AuthMode, AuthUser } from './auth.types';

type HeaderValue = string | string[] | undefined;

type RequestLike = {
  headers: Record<string, HeaderValue>;
};

@Injectable()
export class AuthService {
  getMode(): AuthMode {
    const mode = process.env.AUTH_MODE?.trim();

    if (mode === 'header' || mode === 'dev-bypass' || mode === 'disabled') {
      return mode;
    }

    return 'disabled';
  }

  resolveUser(request: RequestLike): AuthUser | null {
    const mode = this.getMode();

    if (mode === 'disabled') {
      return {
        email: 'internal-dev@architecture-flow.local',
        name: 'Internal Dev',
        roles: ['admin'],
        source: 'disabled',
      };
    }

    if (mode === 'dev-bypass') {
      const email = process.env.ARCHITECTURE_FLOW_DEV_USER_EMAIL?.trim();
      const name = process.env.ARCHITECTURE_FLOW_DEV_USER_NAME?.trim() || email || 'Dev User';
      const roles = this.parseRoles(process.env.ARCHITECTURE_FLOW_DEV_USER_ROLES);

      if (!email) {
        return null;
      }

      return {
        email,
        name,
        roles: roles.length ? roles : ['admin'],
        source: 'dev-bypass',
      };
    }

    const email = this.getHeader(request, ['x-authentik-email', 'x-forwarded-email']);
    const name =
      this.getHeader(request, ['x-authentik-name', 'x-forwarded-user']) ||
      email ||
      'Unknown user';
    const roles = this.parseRoles(
      this.getHeader(request, ['x-authentik-groups', 'x-forwarded-groups']) || '',
    );

    if (!email) {
      return null;
    }

    return {
      email,
      name,
      roles: roles.length ? roles : ['reviewer'],
      source: 'header',
    };
  }

  private getHeader(request: RequestLike, keys: string[]) {
    for (const key of keys) {
      const value = request.headers[key];

      if (Array.isArray(value)) {
        const first = value[0]?.trim();
        if (first) return first;
      }

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private parseRoles(value?: string | null) {
    return (value ?? '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);
  }
}
