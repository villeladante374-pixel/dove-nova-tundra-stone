create table if not exists vault_marks (
  user_id text primary key,
  scores_json text not null default '{}',
  spots_json text not null default '{}',
  updated_at bigint not null
);
