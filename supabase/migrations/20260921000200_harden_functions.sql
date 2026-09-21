-- Pin search_path on our functions (Supabase linter 0011) and keep RPCs
-- server-side only: the app calls them with the service role key.
alter function public.jobs_fts_update() set search_path = public, pg_temp;
alter function public.match_jobs(jsonb, vector, text, integer) set search_path = public, pg_temp;
alter function public.save_job(jsonb) set search_path = public, pg_temp;

revoke all on function public.match_jobs(jsonb, vector, text, integer) from public, anon, authenticated;
