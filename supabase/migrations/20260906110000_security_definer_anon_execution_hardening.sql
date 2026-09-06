-- Security hardening for exposed SECURITY DEFINER RPCs.
-- Product workflows stay callable only by their intended database roles.

-- Authenticated mission/order entry points: historical explicit anon grants must
-- be revoked in addition to PUBLIC.
revoke execute on function public.assign_mission(uuid,uuid,timestamptz,timestamptz) from public, anon;
revoke execute on function public.schedule_mission(uuid,timestamptz,timestamptz) from public, anon;
revoke execute on function public.revise_order(uuid,jsonb,jsonb,boolean) from public, anon;

grant execute on function public.assign_mission(uuid,uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.schedule_mission(uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.revise_order(uuid,jsonb,jsonb,boolean) to authenticated;

-- Sell-out RPCs explicitly granted authenticated access in the feature migration
-- but never revoked PostgreSQL's default PUBLIC execute privilege. Keep the
-- intended signed-in entry points while removing anonymous/PostgREST exposure.
revoke execute on function public.save_sell_out_capture(uuid,uuid,uuid,public.sell_out_capture_method,date,date,text,numeric,text,jsonb,uuid) from public, anon;
revoke execute on function public.save_sell_out_line(uuid,uuid,uuid,text,text,text,integer,numeric,integer,integer,integer,numeric) from public, anon;
revoke execute on function public.add_sell_out_evidence(uuid,public.sell_out_evidence_kind,text,text,text,bigint,text,text) from public, anon;
revoke execute on function public.submit_sell_out_capture(uuid) from public, anon;
revoke execute on function public.validate_sell_out_capture(uuid,boolean,text) from public, anon;
revoke execute on function public.archive_sell_out_capture(uuid) from public, anon;
revoke execute on function public.get_sell_out_overview(uuid,date,date) from public, anon;

grant execute on function public.save_sell_out_capture(uuid,uuid,uuid,public.sell_out_capture_method,date,date,text,numeric,text,jsonb,uuid) to authenticated;
grant execute on function public.save_sell_out_line(uuid,uuid,uuid,text,text,text,integer,numeric,integer,integer,integer,numeric) to authenticated;
grant execute on function public.add_sell_out_evidence(uuid,public.sell_out_evidence_kind,text,text,text,bigint,text,text) to authenticated;
grant execute on function public.submit_sell_out_capture(uuid) to authenticated;
grant execute on function public.validate_sell_out_capture(uuid,boolean,text) to authenticated;
grant execute on function public.archive_sell_out_capture(uuid) to authenticated;
grant execute on function public.get_sell_out_overview(uuid,date,date) to authenticated;

-- Global overdue processing is a background/system operation. Its original
-- contract is service_role-only; allowing any signed-in tenant user to execute
-- it would permit a cross-tenant state mutation even though the transition is
-- deterministic.
revoke execute on function public.process_overdue_mission_reports() from public, anon, authenticated;
grant execute on function public.process_overdue_mission_reports() to service_role;

comment on function public.assign_mission(uuid,uuid,timestamptz,timestamptz) is
  'Authenticated mission assignment RPC. Anonymous execution is explicitly revoked.';
comment on function public.schedule_mission(uuid,timestamptz,timestamptz) is
  'Authenticated mission scheduling RPC. Anonymous execution is explicitly revoked.';
comment on function public.revise_order(uuid,jsonb,jsonb,boolean) is
  'Authenticated atomic order revision RPC. Anonymous execution is explicitly revoked.';
comment on function public.process_overdue_mission_reports() is
  'Service-role-only global overdue mission processor. Tenant users cannot execute it directly.';
