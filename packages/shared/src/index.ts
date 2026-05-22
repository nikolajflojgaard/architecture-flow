export const intakeSources = ['General designs', 'API spec drop/YAML'] as const;

export const intakeSourceKeys = ['general-designs', 'api-spec-drop-yaml'] as const;

export const workflowStatuses = ['new', 'triaged', 'in_progress', 'review', 'done'] as const;
export type WorkflowStatus = (typeof workflowStatuses)[number];

export const serviceTaskTopics = ['intake.classify', 'artifact.render-pdf'] as const;
export type ServiceTaskTopic = (typeof serviceTaskTopics)[number];

export type IntakeMetadataInput = {
  sourceFolder: string;
  title: string;
  existingCustomer?: string | null;
  existingDomain?: string | null;
  existingPriority?: string | null;
};

export type IntakeMetadataInference = {
  customer: string | null;
  domain: string | null;
  priority: string;
  sourceType: string | null;
  isApiRelated: boolean;
  matchedRules: string[];
};

const customerRules: Array<{ name: string; matches: (text: string) => boolean; customer: string }> = [
  { name: 'customer:tdc-net', matches: (text) => /\btdc\s*net\b|\btdc\b/.test(text), customer: 'TDC NET' },
  { name: 'customer:bpi', matches: (text) => /\bbpi\b/.test(text), customer: 'TDC NET' },
  { name: 'customer:yousee', matches: (text) => /\byousee\b/.test(text), customer: 'YouSee' },
  { name: 'customer:nuuday', matches: (text) => /\bnuuday\b/.test(text), customer: 'Nuuday' },
];

const domainRules: Array<{ name: string; matches: (text: string) => boolean; domain: string }> = [
  { name: 'domain:customer-platform', matches: (text) => /customer|address|myview|crm|salesforce|account/.test(text), domain: 'Customer platform' },
  { name: 'domain:integration', matches: (text) => /integration|api|yaml|openapi|swagger|json|xml/.test(text), domain: 'Integration / API' },
  { name: 'domain:billing', matches: (text) => /billing|invoice|payment|financ|bogholder|fas/.test(text), domain: 'Billing / Finance' },
  { name: 'domain:network', matches: (text) => /network|fiber|access|infra|provision/.test(text), domain: 'Network / Provisioning' },
];

export function inferIntakeMetadata(input: IntakeMetadataInput): IntakeMetadataInference {
  const normalizedFolder = input.sourceFolder.trim();
  const normalizedTitle = input.title.trim();
  const haystack = `${normalizedFolder} ${normalizedTitle}`.toLowerCase();
  const matchedRules: string[] = [];

  const isYaml = /\.ya?ml$/i.test(normalizedTitle);
  const isApiFolder = normalizedFolder === 'API spec drop/YAML';
  const isApiRelated = isYaml || isApiFolder || /\bapi\b|openapi|swagger/.test(haystack);

  let customer = input.existingCustomer ?? null;
  let domain = input.existingDomain ?? null;

  for (const rule of customerRules) {
    if (rule.matches(haystack)) {
      customer = rule.customer;
      matchedRules.push(rule.name);
      break;
    }
  }

  if (!customer && (normalizedFolder === 'General designs' || normalizedFolder === 'API spec drop/YAML')) {
    customer = 'TDC NET';
    matchedRules.push('customer:default-data-net');
  }

  for (const rule of domainRules) {
    if (rule.matches(haystack)) {
      domain = rule.domain;
      matchedRules.push(rule.name);
      if (rule.domain === 'Customer platform' && /\bfas\b/.test(haystack)) {
        domain = 'Billing / Finance';
        matchedRules.push('domain:fas-override');
      }
      break;
    }
  }

  if (!domain && isApiRelated) {
    domain = 'Integration / API';
    matchedRules.push('domain:default-api');
  }

  if (!domain && normalizedFolder === 'General designs') {
    domain = 'Architecture / Integration';
    matchedRules.push('domain:default-general-designs');
  }

  let priority = input.existingPriority ?? 'normal';
  if (isYaml) {
    priority = 'high';
    matchedRules.push('priority:yaml-high');
  } else if (/urgent|asap|critical|prio\s*1|p1/.test(haystack)) {
    priority = 'high';
    matchedRules.push('priority:keyword-high');
  }

  return {
    customer,
    domain,
    priority,
    sourceType: isYaml && isApiFolder ? 'yaml-drop' : null,
    isApiRelated,
    matchedRules,
  };
}
