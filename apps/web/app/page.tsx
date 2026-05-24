import Link from "next/link";
import { getIntakeSources, getWorkItems, workflowStatuses } from "../lib/api";
import { getViewer } from "../lib/auth";

const nextSlices = [
  "Choose first deployment target and write the deployment bootstrap",
  "Build the pipeline board",
  "Define the OpenClaw integration boundary",
  "Add owner assignment + blocked visibility",
];

const statusOrder = [
  "all",
  "new",
  "triaged",
  "in_progress",
  "review",
  "done",
] as const;

type HomePageProps = {
  searchParams?: Promise<{
    status?: string;
    sync?: string;
    statusChange?: string;
    assignmentChange?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const activeStatus =
    statusOrder.find((status) => status === resolvedSearchParams.status) ??
    "all";

  const [allWorkItems, intakeSources, viewer] = await Promise.all([
    getWorkItems(undefined, 100),
    getIntakeSources(),
    getViewer(),
  ]);

  const workItems =
    activeStatus === "all"
      ? allWorkItems
      : allWorkItems.filter((item) => item.status === activeStatus);

  const totalItems = workItems.length;
  const highPriorityCount = workItems.filter(
    (item) => item.priority === "high",
  ).length;
  const unassignedCount = workItems.filter((item) => !item.assignedTo).length;
  const statusCounts = buildStatusCounts(allWorkItems);
  const boardColumns = workflowStatuses.map((status) => ({
    status,
    items: allWorkItems.filter((item) => item.status === status),
  }));

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Architecture Flow</p>
          <h1>Architecture workflow manager</h1>
          <p className="hero-copy">
            Intake messy source files, turn them into visible work items, and
            keep the design doc → YAML → PDF chain tied to one workflow instead
            of scattered in chat and Drive.
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

      {resolvedSearchParams.sync === "ok" ? (
        <div className="notice success">
          Intake sync started. Refresh in a moment if you expect new items.
        </div>
      ) : null}
      {resolvedSearchParams.sync === "error" ? (
        <div className="notice error">
          Intake sync failed. Check the API logs and the shared intake sync
          path.
        </div>
      ) : null}
      {resolvedSearchParams.statusChange === "ok" ? (
        <div className="notice success">Workflow status updated.</div>
      ) : null}
      {resolvedSearchParams.statusChange === "error" ? (
        <div className="notice error">
          Workflow status update failed. Check the API/auth path and try again.
        </div>
      ) : null}
      {resolvedSearchParams.assignmentChange === "ok" ? (
        <div className="notice success">Assignment updated.</div>
      ) : null}
      {resolvedSearchParams.assignmentChange === "error" ? (
        <div className="notice error">
          Assignment update failed. Check the API/auth path and try again.
        </div>
      ) : null}

      <section className="dashboard-grid top-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Inbox</h2>
              <p className="panel-copy">
                Real work items from the API, with status filtering and
                ownership visibility.
              </p>
            </div>
            <form action="/api/intake/sync" method="post">
              <button type="submit" className="button-primary">
                Run intake sync
              </button>
            </form>
          </div>

          <div className="filter-row" aria-label="Status filters">
            {statusOrder.map((status) => {
              const href = status === "all" ? "/" : `/?status=${status}`;
              const count =
                status === "all" ? totalItems : (statusCounts[status] ?? 0);

              return (
                <Link
                  key={status}
                  href={href}
                  className={`filter-chip ${activeStatus === status ? "active" : ""}`}
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
              <p>
                Either the intake is empty, or the API/DB is not returning data
                yet.
              </p>
            </div>
          ) : (
            <div className="stack-list">
              {workItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/work-items/${item.id}`}
                  className="work-item-card"
                >
                  <div className="work-item-main">
                    <div className="work-item-title-row">
                      <strong>{item.title}</strong>
                      <span className={`badge status-${item.status}`}>
                        {labelizeStatus(item.status)}
                      </span>
                    </div>
                    <p className="work-item-meta">
                      {item.customer ?? "Unknown customer"} ·{" "}
                      {item.domain ?? "Unknown domain"}
                    </p>
                    <p className="work-item-meta muted">
                      {item.sourceFolder} · updated {formatDate(item.updatedAt)}
                    </p>
                  </div>
                  <div className="work-item-side">
                    <span className={`badge priority-${item.priority}`}>
                      {item.priority}
                    </span>
                    <span className="muted small-text">
                      {item.assignedTo ?? "Unassigned"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Current intake sources</h2>
          <p className="panel-copy">
            This is the ingestion edge. If items are missing, the problem starts
            here.
          </p>
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
                    <span
                      className={`badge ${item.enabled ? "status-enabled" : "status-disabled"}`}
                    >
                      {item.enabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                  <p className="work-item-meta muted">
                    {item.driveFolderPath ?? "No folder path set"}
                  </p>
                  <div className="source-stats">
                    <span>{item.workItemCount} work items</span>
                    <span>{item.discoveredCount} discovered</span>
                  </div>
                  <p className="work-item-meta muted">
                    Last discovered{" "}
                    {item.lastDiscoveredAt
                      ? formatDate(item.lastDiscoveredAt)
                      : "never"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="panel pipeline-panel">
        <div className="panel-header pipeline-header">
          <div>
            <h2>Pipeline board</h2>
            <p className="panel-copy">
              Real workflow-state columns driven by current work-item status,
              not a fake PM board.
            </p>
          </div>
          <span className="pipeline-total">
            {allWorkItems.length} total items
          </span>
        </div>

        <div className="pipeline-board" aria-label="Pipeline board">
          {boardColumns.map((column) => (
            <section key={column.status} className="pipeline-column">
              <div className="pipeline-column-header">
                <div>
                  <p className="eyebrow">{labelizeStatus(column.status)}</p>
                  <h3>{column.items.length}</h3>
                </div>
                <span className={`badge status-${column.status}`}>
                  {labelizeStatus(column.status)}
                </span>
              </div>

              {column.items.length === 0 ? (
                <div className="empty-state compact-empty pipeline-empty">
                  <p>No items in this state.</p>
                </div>
              ) : (
                <div className="pipeline-card-list">
                  {column.items.map((item) => {
                    const nextStatus = getNextStatus(item.status);
                    const viewerEmail = viewer.user?.email ?? null;
                    const canAssignToMe = Boolean(
                      viewerEmail && item.assignedTo !== viewerEmail,
                    );
                    const canUnassign = Boolean(item.assignedTo);

                    return (
                      <article key={item.id} className="pipeline-card">
                        <Link
                          href={`/work-items/${item.id}`}
                          className="pipeline-card-link"
                        >
                          <div className="pipeline-card-top">
                            <strong>{item.title}</strong>
                            <span className={`badge priority-${item.priority}`}>
                              {item.priority}
                            </span>
                          </div>
                          <p className="work-item-meta">
                            {item.customer ?? "Unknown customer"} ·{" "}
                            {item.domain ?? "Unknown domain"}
                          </p>
                          <p className="work-item-meta muted">
                            {item.sourceFolder} · updated{" "}
                            {formatDate(item.updatedAt)}
                          </p>
                          <div className="pipeline-card-meta">
                            <span className="badge pipeline-owner-badge">
                              {item.assignedTo ?? "Unassigned"}
                            </span>
                            {item.activeWorkflowStepKey ? (
                              <span className="muted small-text">
                                {labelizeStep(item.activeWorkflowStepKey)}
                              </span>
                            ) : null}
                          </div>
                        </Link>
                        {nextStatus ? (
                          <form
                            action={`/api/work-items/${item.id}/status`}
                            method="post"
                            className="pipeline-card-action"
                          >
                            <input
                              type="hidden"
                              name="status"
                              value={nextStatus}
                            />
                            <input type="hidden" name="returnTo" value="/" />
                            <button
                              type="submit"
                              className="button-secondary button-small"
                            >
                              Move to {labelizeStatus(nextStatus)}
                            </button>
                          </form>
                        ) : null}
                        <div className="pipeline-card-actions-row">
                          {canAssignToMe ? (
                            <form
                              action={`/api/work-items/${item.id}/assignment`}
                              method="post"
                              className="pipeline-card-action"
                            >
                              <input
                                type="hidden"
                                name="assignedTo"
                                value={viewerEmail ?? ""}
                              />
                              <input type="hidden" name="returnTo" value="/" />
                              <button
                                type="submit"
                                className="button-secondary button-small"
                              >
                                Assign to me
                              </button>
                            </form>
                          ) : null}
                          {canUnassign ? (
                            <form
                              action={`/api/work-items/${item.id}/assignment`}
                              method="post"
                              className="pipeline-card-action"
                            >
                              <input type="hidden" name="assignedTo" value="" />
                              <input type="hidden" name="returnTo" value="/" />
                              <button
                                type="submit"
                                className="button-secondary button-small"
                              >
                                Unassign
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      </section>

      <section className="dashboard-grid bottom-grid">
        <section className="panel">
          <h2>What this slice already proves</h2>
          <ul className="plain-list">
            <li>UI is reading real intake and work-item data from the API.</li>
            <li>
              Status filtering now makes the inbox usable instead of decorative.
            </li>
            <li>Ownership and priority gaps are visible immediately.</li>
            <li>
              Work item detail pages can now move items through the workflow
              instead of only showing status.
            </li>
            <li>
              The pipeline board now mirrors the real workflow states directly
              from the backend.
            </li>
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

function labelizeStep(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("User Task", "")
    .replaceAll("Gateway", "")
    .trim();
}

function getNextStatus(status: string) {
  const nextByStatus: Record<string, string | null> = {
    new: "triaged",
    triaged: "in_progress",
    in_progress: "review",
    review: "done",
    done: null,
  };

  return nextByStatus[status] ?? null;
}

function labelizeStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
