create table if not exists intake_sources (
  id uuid primary key,
  source_key text not null unique,
  source_type text not null,
  display_name text not null,
  drive_root_name text,
  drive_folder_path text,
  drive_folder_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists intake_events (
  id uuid primary key,
  intake_source_id uuid not null references intake_sources(id) on delete cascade,
  work_item_id uuid references work_items(id) on delete set null,
  source_file_id text not null,
  event_type text not null,
  payload_json jsonb,
  created_at timestamptz not null default now(),
  unique (source_file_id, event_type)
);

create index if not exists idx_intake_sources_source_key on intake_sources(source_key);
create index if not exists idx_intake_events_source on intake_events(intake_source_id);
create index if not exists idx_intake_events_work_item on intake_events(work_item_id);
