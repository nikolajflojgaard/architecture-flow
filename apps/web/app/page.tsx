import Link from 'next/link';
import { getIntakeSources, getWorkItems } from '../lib/api';

const nextSlices = [
  'Connect PDF artifacts to real work items',
  'Add auth shell before this leaves local dev',
  'Map workflow actions to actual worker jobs',
];

const statusOrder = ['all', 'new', 'triaged', 'in_progress', 'review', 'done'] as const;

type HomePageProps = {
  searchParams?: Promise<{
    status?: string;
    sync?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeStatus =
    statusOrder.find((status) => status === resolvedSearchParams.status) ?? 'all';

  const [workItems, intakeSources] = await Promise.all([
    getWorkItems(activeStatus, 50),
    getIntakeSources(),
  ]);

  const totalItems = workItems.length;
  const highPriorityCount = workItems.filter((item) => item.priority === 'high').length;
  const unassignedCount = workItems.filter((item) => !item.assignedTo).length;
  const statusCounts = buildStatusCounts(workItems);

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Architecture Flow</p>
          <h1>Architecture workflow manager</h1>
          <p className="hero-copy">
            Intake messy source files, turn them into visible work items, and keep the design doc → YAML → PDF chain tied to one workflow instead of scattered in chat and Drive.
          </p>
        </div>
        <div className="hero-meta panel subtle-panel">
          <div>
            <span className="metric-label">Live scope</span>
            <strong>{totalItems}</strong>
            <span className="metric-hint">work items in current view</span>
          </div>
          <div>
            <span className="metric-label">High priority</span>
            <strong>{highPriorityCount}</strong>
            <span className="metric-hint">need attention first</span>
          </div>
          <div>
            <span className="metric-label">Unassigned</span>
            <strong>{unassignedCount}</strong>
            <span className="metric-hint">ownership still missing</span>
          </div>
        </div>
      </section>

      {resolvedSearchParams.sync === 'ok' ? (
        <div className="notice success">Intake sync started. Refresh in a moment if you expect new items.</div>
      ) : null}
      {resolvedSearchParams.sync === 'error' ? (
        <div className="notice error">Intake sync failed. The API shell is reachable, but the worker path needs attention.</div>
      ) : null}

      <section className="dashboard-grid top-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Inbox</h2>
              <p className="panel-copy">Real work items from the API, with status filtering and ownership visibility.</p>
            </div>
            <form action="/api/intake/sync" method="post">
              <button type="submit" className="button-primary">Run intake sync</button>
            </form>
          </div>

          <div className="filter-row" aria-label="Status filters">
            {statusOrder.map((status) => {
              const href = status === 'all' ? '/' : `/?status=${status}`;
              const count = status === 'all' ? totalItems : statusCounts[status] ?? 0;

              return (
                <Link
                  key={status}
                  href={href}
                  className={`filter-chip ${activeStatus === status ? 'active' : ''}`}
                >
                  <span>{labelizeStatus(status)}</span>
                  <strong>{count}</strong>
                </Link>
              );
            })}
          </div>

          {workItems.length === 0 ? (
            <div className="empty-state">
              <h3>No work items in this view</h3>
              <p>Either the intake is empty, or the API/DB is not returning data yet.</p>
            </div>
          ) : (
            <div className="stack-list">
              {workItems.map((item) => (
                <Link key={item.id} href={`/work-items/${item.id}`} className="work-item-card">
                  <div className="work-item-main">
                    <div className="work-item-title-row">
                      <strong>{item.title}</strong>
                      <span className={`badge status-${item.status}`}>{labelizeStatus(item.status)}</span>
                    </div>
                    <p className="work-item-meta">
                      {item.customer ?? 'Unknown customer'} · {item.domain ?? 'Unknown domain'}
                    </p>
                    <p className="work-item-meta muted">
                      {item.sourceFolder} · updated {formatDate(item.updatedAt)}
                    </p>
                  </div>
                  <div className="work-item-side">
                    <span className={`badge priority-${item.priority}`}>{item.priority}</span>
                    <span className="muted small-text">{item.assignedTo ?? 'Unassigned'}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Current intake sources</h2>
          <p className="panel-copy">This is the ingestion edge. If items are missing, the problem starts here.</p>
          {intakeSources.length === 0 ? (
            <div className="empty-state compact-empty">
              <p>No intake sources configured yet.</p>
            </div>
          ) : (
            <div className="stack-list compact-list">
              {intakeSources.map((item) => (
                <div key={item.id} className="source-card">
                  <div className="source-card-top">
                    <strong>{item.displayName}</strong>
                    <span className={`badge ${item.enabled ? 'status-enabled' : 'status-disabled'}`}>
                      {item.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                  <p className="work-item-meta muted">{item.driveFolderPath ?? 'No folder path set'}</p>
                  <div className="source-stats">
                    <span>{item.workItemCount} work items</span>
                    <span>{item.discoveredCount} discovered</span>
                  </div>
                  <p className="work-item-meta muted">
                    Last discovered {item.lastDiscoveredAt ? formatDate(item.lastDiscoveredAt) : 'never'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="dashboard-grid bottom-grid">
        <section className="panel">
          <h2>What this slice already proves</h2>
          <ul className="plain-list">
            <li>UI is reading real intake and work-item data from the API.</li>
            <li>Status filtering now makes the inbox usable instead of decorative.</li>
            <li>Ownership and priority gaps are visible immediately.</li>
          </ul>
        </section>

        <section className="panel">
          <h2>Next implementation slices</h2>
          <ul className="plain-list">
            {nextSlices.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}

function buildStatusCounts(items: Awaited<ReturnType<typeof getWorkItems>>) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.status] = (accumulator[item.status] ?? 0) + 1;
    return accumulator;
  }, {});
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
