-- Support Desk schema: profiles + todos, matching the tables the app code
-- already queries (app/api/todos, app/todos, app/admin, app/admin/users).
-- No migrations existed before this, so this reconstructs the schema from
-- the actual Supabase client calls in the codebase.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'super_admin')),
  created_at timestamptz not null default now()
);

-- References profiles (not auth.users directly) so PostgREST can resolve
-- the profiles -> todos embed the admin panel query relies on
-- (`.select('id, email, role, todos(count)')`).
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  is_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists todos_user_id_idx on public.todos (user_id);

-- Auto-create a profile row whenever a new auth user signs up (the app
-- never inserts into profiles itself).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS policies only take effect on top of a base grant — Supabase's default
-- schema-level grants for anon/authenticated only cover tables that existed
-- when they were set up, so new tables need this explicitly.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.todos to authenticated;

alter table public.profiles enable row level security;
alter table public.todos enable row level security;

-- Users can always read/update their own profile row.
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Needed for the admin panel's "select all profiles with todo counts" query.
-- Kept simple for local dev: any authenticated user can read all profiles.
-- (A production version would restrict this to rows where the requester's
-- own profile has role = 'super_admin', via a SECURITY DEFINER helper
-- function to avoid RLS recursion.)
create policy "profiles: authenticated read all" on public.profiles
  for select to authenticated using (true);

-- Todos are private to their owner.
create policy "todos: owner select" on public.todos
  for select using (auth.uid() = user_id);

create policy "todos: owner insert" on public.todos
  for insert with check (auth.uid() = user_id);

create policy "todos: owner update" on public.todos
  for update using (auth.uid() = user_id);

create policy "todos: owner delete" on public.todos
  for delete using (auth.uid() = user_id);
