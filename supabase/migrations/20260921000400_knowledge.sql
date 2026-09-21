-- Knowledge layer additions: dollar-per-item labour standards, section profiles,
-- price book job list.
alter table public.labour_standards add column if not exists amount numeric(10,2);
alter table public.parts add column if not exists jobs text[] not null default '{}';

create table if not exists public.section_profiles (
  id              uuid primary key default gen_random_uuid(),
  job_number      text not null,
  job_title       text not null,
  section_name    text not null,
  section_kind    text not null,
  section_total   numeric(12,2) not null,
  equipment_value numeric(12,2) not null,
  cabling         numeric(12,2) not null,
  cons            numeric(12,2) not null,
  freight         numeric(12,2) not null,
  services        numeric(12,2) not null,
  activities      jsonb not null default '{}'::jsonb,
  categories      text[] not null default '{}',
  updated_at      timestamptz not null default now(),
  unique (job_number, section_name)
);
alter table public.section_profiles enable row level security;
