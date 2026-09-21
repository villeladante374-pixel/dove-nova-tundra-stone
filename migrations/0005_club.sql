create table if not exists club_books (
  id text primary key,
  title text not null,
  author text not null,
  page_count integer not null,
  leather text not null,
  kind text not null,
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

create table if not exists club_meta (
  id text primary key,
  marks_json text not null default '{}',
  profiles_json text not null default '{}',
  saved_at bigint not null
);
