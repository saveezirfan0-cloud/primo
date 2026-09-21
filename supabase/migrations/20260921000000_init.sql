-- Primo Estimator — initial schema (demo)
-- All money is AUD ex GST, numeric(12,2).

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- jobs: one row per past quote revision. 6570's PDF and expanded .docx are the
-- same job (same job_number), stored as separate revisions.
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id                uuid primary key default gen_random_uuid(),
  job_number        text not null,
  revision          integer not null default 1,
  title             text not null,
  client_org        text,
  site_suburb       text,
  issued_on         date,
  status            text not null default 'active',          -- active | superseded
  structure         text,                                     -- sections | stages | single
  room_type         text,                                     -- hall | auditorium | classroom | ...
  install_type      text,                                     -- upgrade | new
  subtotal_ex_gst   numeric(12,2),
  params            jsonb not null default '{}'::jsonb,
  scope_text        text,
  assumptions       text[] not null default '{}',
  exclusions        text[] not null default '{}',
  has_labour_detail boolean not null default false,
  is_holdout        boolean not null default false,           -- excluded from matching + price book
  embedding         vector(1024),
  fts               tsvector,
  created_at        timestamptz not null default now(),
  unique (job_number, revision)
);

create index if not exists jobs_fts_idx on public.jobs using gin (fts);
create index if not exists jobs_room_type_idx on public.jobs (room_type);
create index if not exists jobs_embedding_idx on public.jobs
  using hnsw (embedding vector_cosine_ops);

-- Full-text column maintained by trigger: title, client, suburb, scope,
-- assumptions, exclusions and a flattened "key value" rendering of params.
create or replace function public.jobs_fts_update() returns trigger
language plpgsql as $$
declare
  params_text text;
begin
  select string_agg(key || ' ' || coalesce(value #>> '{}', ''), ' ')
    into params_text
    from jsonb_each(coalesce(new.params, '{}'::jsonb));

  new.fts :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.client_org, '') || ' ' || coalesce(new.site_suburb, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(params_text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.scope_text, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce(new.assumptions, '{}'), ' ') || ' ' ||
                                     array_to_string(coalesce(new.exclusions, '{}'), ' ')), 'D');
  return new;
end;
$$;

drop trigger if exists jobs_fts_trigger on public.jobs;
create trigger jobs_fts_trigger
  before insert or update of title, client_org, site_suburb, params, scope_text, assumptions, exclusions
  on public.jobs
  for each row execute function public.jobs_fts_update();

-- ---------------------------------------------------------------------------
-- sections: Video / Audio / Control, Stage 1..n, or a single section.
-- ---------------------------------------------------------------------------
create table if not exists public.sections (
  id      uuid primary key default gen_random_uuid(),
  job_id  uuid not null references public.jobs (id) on delete cascade,
  name    text not null,
  kind    text not null default 'system',                     -- system | stage | single
  sort    integer not null default 0,
  total   numeric(12,2)
);
create index if not exists sections_job_idx on public.sections (job_id, sort);

-- ---------------------------------------------------------------------------
-- line_items: BOM rows. parent_id links children to their roll-up parent in
-- expanded exports; children replace parents when summing.
-- grp: EQUIPMENT | CABLING | CONS | FREIGHT | SERVICES
-- ---------------------------------------------------------------------------
create table if not exists public.line_items (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.sections (id) on delete cascade,
  parent_id   uuid references public.line_items (id) on delete cascade,
  grp         text not null,
  code        text,                                           -- roll-up code e.g. CABLING, CONS, FREIGHT, SERVICES
  part_number text,                                           -- OFE / CUSTOM / vendor part
  description text not null,
  qty         numeric(12,3) not null default 1,
  unit_price  numeric(12,2),
  total       numeric(12,2),
  is_existing boolean not null default false,                 -- OFE (owner-furnished / retained)
  activity    text,                                           -- labour activity code: INSTALL, DE-COMM, ENGINEER, ...
  hours       numeric(10,2),                                  -- derived: total / rate when a rate_card rate fits
  rate        numeric(10,2),
  sort        integer not null default 0
);
create index if not exists line_items_section_idx on public.line_items (section_id, sort);
create index if not exists line_items_parent_idx on public.line_items (parent_id);
create index if not exists line_items_part_idx on public.line_items (part_number);

