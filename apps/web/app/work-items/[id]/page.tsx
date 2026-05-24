import Link from "next/link";
import {
  getArtifacts,
  getAuditEvents,
  getComments,
  getTasks,
  getWorkItem,
  type Comment,
  type WorkflowTask,
} from "../../../lib/api";
import { getViewer } from "../../../lib/auth";

export default async function WorkItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    rendered?: string;
    statusChange?: string;
    taskComplete?: string;
    classified?: string;
    commentCreate?: string;
    replyTo?: string;
  }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const [item, auditEvents, artifacts, tasks, comments, viewer] =
    await Promise.all([
      getWorkItem(id),
      getAuditEvents(id),
      getArtifacts(id),
      getTasks(id),
      getComments(id),
      getViewer(),
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
  const failureEvents = auditEvents.filter((event) =>
    isFailureEvent(event.eventType),
  );
  const latestFailure = failureEvents[0] ?? null;
  const openTasks = tasks.filter((task) => task.status === "open");
  const replyTarget =
    typeof resolvedSearchParams.replyTo === "string"
      ? (comments.find(
          (comment) => comment.id === resolvedSearchParams.replyTo,
        ) ?? null)
      : null;
  const commentThreads = buildCommentThreads(comments);
  const canRenderPdf =
    item.sourceType === "drive-file" && /\.ya?ml$/i.test(item.title);

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
            {item.customer ?? "Unknown customer"} ·{" "}
            {item.domain ?? "Unknown domain"}
          </p>
        </div>
        <div className="detail-badges">
          <span className={`badge status-${item.status}`}>
            {labelizeStatus(item.status)}
          </span>
          <span className={`badge priority-${item.priority}`}>
            {item.priority}
          </span>
        </div>
      </div>

      {resolvedSearchParams.rendered === "ok" ? (
        <div className="notice success">
          PDF render finished. Refresh again if you want to confirm the newest
          artifact version in the list.
        </div>
      ) : null}
      {resolvedSearchParams.rendered === "error" ? (
        <div className="notice error">
          PDF render failed. Check the latest audit event for the error message,
          then retry.
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
      {resolvedSearchParams.taskComplete === "ok" ? (
        <div className="notice success">Workflow task completed.</div>
      ) : null}
      {resolvedSearchParams.taskComplete === "error" ? (
        <div className="notice error">
          Workflow task completion failed. Refresh and try again.
        </div>
      ) : null}
      {resolvedSearchParams.classified === "ok" ? (
        <div className="notice success">Intake classification job ran.</div>
      ) : null}
      {resolvedSearchParams.classified === "error" ? (
        <div className="notice error">Intake classification job failed.</div>
      ) : null}
      {resolvedSearchParams.commentCreate === "ok" ? (
        <div className="notice success">Comment posted.</div>
      ) : null}
      {resolvedSearchParams.commentCreate === "error" ? (
        <div className="notice error">
          Comment could not be posted. Check the body and try again.
        </div>
      ) : null}
      {latestFailure ? (
        <div className="notice error">
          Latest failure: {getFailureHeadline(latestFailure)}
        </div>
      ) : null}

      <section className="dashboard-grid detail-grid">
        <section className="panel">
          <h2>Workflow snapshot</h2>
          <div className="meta-grid">
            <MetaBlock
              label="Assigned to"
              value={item.assignedTo ?? "Unassigned"}
            />
            <MetaBlock
              label="Workflow run"
              value={item.activeWorkflowRunId ?? "Not started"}
            />
            <MetaBlock
              label="Run status"
              value={item.activeWorkflowRunStatus ?? "Not started"}
            />
            <MetaBlock
              label="Current step"
              value={
                item.activeWorkflowStepKey
                  ? labelizeStatus(item.activeWorkflowStepKey)
                  : "Not started"
              }
            />
            <MetaBlock
              label="Step type"
              value={item.activeWorkflowStepType ?? "n/a"}
            />
            <MetaBlock
              label="Flowable instance"
              value={item.processInstanceId ?? "Not linked yet"}
            />
            <MetaBlock label="Source folder" value={item.sourceFolder} />
            <MetaBlock label="Source type" value={item.sourceType} />
            <MetaBlock label="Created" value={formatDate(item.createdAt)} />
            <MetaBlock label="Updated" value={formatDate(item.updatedAt)} />
            <MetaBlock
              label="Latest event"
              value={
                latestEvent
                  ? labelizeStatus(latestEvent.eventType)
                  : "No events"
              }
            />
            <MetaBlock
              label="Latest failure"
              value={
                latestFailure
                  ? formatFailureTime(latestFailure.createdAt)
                  : "No failed jobs"
              }
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 12 }}>Current user tasks</h3>
            {openTasks.length === 0 ? (
              <p className="muted small-text">
                No open workflow tasks for this item.
              </p>
            ) : (
              <div className="timeline-list">
                {openTasks.map((task) => (
                  <article key={task.id} className="timeline-card">
                    <div className="timeline-card-top">
                      <strong>{getTaskTitle(task)}</strong>
                      <span className="badge status-review">open</span>
                    </div>
                    <p className="work-item-meta">
                      Type: {labelizeStatus(task.taskType)}
                    </p>
                    <p className="work-item-meta muted">
                      {task.assignedTo ?? "Unassigned"} · created{" "}
                      {formatDate(task.createdAt)}
                    </p>
                    <form
                      action={`/api/work-items/${item.id}/tasks/${task.id}/complete`}
                      method="post"
                      style={{ marginTop: 12 }}
                    >
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
            <DetailRow
              label="Customer"
              value={item.customer ?? "Unknown customer"}
            />
            <DetailRow label="Domain" value={item.domain ?? "Unknown domain"} />
          </div>
          <div className="action-row">
            {item.sourceLink ? (
              <a
                href={item.sourceLink}
                target="_blank"
                rel="noreferrer"
                className="button-secondary"
              >
                Open source file
              </a>
            ) : (
              <span className="muted small-text">No source link yet</span>
            )}
            <form
              action={`/api/work-items/${item.id}/classify-intake`}
              method="post"
            >
              <button type="submit" className="button-secondary">
                Run intake classification
              </button>
            </form>
            {canRenderPdf ? (
              <form
                action={`/api/work-items/${item.id}/render-pdf`}
                method="post"
              >
                <button type="submit" className="button-primary">
                  Render PDF
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="section-title-row">
          <div>
            <h2>Failed jobs</h2>
            <p className="muted small-text">
              Real operator-visible failures from audit events.
            </p>
          </div>
          <span
            className={`badge ${failureEvents.length ? "status-blocked" : "status-done"}`}
          >
            {failureEvents.length} failure
            {failureEvents.length === 1 ? "" : "s"}
          </span>
        </div>

        {failureEvents.length === 0 ? (
          <div className="empty-state compact-empty">
            <p>No failed jobs recorded for this work item.</p>
          </div>
        ) : (
          <div className="timeline-list">
            {failureEvents.map((event) => (
              <article key={event.id} className="timeline-card failure-card">
                <div className="timeline-card-top">
                  <strong>{getFailureHeadline(event)}</strong>
                  <span className="muted small-text">
                    {formatDate(event.createdAt)}
                  </span>
                </div>
                <p className="work-item-meta">
                  Actor: {event.actor ?? "system"}
                </p>
                <p className="work-item-meta muted">
                  {getFailureSummary(event)}
                </p>
                {getFailureDetails(event).length > 0 ? (
                  <ul className="plain-list compact-list">
                    {getFailureDetails(event).map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
                {event.payload ? (
                  <details className="failure-payload-toggle">
                    <summary>Raw payload</summary>
                    <pre className="payload-block">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="section-title-row">
          <div>
            <h2>Comments</h2>
            <p className="muted small-text">
              Keep review notes on the work item instead of hiding them in chat.
            </p>
          </div>
          <span className="badge">
            {comments.length} comment{comments.length === 1 ? "" : "s"}
          </span>
        </div>

        <form
          action={`/api/work-items/${item.id}/comments`}
          method="post"
          className="comment-form"
        >
          <input
            type="hidden"
            name="parentCommentId"
            value={replyTarget?.id ?? ""}
          />
          <div className="comment-form-header">
            <strong>
              {replyTarget
                ? `Replying to ${replyTarget.author}`
                : "Add comment"}
            </strong>
            <span className="muted small-text">
              {viewer.user?.email ?? viewer.user?.name ?? "system"}
            </span>
          </div>
          {replyTarget ? (
            <div className="reply-target-card">
              <p className="work-item-meta muted">{replyTarget.author}</p>
              <p className="comment-body">{replyTarget.body}</p>
              <Link
                href={`/work-items/${item.id}`}
                className="back-link inline-link"
              >
                Cancel reply
              </Link>
            </div>
          ) : null}
          <textarea
            name="body"
            rows={replyTarget ? 4 : 5}
            className="comment-textarea"
            placeholder={
              replyTarget
                ? "Write the reply that should live with the work item."
                : "Write a comment that helps the next operator."
            }
            required
          />
          <div className="action-row">
            <button type="submit" className="button-primary">
              {replyTarget ? "Post reply" : "Post comment"}
            </button>
          </div>
        </form>

        {commentThreads.length === 0 ? (
          <div className="empty-state compact-empty">
            <p>No comments yet.</p>
          </div>
        ) : (
          <div className="timeline-list" style={{ marginTop: 18 }}>
            {commentThreads.map((comment) => (
              <article
                key={comment.id}
                className={`timeline-card comment-card ${comment.parentCommentId ? "comment-reply-card" : ""}`}
              >
                <div className="timeline-card-top">
                  <strong>{comment.author}</strong>
                  <span className="muted small-text">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                {comment.parentCommentId && comment.parentAuthor ? (
                  <p className="work-item-meta muted">
                    Reply to {comment.parentAuthor}
                  </p>
                ) : null}
                <p className="comment-body">{comment.body}</p>
                <div className="action-row">
                  <Link
                    href={`/work-items/${item.id}?replyTo=${comment.id}`}
                    className="button-secondary"
                  >
                    Reply
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
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
                <Link
                  key={artifact.id}
                  href={`/artifacts/${artifact.id}`}
                  className="work-item-card artifact-card"
                >
                  <div className="work-item-main">
                    <div className="work-item-title-row">
                      <strong>{labelizeStatus(artifact.artifactType)}</strong>
                      <span className="badge">v{artifact.version}</span>
                    </div>
                    <p className="work-item-meta">{artifact.storageBackend}</p>
                    <p className="work-item-meta muted">
                      {artifact.storagePath ??
                        artifact.driveFileId ??
                        "No storage path yet"}
                    </p>
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
                    <span className="muted small-text">
                      {formatDate(event.createdAt)}
                    </span>
                  </div>
                  <p className="work-item-meta">
                    Actor: {event.actor ?? "system"}
                  </p>
                  {event.payload ? (
                    <pre className="payload-block">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
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
          <li>
            Real Flowable process-instance creation and task completion instead
            of DB-only mirrored workflow state
          </li>
          <li>
            Manual generation actions for KISS / final design / OpenAPI drafts
          </li>
          <li>Review handoff path instead of DB-only task completion</li>
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
  return value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getTaskTitle(task: WorkflowTask) {
  if (typeof task.title === "string" && task.title) {
    return task.title;
  }

  const payloadTitle =
    typeof task.payload?.title === "string" ? task.payload.title : null;
  if (payloadTitle) {
    return payloadTitle;
  }

  return labelizeStatus(task.taskType);
}

function getCompletionLabel(task: WorkflowTask) {
  switch (task.taskType) {
    case "triage":
      return "Complete triage";
    case "produce_artifacts":
      return "Mark artifacts ready for review";
    case "review_and_approve":
      return "Approve and move forward";
    default:
      return "Complete task";
  }
}

function isFailureEvent(eventType: string) {
  return eventType === "task.failed" || eventType === "pdf.render_failed";
}

function getFailureHeadline(event: {
  eventType: string;
  payload: Record<string, unknown> | null;
}) {
  const message = getPayloadString(event.payload, "message");
  if (message) {
    return message;
  }

  return labelizeStatus(event.eventType);
}

function getFailureSummary(event: {
  eventType: string;
  payload: Record<string, unknown> | null;
}) {
  const taskType = getPayloadString(event.payload, "taskType");
  const taskId = getPayloadString(event.payload, "taskId");
  const workflowRunId = getPayloadString(event.payload, "workflowRunId");

  const parts = [
    taskType ? `Task: ${labelizeStatus(taskType)}` : null,
    taskId ? `Task ID: ${taskId}` : null,
    workflowRunId ? `Run: ${workflowRunId}` : null,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(" · ")
    : "Check the payload for exact worker/job context.";
}

function getFailureDetails(event: { payload: Record<string, unknown> | null }) {
  return ["error", "reason", "stderr", "jobId", "externalRef"]
    .map((key) => {
      const value = getPayloadString(event.payload, key);
      return value ? `${labelizeStatus(key)}: ${value}` : null;
    })
    .filter((value): value is string => Boolean(value));
}

function getPayloadString(
  payload: Record<string, unknown> | null,
  key: string,
) {
  const value = payload?.[key];
  return typeof value === "string" && value ? value : null;
}

function formatFailureTime(value: string) {
  return formatDate(value);
}

function buildCommentThreads(comments: Comment[]) {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));

  return [...comments]
    .sort((a, b) => {
      if (a.parentCommentId === b.id) {
        return 1;
      }

      if (b.parentCommentId === a.id) {
        return -1;
      }

      const rootA = a.parentCommentId
        ? (byId.get(a.parentCommentId)?.createdAt ?? a.createdAt)
        : a.createdAt;
      const rootB = b.parentCommentId
        ? (byId.get(b.parentCommentId)?.createdAt ?? b.createdAt)
        : b.createdAt;

      if (rootA !== rootB) {
        return rootA.localeCompare(rootB);
      }

      return a.createdAt.localeCompare(b.createdAt);
    })
    .map((comment) => ({
      ...comment,
      parentAuthor: comment.parentCommentId
        ? (byId.get(comment.parentCommentId)?.author ?? null)
        : null,
    }));
}
