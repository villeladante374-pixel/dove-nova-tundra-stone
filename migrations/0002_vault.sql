create table if not exists vault_books (
  id text primary key,
  user_id text not null,
  title text not null,
  author text not null,
  page_count integer not null,
  leather text not null,
  kind text not null,
  manuscript_key text,
  has_cover boolean not null default false,
  has_hover_video boolean not null default false,
  file_size integer,
  created_at bigint not null,
  pdf_b64 text,
  cover_b64 text,
  cover_mime text,
  video_b64 text,
  video_mime text
);
create index if not exists vault_books_user_id_idx on vault_books (user_id);
