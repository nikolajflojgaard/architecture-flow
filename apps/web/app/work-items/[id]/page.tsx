import Link from 'next/link';
import {
  getArtifacts,
  getAuditEvents,
  getTasks,
  getWorkItem,
  type WorkflowTask,
} from '../../../lib/api';

export default async function WorkItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ rendered?: string; statusChange?: string; taskComplete?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const [item, auditEvents, artifacts, tasks] = await Promise.all([
    getWorkItem(id),
    getAuditEvents(id),
    getArtifacts(id),
    getTasks(id),
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
      {resolvedSearchParams.statusChange === 'ok' ? (
        <div className="notice success">Workflow status updated.</div>
      ) : null}
      {resolvedSearchParams.statusChange === 'error' ? (
        <div className="notice error">Workflow status update failed. Check the API/auth path and try again.</div>
      ) : null}
      {resolvedSearchParams.taskComplete === 'ok' ? (
        <div className="notice success">Workflow task completed.</div>
      ) : null}
      {resolvedSearchParams.taskComplete === 'error' ? (
        <div className="notice error">Workflow task completion failed. Refresh and try again.</div>
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

          <div style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Current user tasks</h3>
            {tasks.filter((task) => task.status === 'open').length === 0 ? (
              <p className="muted small-text">No open workflow tasks for this item.</p>
            ) : (
              <div className="timeline-list">
                {tasks
                  .filter((task) => task.status === 'open')
                  .map((task) => (
                    <article key={task.id} className="timeline-card">
                      <div className="timeline-card-top">
                        <strong>{getTaskTitle(task)}</strong>
                        <span className="badge status-review">open</span>
                      </div>
                      <p className="work-item-meta">Type: {labelizeStatus(task.taskType)}</p>
                      <p className="work-item-meta muted">
                        {task.assignedTo ?? 'Unassigned'} · created {formatDate(task.createdAt)}
                      </p>
                      <form action={`/api/work-items/${item.id}/tasks/${task.id}/complete`} method="post" style={{ marginTop: 12 }}>
                        <button type="submit" className="button-primary">
                          {getCompletionLabel(task)}
                        </button>
                      </form>
                    </article>
                  ))}
              </div>
            )}
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
          <li>Real Flowable task ownership and instance linkage instead of app-local bootstrap tasks</li>
          <li>Manual generation actions for KISS / final design / OpenAPI drafts</li>
          <li>Comments and review handoff</li>
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

function getTaskTitle(task: WorkflowTask) {
  const payloadTitle = typeof task.payload?.title === 'string' ? task.payload.title : null;
  if (payloadTitle) {
    return payloadTitle;
  }

  return labelizeStatus(task.taskType);
}

function getCompletionLabel(task: WorkflowTask) {
  switch (task.taskType) {
    case 'triage':
      return 'Complete triage';
    case 'produce_artifacts':
      return 'Mark artifacts ready for review';
    case 'review_and_approve':
      return 'Approve and move forward';
    default:
      return 'Complete task';
  }
}
