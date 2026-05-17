import Link from 'next/link';
import type { ReactNode } from 'react';

const nextSlices = [
  'Add intake sync trigger inside the app shell',
  'Add authenticated inbox and work-item views',
  'Connect PDF artifacts to live work items',
];

export default async function HomePage() {
  const workItems = await getWorkItems();
  const intakeSources = await getIntakeSources();

  return (
    <main style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5 }}>Architecture Flow</p>
        <h1 style={{ fontSize: 42, margin: '8px 0 12px' }}>Architecture workflow manager</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 760, lineHeight: 1.6 }}>
          Intake messy source files, move them through structured workflow, and keep every artifact from design doc to OpenAPI PDF tied together.
        </p>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card title="Current intake sources">
          <form action="/api/intake/sync" method="post" style={{ marginBottom: 16 }}>
            <button
              type="submit"
              style={{
                border: '1px solid #22304d',
                borderRadius: 10,
                background: '#0f172a',
                color: '#e2e8f0',
                padding: '10px 14px',
                cursor: 'pointer',
              }}
            >
              Run intake sync
            </button>
          </form>

          {intakeSources.length === 0 ? (
            <p>No intake sources configured yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {intakeSources.map((item) => (
                <div key={item.id} style={{ padding: 14, border: '1px solid #22304d', borderRadius: 12, background: '#0f172a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{item.displayName}</strong>
                    <span style={{ color: item.enabled ? '#34d399' : '#f59e0b' }}>{item.enabled ? 'enabled' : 'disabled'}</span>
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: 6 }}>{item.driveFolderPath ?? 'No folder path set'}</div>
                  <div style={{ marginTop: 6 }}>
                    {item.workItemCount} work items · {item.discoveredCount} discovered events
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: 6 }}>
                    Last discovered: {item.lastDiscoveredAt ? new Date(item.lastDiscoveredAt).toLocaleString() : 'Never'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Next implementation slices">
          <ul>
            {nextSlices.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      </section>

      <section style={{ marginBottom: 20 }}>
        <Card title="Inbox preview (live API)">
          {workItems.length === 0 ? (
            <p>No work items yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {workItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/work-items/${item.id}`}
                  style={{ padding: 14, border: '1px solid #22304d', borderRadius: 12, background: '#0f172a' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{item.title}</strong>
                    <span style={{ color: '#38bdf8' }}>{item.status}</span>
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: 6 }}>{item.sourceFolder}</div>
                  <div style={{ color: '#cbd5e1', marginTop: 6 }}>
                    {item.customer ?? 'Unknown customer'} · {item.domain ?? 'Unknown domain'}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <Card title="Initial product modules">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          {[
            'Inbox',
            'Work item detail',
            'Artifact chain',
            'BPMN workflow state',
            'Drive intake sync',
            'OpenAPI PDF rendering',
          ].map((item) => (
            <div key={item} style={{ padding: 14, border: '1px solid #22304d', borderRadius: 12, background: '#0f172a' }}>
              {item}
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}

type WorkItem = {
  id: string;
  title: string;
  sourceFolder: string;
  customer: string | null;
  domain: string | null;
  status: string;
};

type IntakeSource = {
  id: string;
  displayName: string;
  driveFolderPath: string | null;
  enabled: boolean;
  workItemCount: number;
  discoveredCount: number;
  lastDiscoveredAt: string | null;
};

async function getWorkItems(): Promise<WorkItem[]> {
  const baseUrl = process.env.ARCHITECTURE_FLOW_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${baseUrl}/v1/work-items?limit=10`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { items?: WorkItem[] };
    return payload.items ?? [];
  } catch {
    return [];
  }
}

async function getIntakeSources(): Promise<IntakeSource[]> {
  const baseUrl = process.env.ARCHITECTURE_FLOW_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${baseUrl}/v1/intake-sources`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { items?: IntakeSource[] };
    return payload.items ?? [];
  } catch {
    return [];
  }
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ background: '#131a2b', border: '1px solid #22304d', borderRadius: 16, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div style={{ color: '#cbd5e1', lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}
