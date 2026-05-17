import Link from 'next/link';

type WorkItemDetail = {
  id: string;
  title: string;
  sourceType: string;
  sourceFolder: string;
  sourceFileId: string;
  sourceLink: string | null;
  customer: string | null;
  domain: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
};

type AuditEvent = {
  id: string;
  eventType: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export default async function WorkItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, auditEvents] = await Promise.all([getWorkItem(id), getAuditEvents(id)]);

  if (!item) {
    return (
      <main style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
        <Link href="/">← Back to inbox</Link>
        <h1>Work item not found</h1>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/">← Back to inbox</Link>
      </div>

      <section style={{ background: '#131a2b', border: '1px solid #22304d', borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <p style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 0 }}>Work item</p>
        <h1 style={{ margin: '8px 0 12px' }}>{item.title}</h1>
        <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
          {item.customer ?? 'Unknown customer'} · {item.domain ?? 'Unknown domain'}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          <Badge>{item.status}</Badge>
          <Badge>{item.priority}</Badge>
          <Badge>{item.sourceFolder}</Badge>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Panel title="Source metadata">
          <DetailRow label="Source type" value={item.sourceType} />
          <DetailRow label="Source file ID" value={item.sourceFileId} />
          <DetailRow label="Assigned to" value={item.assignedTo ?? 'Unassigned'} />
          <DetailRow label="Created" value={new Date(item.createdAt).toLocaleString()} />
          <DetailRow label="Updated" value={new Date(item.updatedAt).toLocaleString()} />
          <div style={{ marginTop: 16 }}>
            {item.sourceLink ? (
              <a href={item.sourceLink} target="_blank" rel="noreferrer">
                Open source file
              </a>
            ) : (
              'No source link yet'
            )}
          </div>
        </Panel>

        <Panel title="Next actions">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>Connect real artifact list</li>
            <li>Add workflow timeline</li>
            <li>Add generation actions</li>
            <li>Add comments</li>
          </ul>
        </Panel>
      </section>

      <section style={{ marginTop: 20 }}>
        <Panel title="Audit trail">
          {auditEvents.length === 0 ? (
            <p>No audit events yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {auditEvents.map((event) => (
                <div key={event.id} style={{ padding: 14, border: '1px solid #22304d', borderRadius: 12, background: '#0f172a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{event.eventType}</strong>
                    <span style={{ color: '#94a3b8' }}>{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                  <div style={{ marginTop: 6 }}>Actor: {event.actor ?? 'system'}</div>
                  {event.payload ? (
                    <pre
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 10,
                        background: '#020617',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </main>
  );
}

async function getWorkItem(id: string): Promise<WorkItemDetail | null> {
  const baseUrl = process.env.ARCHITECTURE_FLOW_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${baseUrl}/v1/work-items/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { item?: WorkItemDetail | null };
    return payload.item ?? null;
  } catch {
    return null;
  }
}

async function getAuditEvents(id: string): Promise<AuditEvent[]> {
  const baseUrl = process.env.ARCHITECTURE_FLOW_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${baseUrl}/v1/work-items/${id}/audit-events`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { items?: AuditEvent[] };
    return payload.items ?? [];
  } catch {
    return [];
  }
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: '#131a2b', border: '1px solid #22304d', borderRadius: 16, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div style={{ color: '#cbd5e1' }}>{children}</div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        background: '#0f172a',
        border: '1px solid #22304d',
        color: '#38bdf8',
        fontSize: 13,
      }}
    >
      {children}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <strong>{label}: </strong>
      <span>{value}</span>
    </div>
  );
}
