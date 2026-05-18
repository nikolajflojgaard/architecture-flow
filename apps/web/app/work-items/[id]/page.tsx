import Link from 'next/link';
import { getArtifacts, getAuditEvents, getWorkItem } from '../../../lib/api';

export default async function WorkItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ rendered?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const [item, auditEvents, artifacts] = await Promise.all([
    getWorkItem(id),
    getAuditEvents(id),
    getArtifacts(id),
  ]);

  if (!item) {
    return (
      <main className="page-shell narrow-shell">
        <Link href="/" className="back-link">
          ← Back to inbox
        </Link>
        <section className="panel empty-state">
          <h1>Work item not found</h1>
          <p>The ID exists in the URL, but the API did not return a record.</p>
        </section>
      </main>
    );
  }

  const latestEvent = auditEvents[0] ?? null;
  const canRenderPdf = item.sourceType === 'drive-file' && /\.ya?ml$/i.test(item.title);

  return (
    <main className="page-shell narrow-shell">
      <div className="detail-header-row">
        <div>
          <Link href="/" className="back-link">
            ← Back to inbox
          </Link>
          <p className="eyebrow">Work item</p>
          <h1 className="detail-title">{item.title}</h1>
          <p className="hero-copy detail-copy">
            {item.customer ?? 'Unknown customer'} · {item.domain ?? 'Unknown domain'}
          </p>
        </div>
        <div className="detail-badges">
          <span className={`badge status-${item.status}`}>{labelizeStatus(item.status)}</span>
          <span className={`badge priority-${item.priority}`}>{item.priority}</span>
        </div>
      </div>

      {resolvedSearchParams.rendered === 'ok' ? (
        <div className="notice success">PDF render finished. Refresh again if you want to confirm the newest artifact version in the list.</div>
      ) : null}
      {resolvedSearchParams.rendered === 'error' ? (
        <div className="notice error">PDF render failed. Check the latest audit event for the error message, then retry.</div>
      ) : null}

      <section className="dashboard-grid detail-grid">
        <section className="panel">
          <h2>Workflow snapshot</h2>
          <div className="meta-grid">
            <MetaBlock label="Assigned to" value={item.assignedTo ?? 'Unassigned'} />
            <MetaBlock label="Source folder" value={item.sourceFolder} />
            <MetaBlock label="Source type" value={item.sourceType} />
            <MetaBlock label="Created" value={formatDate(item.createdAt)} />
            <MetaBlock label="Updated" value={formatDate(item.updatedAt)} />
            <MetaBlock label="Latest event" value={latestEvent ? labelizeStatus(latestEvent.eventType) : 'No events'} />
          </div>
        </section>

        <section className="panel">
          <h2>Source record</h2>
          <div className="detail-list">
            <DetailRow label="Source file ID" value={item.sourceFileId} />
            <DetailRow label="Source folder" value={item.sourceFolder} />
            <DetailRow label="Customer" value={item.customer ?? 'Unknown customer'} />
            <DetailRow label="Domain" value={item.domain ?? 'Unknown domain'} />
          </div>
          <div className="action-row">
            {item.sourceLink ? (
              <a href={item.sourceLink} target="_blank" rel="noreferrer" className="button-secondary">
                Open source file
              </a>
            ) : (
              <span className="muted small-text">No source link yet</span>
            )}
            {canRenderPdf ? (
              <form action={`/api/work-items/${item.id}/render-pdf`} method="post">
                <button type="submit" className="button-primary">
                  Render PDF
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </section>

      <section className="dashboard-grid detail-grid secondary-detail-grid">
        <section className="panel">
          <h2>Artifact chain</h2>
          {artifacts.length === 0 ? (
            <div className="empty-state compact-empty">
              <p>No artifacts linked yet.</p>
            </div>
          ) : (
            <div className="stack-list compact-list">
              {artifacts.map((artifact) => (
                <Link key={artifact.id} href={`/artifacts/${artifact.id}`} className="work-item-card artifact-card">
                  <div className="work-item-main">
                    <div className="work-item-title-row">
                      <strong>{labelizeStatus(artifact.artifactType)}</strong>
                      <span className="badge">v{artifact.version}</span>
                    </div>
                    <p className="work-item-meta">{artifact.storageBackend}</p>
                    <p className="work-item-meta muted">{artifact.storagePath ?? artifact.driveFileId ?? 'No storage path yet'}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Audit trail</h2>
          {auditEvents.length === 0 ? (
            <div className="empty-state compact-empty">
              <p>No audit events yet.</p>
            </div>
          ) : (
            <div className="timeline-list">
              {auditEvents.map((event) => (
                <article key={event.id} className="timeline-card">
                  <div className="timeline-card-top">
                    <strong>{labelizeStatus(event.eventType)}</strong>
                    <span className="muted small-text">{formatDate(event.createdAt)}</span>
                  </div>
                  <p className="work-item-meta">Actor: {event.actor ?? 'system'}</p>
                  {event.payload ? (
                    <pre className="payload-block">{JSON.stringify(event.payload, null, 2)}</pre>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Still missing</h2>
        <ul className="plain-list">
          <li>Manual generation actions for KISS / final design / OpenAPI drafts</li>
          <li>Comments and review handoff</li>
          <li>Workflow-state transitions instead of read-only visibility</li>
        </ul>
      </section>
    </main>
  );
}

function MetaBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-block">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function labelizeStatus(value: string) {
  return value.replaceAll('_', ' ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