-- ---------------------------------------------------------------------------
-- optional_items: "+$" items listed after Summary Pricing.
-- ---------------------------------------------------------------------------
create table if not exists public.optional_items (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  description text not null,
  part_number text,
  qty         numeric(12,3) not null default 1,
  unit_price  numeric(12,2),
  total       numeric(12,2),
  sort        integer not null default 0
);
create index if not exists optional_items_job_idx on public.optional_items (job_id, sort);

-- ---------------------------------------------------------------------------
-- documents: uploaded files + extraction / validation results.
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid references public.jobs (id) on delete set null,
  kind          text not null,                                -- pdf | docx | schematic
  storage_path  text not null,                                -- path in the "documents" bucket
  file_name     text not null,
  extraction    jsonb,
  validation    jsonb,
  status        text not null default 'uploaded',             -- uploaded | extracted | confirmed | failed
  created_at    timestamptz not null default now()
);
create index if not exists documents_job_idx on public.documents (job_id);

-- ---------------------------------------------------------------------------
-- parts: price book. Latest price wins.
-- ---------------------------------------------------------------------------
create table if not exists public.parts (
  part_number text primary key,
  description text,
  brand       text,
  category    text,
  last_price  numeric(12,2),
  last_seen   date,
  times_used  integer not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists parts_description_trgm_idx on public.parts using gin (description gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- rate_card: hourly sell rates per labour activity (hypothesis from 6570).
-- unit = hour  -> value is hours x rate
-- unit = item  -> value is a dollar amount per item / event (no rate)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_card (
  code        text primary key,
  label       text not null,
  rate        numeric(10,2),
  unit        text not null default 'hour',                   -- hour | item
  notes       text,
  updated_at  timestamptz not null default now()
);

insert into public.rate_card (code, label, rate, unit, notes) values
  ('INSTALL',         'Installation',                 95.10, 'hour', 'Hypothesis from 6570: 47.55 = 0.5h, 57.06 = 0.6h, 190.20 = 2h per speaker. Verify with estimator.'),
  ('CABLING-INSTALL', 'Cabling installation',         95.10, 'hour', 'Hypothesis from 6570: 9.51/m = 0.1h per metre.'),
  ('DE-COMM',         'Decommissioning',               null, 'item', 'Observed values (30.91, 61.82) do not divide cleanly by 95.10; treated as a dollar amount per item until verified with the estimator.'),
  ('RACK-BUILD',      'Rack build',                   95.10, 'hour', 'Assumed same trade rate as INSTALL. Unverified.'),
  ('ENGINEER',        'Engineering / design',        138.00, 'hour', 'Hypothesis from 6570: 552 = 4h, 1656 = 12h.'),
  ('DOCUMENT',        'Documentation',               138.00, 'hour', 'Hypothesis from 6570.'),
  ('COMMISSION',      'Commissioning',               138.00, 'hour', 'Hypothesis from 6570: 103.50 = 0.75h.'),
  ('TRAIN',           'Training',                    138.00, 'hour', 'Hypothesis from 6570.'),
  ('O&M',             'O&M manuals',                 138.00, 'hour', 'Hypothesis from 6570.'),
  ('PROGRAM',         'Programming',                 144.00, 'hour', 'Hypothesis from 6570: 1152 = 8h, 1728 = 12h.'),
  ('WORKSHOP',        'Workshop',                    144.00, 'hour', 'Hypothesis from 6570: 288 = 2h.'),
  ('PROJECT-MANAGE',  'Project management',          156.00, 'hour', 'Hypothesis from 6570: 624 = 4h, 2496 = 16h.'),
  ('RUBBISH',         'Rubbish removal',              null,  'item', 'Dollar amount per job.'),
  ('EWASTE',          'E-waste disposal',             null,  'item', 'Dollar amount per job.'),
  ('PARKING',         'Parking',                      null,  'item', 'Dollar amount per job.'),
  ('TRAVEL+ACCOMM',   'Travel and accommodation',     null,  'item', 'Dollar amount per job.'),
  ('ACCESS',          'Access equipment (EWP / scissor lift hire)', null, 'item', 'Dollar amount per hire.')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- labour_standards: hours per part number (or per category) per activity.
-- ---------------------------------------------------------------------------
create table if not exists public.labour_standards (
  id            uuid primary key default gen_random_uuid(),
  part_number   text references public.parts (part_number) on delete cascade,
  category      text,
  activity      text not null references public.rate_card (code),
  hours         numeric(10,2) not null,
  sample_count  integer not null default 1,
  updated_at    timestamptz not null default now(),
  check (part_number is not null or category is not null)
);
create unique index if not exists labour_standards_part_activity_idx
  on public.labour_standards (part_number, activity) where part_number is not null;
create unique index if not exists labour_standards_category_activity_idx
  on public.labour_standards (category, activity) where part_number is null;

-- ---------------------------------------------------------------------------
-- estimates: a brief, its parsed spec, the matches used, and the draft.
-- ---------------------------------------------------------------------------
create table if not exists public.estimates (
  id                  uuid primary key default gen_random_uuid(),
  brief_text          text not null,
  spec                jsonb,
  matches             jsonb,
  draft               jsonb,
  compare_job_number  text,                                   -- holdout job to compare against
  totals              jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security: enabled everywhere with no anon policies. All access is
-- server-side through the service role key.
-- ---------------------------------------------------------------------------
alter table public.jobs             enable row level security;
alter table public.sections         enable row level security;
alter table public.line_items       enable row level security;
alter table public.optional_items   enable row level security;
alter table public.documents        enable row level security;
alter table public.parts            enable row level security;
alter table public.rate_card        enable row level security;
alter table public.labour_standards enable row level security;
alter table public.estimates        enable row level security;

-- ---------------------------------------------------------------------------
-- Private storage bucket for uploaded proposals and schematics.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png', 'image/jpeg'
  ]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- match_jobs: STUB. Phase 2 replaces the body with the hybrid scorer
-- (weighted params similarity + vector similarity + part/category overlap,
-- room_type as a filter). The signature is final so callers can be written now.
-- ---------------------------------------------------------------------------
create or replace function public.match_jobs(
  p_spec        jsonb,
  p_embedding   vector(1024) default null,
  p_room_type   text default null,
  p_limit       integer default 3
)
returns table (
  job_id         uuid,
  job_number     text,
  revision       integer,
  title          text,
  score          numeric,
  score_params   numeric,
  score_vector   numeric,
  score_parts    numeric,
  reasons        text[]
)
language sql stable as $$
  select
    j.id,
    j.job_number,
    j.revision,
    j.title,
    coalesce(case when p_embedding is not null then 1 - (j.embedding <=> p_embedding) end, 0)::numeric as score,
    0::numeric as score_params,
    coalesce(case when p_embedding is not null then 1 - (j.embedding <=> p_embedding) end, 0)::numeric as score_vector,
    0::numeric as score_parts,
    array['stub: ordered by vector similarity only']::text[] as reasons
  from public.jobs j
  where j.is_holdout = false
    and j.status = 'active'
    and (p_room_type is null or j.room_type = p_room_type)
  order by
    case when p_embedding is not null and j.embedding is not null then j.embedding <=> p_embedding end asc nulls last,
    j.created_at desc
  limit greatest(p_limit, 1);
$$;
