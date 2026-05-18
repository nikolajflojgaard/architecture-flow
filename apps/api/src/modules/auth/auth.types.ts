export type AuthMode = 'disabled' | 'dev-bypass' | 'header';

export type AuthUser = {
  email: string;
  name: string;
  roles: string[];
  source: 'disabled' | 'dev-bypass' | 'header';
};
