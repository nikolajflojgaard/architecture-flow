export type WorkItem = {
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

export type AuditEvent = {
  id: string;
  eventType: string;
  actor: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type IntakeSource = {
  id: string;
  displayName: string;
  driveFolderPath: string | null;
  enabled: boolean;
  workItemCount: number;
  discoveredCount: number;
  lastDiscoveredAt: string | null;
};

export type Artifact = {
  id: string;
  workItemId: string;
  artifactType: string;
  storageBackend: string;
  storagePath: string | null;
  driveFileId: string | null;
  version: number;
  createdAt: string;
};

export type WorkflowTask = {
  id: string;
  workItemId: string;
  workflowRunId: string | null;
  taskType: string;
  assignedTo: string | null;
  status: string;
  payload: Record<string, unknown> | null;
  dueAt: string | null;
  createdAt: string;
};

export const workflowStatuses = ['new', 'triaged', 'in_progress', 'review', 'done'] as const;
export type WorkflowStatus = (typeof workflowStatuses)[number];

const baseUrl = process.env.ARCHITECTURE_FLOW_API_URL ?? 'http://localhost:4000';

export async function getWorkItems(status?: string, limit = 50): Promise<WorkItem[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', String(limit));

  if (status && status !== 'all') {
    searchParams.set('status', status);
  }

  try {
    const response = await fetch(`${baseUrl}/v1/work-items?${searchParams.toString()}`, {
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

export async function getWorkItem(id: string): Promise<WorkItem | null> {
  try {
    const response = await fetch(`${baseUrl}/v1/work-items/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { item?: WorkItem | null };
    return payload.item ?? null;
  } catch {
    return null;
  }
}

export async function getAuditEvents(id: string): Promise<AuditEvent[]> {
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

export async function getArtifacts(workItemId: string): Promise<Artifact[]> {
  try {
    const response = await fetch(`${baseUrl}/v1/work-items/${workItemId}/artifacts`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { items?: Artifact[] };
    return payload.items ?? [];
  } catch {
    return [];
  }
}

export async function getTasks(workItemId: string): Promise<WorkflowTask[]> {
  try {
    const response = await fetch(`${baseUrl}/v1/work-items/${workItemId}/tasks`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { items?: WorkflowTask[] };
    return payload.items ?? [];
  } catch {
    return [];
  }
}

export async function getArtifact(id: string): Promise<Artifact | null> {
  try {
    const response = await fetch(`${baseUrl}/v1/artifacts/${id}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { item?: Artifact | null };
    return payload.item ?? null;
  } catch {
    return null;
  }
}

export async function getIntakeSources(): Promise<IntakeSource[]> {
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
