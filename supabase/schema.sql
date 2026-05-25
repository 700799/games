-- Brain Arcade — Supabase schema (Phase 2)
-- Run this in the Supabase SQL editor after creating your project.
-- Then paste your Project URL + anon key into js/config.js and add your site
-- URL (+ http://localhost:8000) under Auth → URL Configuration → Redirect URLs.

-- ------------------------------------------------------------------
-- profiles: one row per user, holds display name + points + W/L.
-- ------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  total_points integer not null default 0,
  wins         integer not null default 0,
  losses       integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone signed in may read profiles (enables a leaderboard); you may write
-- only your own row — and the guard trigger below stops you from editing your
-- own points/W-L directly (those move only through the RPCs).
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using (true);

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ------------------------------------------------------------------
-- Auto-create a profile row when a user signs up.
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Player'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------
-- Guard: direct client UPDATEs may change display_name/avatar_url only.
-- Points/W-L are forced back to their old values unless the change is made
-- inside a SECURITY DEFINER RPC that sets app.allow_points = '1'.
-- ------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.allow_points', true), '') <> '1' then
    new.total_points := old.total_points;
    new.wins := old.wins;
    new.losses := old.losses;
  end if;
  return new;
end; $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ------------------------------------------------------------------
-- RPCs the client calls to move points / record a head-to-head result.
-- ------------------------------------------------------------------
create or replace function public.add_points(p_delta integer)
returns integer language plpgsql security definer set search_path = public as $$
declare new_total integer;
begin
  perform set_config('app.allow_points', '1', true);
  update public.profiles set total_points = total_points + p_delta
    where id = auth.uid()
    returning total_points into new_total;
  return new_total;
end; $$;

create or replace function public.record_outcome(p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.allow_points', '1', true);
  if p_kind = 'win' then
    update public.profiles set wins = wins + 1 where id = auth.uid();
  elsif p_kind = 'loss' then
    update public.profiles set losses = losses + 1 where id = auth.uid();
  end if;
end; $$;

-- ------------------------------------------------------------------
-- OPTIONAL future hardening: server-authoritative challenges. Persist each
-- challenge so finalize_challenge() computes the winner and awards points
-- server-side (so scores can't be forged). Not used by the current build, which
-- runs challenges via signed share links; uncomment when you want it.
-- ------------------------------------------------------------------
-- create table if not exists public.challenges (
--   id uuid primary key default gen_random_uuid(),
--   code text unique not null,
--   game_id text not null,
--   mode text not null,
--   metric text not null,                 -- 'lessMoves' | 'moreScore'
--   seed bigint not null,
--   challenger_id uuid references auth.users(id),
--   challenger_solved boolean, challenger_moves int, challenger_time_ms int, challenger_score int,
--   opponent_id uuid references auth.users(id),
--   opponent_solved boolean, opponent_moves int, opponent_time_ms int, opponent_score int,
--   status text not null default 'open',  -- 'open' | 'complete'
--   winner_id uuid,
--   created_at timestamptz not null default now()
-- );
