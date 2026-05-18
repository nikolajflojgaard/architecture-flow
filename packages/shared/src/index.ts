export const intakeSources = ['General designs', 'API spec drop/YAML'] as const;

export const intakeSourceKeys = ['general-designs', 'api-spec-drop-yaml'] as const;

export const workflowStatuses = ['new', 'triaged', 'in_progress', 'review', 'done'] as const;
export type WorkflowStatus = (typeof workflowStatuses)[number];

export const serviceTaskTopics = ['intake.classify', 'artifact.render-pdf'] as const;
export type ServiceTaskTopic = (typeof serviceTaskTopics)[number];
