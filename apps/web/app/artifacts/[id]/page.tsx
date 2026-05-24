import Link from "next/link";
import { getArtifact, getWorkItem } from "../../../lib/api";

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artifact = await getArtifact(id);

  if (!artifact) {
    return (
      <main className="page-shell narrow-shell">
        <Link href="/" className="back-link">
          ← Back to inbox
        </Link>
        <section className="panel empty-state">
          <h1>Artifact not found</h1>
          <p>The API did not return an artifact for this ID.</p>
        </section>
      </main>
    );
  }

  const workItem = await getWorkItem(artifact.workItemId);

  return (
    <main className="page-shell narrow-shell">
      <div className="detail-header-row">
        <div>
          <Link
            href={workItem ? `/work-items/${workItem.id}` : "/"}
            className="back-link"
          >
            ← Back
          </Link>
          <p className="eyebrow">Artifact</p>
          <h1 className="detail-title">{labelize(artifact.artifactType)}</h1>
          <p className="hero-copy detail-copy">
            {workItem ? workItem.title : "Unlinked work item"} · version{" "}
            {artifact.version}
          </p>
        </div>
        <div className="detail-badges">
          <span className="badge">{artifact.storageBackend}</span>
          <span className="badge">v{artifact.version}</span>
        </div>
      </div>

      <section className="dashboard-grid detail-grid">
        <section className="panel">
          <h2>Artifact metadata</h2>
          <div className="detail-list">
            <DetailRow
              label="Artifact type"
              value={labelize(artifact.artifactType)}
            />
            <DetailRow
              label="Storage backend"
              value={artifact.storageBackend}
            />
            <DetailRow
              label="Storage path"
              value={artifact.storagePath ?? "Not set"}
            />
            <DetailRow
              label="Drive file ID"
              value={artifact.driveFileId ?? "Not set"}
            />
            <DetailRow label="Created" value={formatDate(artifact.createdAt)} />
          </div>
          {artifact.storageBackend === "local" && artifact.storagePath ? (
            <p className="muted small-text">
              Local renderer output: {artifact.storagePath}
            </p>
          ) : null}
        </section>

        <section className="panel">
          <h2>Linked work item</h2>
          {workItem ? (
            <div className="detail-list">
              <DetailRow label="Title" value={workItem.title} />
              <DetailRow label="Status" value={labelize(workItem.status)} />
              <DetailRow
                label="Customer"
                value={workItem.customer ?? "Unknown customer"}
              />
              <DetailRow
                label="Domain"
                value={workItem.domain ?? "Unknown domain"}
              />
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <p>Work item lookup failed for this artifact.</p>
            </div>
          )}
        </section>
      </section>
    </main>
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

function labelize(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
