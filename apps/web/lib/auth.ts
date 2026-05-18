import { headers } from 'next/headers';

export type Viewer = {
  email: string;
  name: string;
  roles: string[];
  source: 'disabled' | 'dev-bypass' | 'header';
};

export async function getViewer(): Promise<{ mode: string; user: Viewer | null }> {
  const mode = getMode();

  if (mode === 'disabled') {
    return {
      mode,
      user: {
        email: 'internal-dev@architecture-flow.local',
        name: 'Internal Dev',
        roles: ['admin'],
        source: 'disabled',
      },
    };
  }

  if (mode === 'dev-bypass') {
    const email = process.env.ARCHITECTURE_FLOW_DEV_USER_EMAIL?.trim();
    const name = process.env.ARCHITECTURE_FLOW_DEV_USER_NAME?.trim() || email || 'Dev User';
    const roles = parseRoles(process.env.ARCHITECTURE_FLOW_DEV_USER_ROLES);

    return {
      mode,
      user: email
        ? {
            email,
            name,
            roles: roles.length ? roles : ['admin'],
            source: 'dev-bypass',
          }
        : null,
    };
  }

  const requestHeaders = await headers();
  const email =
    requestHeaders.get('x-authentik-email') || requestHeaders.get('x-forwarded-email') || null;
  const name =
    requestHeaders.get('x-authentik-name') ||
    requestHeaders.get('x-forwarded-user') ||
    email ||
    'Unknown user';
  const roles = parseRoles(
    requestHeaders.get('x-authentik-groups') || requestHeaders.get('x-forwarded-groups'),
  );

  return {
    mode,
    user: email
      ? {
          email,
          name,
          roles: roles.length ? roles : ['reviewer'],
          source: 'header',
        }
      : null,
  };
}

function getMode() {
  const mode = process.env.AUTH_MODE?.trim();

  if (mode === 'header' || mode === 'dev-bypass' || mode === 'disabled') {
    return mode;
  }

  return 'disabled';
}

function parseRoles(value?: string | null) {
  return (value ?? '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
}
