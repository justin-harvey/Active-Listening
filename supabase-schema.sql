-- =====================================================================
-- Active Listener — Supabase schema
-- Run this once in your project's SQL editor (Supabase → SQL → New query).
-- =====================================================================

create table if not exists public.posts (
  id          text primary key,
  title       text not null,
  dek         text,
  author      text,
  initials    text,
  date        date default current_date,
  tags        text[] default '{}',
  html        text,
  audio_url   text,                       -- generated narration MP3 (lock-screen audio)
  created_at  timestamptz default now()
);

-- if the table already existed, add the narration column
alter table public.posts add column if not exists audio_url text;

-- newest first when the feed loads
create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security: anyone may READ and CREATE posts, nobody may edit
-- or delete via the public (anon) key. Tighten later when you add auth.
-- ---------------------------------------------------------------------
alter table public.posts enable row level security;

drop policy if exists "posts public read"   on public.posts;
drop policy if exists "posts public insert" on public.posts;

create policy "posts public read"
  on public.posts for select
  using (true);

create policy "posts public insert"
  on public.posts for insert
  with check (true);

-- No delete policy => the anon key cannot remove posts.

-- Optional: let the client save a generated narration URL back onto a post
-- (needed only if you generate audio from the reader's 🔒 button rather than at
-- publish time). Publish-time generation does NOT need this.
-- create policy "posts update audio" on public.posts for update using (true) with check (true);

-- =====================================================================
-- Storage: bucket that holds the generated narration MP3s.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('narration', 'narration', true)
on conflict (id) do nothing;

drop policy if exists "narration public read"   on storage.objects;
drop policy if exists "narration public write"  on storage.objects;

create policy "narration public read"
  on storage.objects for select
  using (bucket_id = 'narration');

create policy "narration public write"
  on storage.objects for insert
  with check (bucket_id = 'narration');
