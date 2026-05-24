alter table comments
  add column if not exists parent_comment_id uuid references comments(id) on delete cascade;

create index if not exists idx_comments_work_item_created_at
  on comments(work_item_id, created_at);

create index if not exists idx_comments_parent_comment_id
  on comments(parent_comment_id);
