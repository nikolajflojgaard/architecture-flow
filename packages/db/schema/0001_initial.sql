create table if not exists work_items (
  id uuid primary key,
  title text not null,
  source_type text not null,
  source_folder text not null,
  source_file_id text not null unique,
  source_link text,
  customer text,
  domain text,
  workflow_status text not null default 'new',
  priority text not null default 'normal',
  assigned_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artifacts (
  id uuid primary key,
  work_item_id uuid not null references work_items(id) on delete cascade,
  artifact_type text not null,
  storage_backend text not null,
  storage_path text,
  drive_file_id text,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists workflow_runs (
  id uuid primary key,
  work_item_id uuid not null references work_items(id) on delete cascade,
  process_definition_key text not null,
  process_instance_id text,
  status text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists tasks (
  id uuid primary key,
  work_item_id uuid not null references work_items(id) on delete cascade,
  workflow_run_id uuid references workflow_runs(id) on delete set null,
  task_type text not null,
  assigned_to text,
  status text not null,
  payload_json jsonb,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists comments (
  id uuid primary key,
  work_item_id uuid not null references work_items(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key,
  work_item_id uuid not null references work_items(id) on delete cascade,
  event_type text not null,
  actor text,
  payload_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_items_status on work_items(workflow_status);
create index if not exists idx_work_items_source_folder on work_items(source_folder);
create index if not exists idx_artifacts_work_item on artifacts(work_item_id);
create index if not exists idx_tasks_work_item on tasks(work_item_id);
create index if not exists idx_audit_events_work_item on audit_events(work_item_id);
