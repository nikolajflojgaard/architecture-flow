export const intakeSources = ['General designs', 'API spec drop/YAML'] as const;

export const intakeSourceKeys = ['general-designs', 'api-spec-drop-yaml'] as const;

export type WorkflowStatus =
  | 'new'
  | 'triaged'
  | 'in_progress'
  | 'waiting_review'
  | 'blocked'
  | 'done';
