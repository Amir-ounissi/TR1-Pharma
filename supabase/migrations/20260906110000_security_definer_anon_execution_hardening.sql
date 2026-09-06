-- Security hardening for exposed SECURITY DEFINER RPCs.
-- These operations are authenticated product workflows. Their function bodies
-- already enforce tenant/role authorization and use an empty search_path, but
-- historical explicit grants left the Supabase anon role executable.

revoke execute on function public.assign_mission(uuid,uuid,timestamptz,timestamptz) from public, anon;
revoke execute on function public.schedule_mission(uuid,timestamptz,timestamptz) from public, anon;
revoke execute on function public.revise_order(uuid,jsonb,jsonb,boolean) from public, anon;

-- Preserve the intended signed-in application entry points explicitly.
grant execute on function public.assign_mission(uuid,uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.schedule_mission(uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.revise_order(uuid,jsonb,jsonb,boolean) to authenticated;

comment on function public.assign_mission(uuid,uuid,timestamptz,timestamptz) is
  'Authenticated mission assignment RPC. Anonymous execution is explicitly revoked.';
comment on function public.schedule_mission(uuid,timestamptz,timestamptz) is
  'Authenticated mission scheduling RPC. Anonymous execution is explicitly revoked.';
comment on function public.revise_order(uuid,jsonb,jsonb,boolean) is
  'Authenticated atomic order revision RPC. Anonymous execution is explicitly revoked.';
