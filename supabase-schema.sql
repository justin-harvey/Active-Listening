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

-- if the table already existed, add newer columns
alter table public.posts add column if not exists audio_url text;
-- author account that owns the post (nullable for legacy/seed rows)
alter table public.posts add column if not exists user_id uuid references auth.users(id) on delete set null;
-- raw composer source (## headings / > quotes) so a post can be re-opened and edited
alter table public.posts add column if not exists source text;

-- newest first when the feed loads
create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security: anyone may READ. Only a signed-in author may create
-- posts, and may only edit/delete the posts they own (user_id = auth.uid()).
-- ---------------------------------------------------------------------
alter table public.posts enable row level security;

drop policy if exists "posts public read"   on public.posts;
drop policy if exists "posts public insert" on public.posts;   -- old anon-insert policy
drop policy if exists "posts owner insert"  on public.posts;
drop policy if exists "posts owner update"  on public.posts;
drop policy if exists "posts owner delete"  on public.posts;

create policy "posts public read"
  on public.posts for select
  using (true);

create policy "posts owner insert"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "posts owner update"
  on public.posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "posts owner delete"
  on public.posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- NOTE: with email+password auth, new signups may need to confirm their email
-- before they can sign in. For a small/solo platform you can turn that off at
-- Supabase → Authentication → Providers → Email → uncheck "Confirm email" so
-- accounts work instantly.

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
