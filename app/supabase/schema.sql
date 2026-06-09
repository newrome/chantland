create extension if not exists pgcrypto;

create table if not exists public.parish_replacements (
  id uuid primary key default gen_random_uuid(),
  dcs_key text not null unique,
  row_key text,
  kind text not null default 'text',
  source_keys jsonb not null default '[]'::jsonb,
  source_text text not null default '',
  replacement_text text not null default '',
  note text not null default 'Parish Version',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parish_replacements enable row level security;

drop policy if exists "Public read parish replacements" on public.parish_replacements;
drop policy if exists "Public insert parish replacements" on public.parish_replacements;
drop policy if exists "Public update parish replacements" on public.parish_replacements;
drop policy if exists "Public delete parish replacements" on public.parish_replacements;

create policy "Public read parish replacements"
on public.parish_replacements
for select
to anon
using (true);

create policy "Public insert parish replacements"
on public.parish_replacements
for insert
to anon
with check (true);

create policy "Public update parish replacements"
on public.parish_replacements
for update
to anon
using (true)
with check (true);

create policy "Public delete parish replacements"
on public.parish_replacements
for delete
to anon
using (true);
