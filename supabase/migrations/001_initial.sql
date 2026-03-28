-- LoveMapper Initial Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- PROFILES TABLE
-- ============================================
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  username    text unique not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now(),
  constraint username_length check (char_length(username) >= 3)
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can insert their own profile"
  on profiles for insert with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on profiles for update using ((select auth.uid()) = id);

-- Auto-create profile on signup
create function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || left(new.id::text, 8)),
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- MEMORIES TABLE
-- ============================================
create table public.memories (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  caption         text not null default '',
  latitude        double precision not null,
  longitude       double precision not null,
  location_name   text,
  photo_url       text not null,
  photo_public_id text not null,
  visibility      text not null default 'private' check (visibility in ('private', 'public', 'link')),
  share_token     text unique,
  taken_at        timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.memories enable row level security;

-- Indexes
create index memories_geo_idx on public.memories (latitude, longitude);
create index memories_user_time_idx on public.memories (user_id, created_at desc);
create index memories_public_idx on public.memories (visibility, created_at desc) where visibility = 'public';
create index memories_caption_search_idx on public.memories using gin (to_tsvector('english', caption));
create index memories_share_token_idx on public.memories (share_token) where share_token is not null;

-- RLS Policies
create policy "Users can view own memories"
  on memories for select using (auth.uid() = user_id);

create policy "Anyone can view public memories"
  on memories for select using (visibility = 'public');

create policy "Anyone can view shared memories by token"
  on memories for select using (share_token is not null and visibility = 'link');

create policy "Users can insert own memories"
  on memories for insert with check (auth.uid() = user_id);

create policy "Users can update own memories"
  on memories for update using (auth.uid() = user_id);

create policy "Users can delete own memories"
  on memories for delete using (auth.uid() = user_id);

-- Auto-update updated_at
create function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger memories_updated_at
  before update on public.memories
  for each row execute function public.update_updated_at();
