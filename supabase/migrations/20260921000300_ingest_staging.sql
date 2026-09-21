-- Staging table for loading large save_job payloads in chunks (used by the
-- offline seed path when the app environment cannot reach Supabase directly).
create table if not exists public.ingest_staging (
  key   text not null,
  seq   integer not null,
  chunk text not null,
  primary key (key, seq)
);
alter table public.ingest_staging enable row level security;

create or replace function public.save_job_from_staging(p_key text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb;
  v_job_id  uuid;
begin
  select string_agg(chunk, '' order by seq)::jsonb into v_payload
    from public.ingest_staging where key = p_key;
  if v_payload is null then
    raise exception 'no staged payload for key %', p_key;
  end if;
  v_job_id := public.save_job(v_payload);
  delete from public.ingest_staging where key = p_key;
  return v_job_id;
end;
$$;
revoke all on function public.save_job_from_staging(text) from public, anon, authenticated;
