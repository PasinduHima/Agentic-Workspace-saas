-- Realtime Authorization for the live doc channels (`doc:<workspaceId>`).
--
-- Run in the Supabase SQL editor (not a Prisma migration: Prisma's shadow database has no
-- `realtime` schema). Safe to re-run. Requires Clerk set up as a Supabase third-party auth
-- provider, so Clerk session tokens arrive with `sub` = Clerk user id and `role` = authenticated.
--
-- Who may join, mirroring lib/workspace-access.ts:
--   * a personal workspace: only its creator;
--   * an org workspace: members whose ACTIVE organization is that org (the session token only
--     carries the active org). Viewers may receive but not send.
-- Clerk session token v2 puts the active org in `o` (`o.id`, `o.rol` without the "org:" prefix);
-- v1 used `org_id` / `org_role` ("org:admin"). Both are accepted.

create or replace function public.can_use_doc_channel(topic text, wants_to_send boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."Workspace" w
    join public."User" u on u.id = w."creatorId"
    where 'doc:' || w.id = topic
      and (
        (w."clerkOrgId" is null and u."clerkId" = (auth.jwt() ->> 'sub'))
        or (
          w."clerkOrgId" is not null
          and w."clerkOrgId" = coalesce(auth.jwt() -> 'o' ->> 'id', auth.jwt() ->> 'org_id')
          and (
            not wants_to_send
            or coalesce(auth.jwt() -> 'o' ->> 'rol', replace(auth.jwt() ->> 'org_role', 'org:', ''))
               is distinct from 'viewer'
          )
        )
      )
  );
$$;

revoke all on function public.can_use_doc_channel(text, boolean) from public, anon;
grant execute on function public.can_use_doc_channel(text, boolean) to authenticated;

drop policy if exists "workspace members receive doc broadcasts" on realtime.messages;
create policy "workspace members receive doc broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.can_use_doc_channel((select realtime.topic()), false)
  );

drop policy if exists "workspace editors send doc broadcasts" on realtime.messages;
create policy "workspace editors send doc broadcasts"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and public.can_use_doc_channel((select realtime.topic()), true)
  );

-- Finally, in Dashboard > Realtime > Settings, turn OFF "Allow public access" so clients can't
-- fall back to public channels.
