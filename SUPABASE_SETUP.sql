-- VaultVerse Coins Supabase backend.
-- Run this once in Supabase SQL Editor.
-- Replace the email in the vvc_admins insert with your own admin email before running.

create extension if not exists pgcrypto;

create table if not exists public.vvc_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.vvc_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.vvc_coin_suggestions (
  id uuid primary key default gen_random_uuid(),
  coin_name text not null,
  x_account text,
  website text,
  description text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.vvc_votes (
  id uuid primary key default gen_random_uuid(),
  week_id text not null,
  option_id text not null,
  voter_key text not null,
  created_at timestamptz not null default now(),
  unique (week_id, voter_key)
);

create table if not exists public.vvc_scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  game_title text not null,
  player_name text not null default 'Player',
  score integer not null default 0,
  coins integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.vvc_weekly_winners (
  id uuid primary key default gen_random_uuid(),
  week_id text not null unique,
  option_id text not null,
  votes integer not null default 0,
  selected_at timestamptz not null default now()
);

insert into public.vvc_settings (key, value)
values ('featured_game', '{"gameId":"rizz-bull"}'::jsonb)
on conflict (key) do nothing;

-- TODO: Replace this with the email you use to sign in to the admin dashboard.
insert into public.vvc_admins (email)
values ('YOUR_EMAIL_HERE@example.com')
on conflict (email) do nothing;

create or replace function public.vvc_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vvc_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop view if exists public.vvc_vote_totals;
create view public.vvc_vote_totals as
select week_id, option_id, count(*)::integer as votes
from public.vvc_votes
group by week_id, option_id;

alter table public.vvc_admins enable row level security;
alter table public.vvc_settings enable row level security;
alter table public.vvc_coin_suggestions enable row level security;
alter table public.vvc_votes enable row level security;
alter table public.vvc_scores enable row level security;
alter table public.vvc_weekly_winners enable row level security;

drop policy if exists "Admins can read admin list" on public.vvc_admins;
create policy "Admins can read admin list"
on public.vvc_admins for select
to authenticated
using (public.vvc_is_admin());

drop policy if exists "Anyone can read settings" on public.vvc_settings;
create policy "Anyone can read settings"
on public.vvc_settings for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage settings" on public.vvc_settings;
create policy "Admins can manage settings"
on public.vvc_settings for all
to authenticated
using (public.vvc_is_admin())
with check (public.vvc_is_admin());

drop policy if exists "Public can create pending suggestions" on public.vvc_coin_suggestions;
create policy "Public can create pending suggestions"
on public.vvc_coin_suggestions for insert
to anon, authenticated
with check (status = 'pending');

drop policy if exists "Public can read approved suggestions" on public.vvc_coin_suggestions;
create policy "Public can read approved suggestions"
on public.vvc_coin_suggestions for select
to anon, authenticated
using (status = 'approved' or public.vvc_is_admin());

drop policy if exists "Admins can update suggestions" on public.vvc_coin_suggestions;
create policy "Admins can update suggestions"
on public.vvc_coin_suggestions for update
to authenticated
using (public.vvc_is_admin())
with check (public.vvc_is_admin());

drop policy if exists "Public can vote once per browser week" on public.vvc_votes;
create policy "Public can vote once per browser week"
on public.vvc_votes for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can read votes" on public.vvc_votes;
create policy "Public can read votes"
on public.vvc_votes for select
to anon, authenticated
using (true);

drop policy if exists "Public can submit scores" on public.vvc_scores;
create policy "Public can submit scores"
on public.vvc_scores for insert
to anon, authenticated
with check (score >= 0 and length(player_name) <= 32);

drop policy if exists "Public can read scores" on public.vvc_scores;
create policy "Public can read scores"
on public.vvc_scores for select
to anon, authenticated
using (true);

drop policy if exists "Public can read winners" on public.vvc_weekly_winners;
create policy "Public can read winners"
on public.vvc_weekly_winners for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage winners" on public.vvc_weekly_winners;
create policy "Admins can manage winners"
on public.vvc_weekly_winners for all
to authenticated
using (public.vvc_is_admin())
with check (public.vvc_is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.vvc_vote_totals to anon, authenticated;
grant execute on function public.vvc_is_admin() to anon, authenticated;
