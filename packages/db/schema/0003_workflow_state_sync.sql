alter table workflow_runs
  add column if not exists current_step_key text,
  add column if not exists current_step_type text,
  add column if not exists payload_json jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table tasks
  add column if not exists title text,
  add column if not exists external_ref text,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_workflow_runs_work_item_active on workflow_runs(work_item_id, ended_at);
create index if not exists idx_tasks_workflow_run on tasks(workflow_run_id);
create index if not exists idx_tasks_external_ref on tasks(external_ref);
