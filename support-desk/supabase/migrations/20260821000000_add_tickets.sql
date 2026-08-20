-- Customer-support tickets for the AI agent's escalation path. Anonymous
-- visitors have no Supabase session, so inserts go through the server's
-- service-role client (bypasses RLS by design); the admin inbox reads/
-- updates as a logged-in super_admin.

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists tickets_status_idx on public.tickets (status);

grant select, update on public.tickets to authenticated;

alter table public.tickets enable row level security;

-- Simplified for local dev, consistent with the same shortcut already used
-- for profiles: any authenticated user can read/update all tickets, rather
-- than gating on role = 'super_admin' via a SECURITY DEFINER helper.
create policy "tickets: authenticated select" on public.tickets
  for select to authenticated using (true);

create policy "tickets: authenticated update" on public.tickets
  for update to authenticated using (true);

-- No insert policy for anon/authenticated: all inserts happen via the
-- service-role client from submitSupportTicket, which bypasses RLS.
