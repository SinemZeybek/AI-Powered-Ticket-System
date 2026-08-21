-- service_role bypasses RLS but still needs base table grants (same class
-- of issue already hit once with profiles/todos) — submitSupportTicket
-- writes via the service-role client and was failing with "permission
-- denied for table tickets" because only `authenticated` was granted here.
grant select, insert on public.tickets to service_role;
