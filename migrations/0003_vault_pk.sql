alter table if exists vault_books drop constraint if exists vault_books_pkey;
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'vault_books'
  ) and not exists (
    select 1 from pg_constraint
    where conrelid = 'vault_books'::regclass and contype = 'p'
  ) then
    alter table vault_books add primary key (user_id, id);
  end if;
end $$;
