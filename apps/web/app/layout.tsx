import type { ReactNode } from 'react';
import { getViewer } from '../lib/auth';
import './globals.css';

export const metadata = {
  title: 'Architecture Flow',
  description: 'Architecture workflow manager',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();

  return (
    <html lang="en">
      <body>
        {viewer.user ? (
          <div>
            <header className="app-topbar">
              <div className="topbar-brand">
                <strong>Architecture Flow</strong>
                <span className="topbar-hint">internal workflow shell</span>
              </div>
              <div className="topbar-user">
                <span>{viewer.user.name}</span>
                <span className="topbar-hint">{viewer.user.email}</span>
                <span className="topbar-pill">{viewer.user.roles.join(', ')}</span>
              </div>
            </header>
            {children}
          </div>
        ) : (
          <main className="page-shell narrow-shell">
            <section className="panel empty-state auth-state-panel">
              <p className="eyebrow">Authentication required</p>
              <h1>Architecture Flow is now behind an auth shell</h1>
              <p>
                No trusted identity headers were present, and no dev-bypass user is configured.
              </p>
              <p className="muted">
                Set <code>AUTH_MODE=dev-bypass</code> with a dev user locally, or put the app behind Authentik header forwarding.
              </p>
            </section>
          </main>
        )}
      </body>
    </html>
  );
}
