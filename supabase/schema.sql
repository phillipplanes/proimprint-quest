-- ============================================================
-- Proimprint Quest — Supabase setup
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

create table if not exists public.players (
  id uuid primary key,
  name text not null,
  emoji text default '🙂',
  scene int default 0,
  completed int default 0,
  last_seen timestamptz default now()
);

alter table public.players replica identity full; -- so realtime UPDATE rows carry full data

-- Everyone plays anonymously with a random id stored in their browser.
alter table public.players enable row level security;

create policy "anon can insert players" on public.players
  for insert to anon with check (true);
create policy "anon can update players" on public.players
  for update to anon using (true) with check (true);
create policy "anon can read players" on public.players
  for select to anon using (true);

-- Realtime (enabled by default on new projects; if not, uncomment):
-- alter publication supabase_realtime add table public.players;
