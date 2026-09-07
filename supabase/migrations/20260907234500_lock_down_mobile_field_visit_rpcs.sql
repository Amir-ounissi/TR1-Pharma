revoke all on function public.start_field_visit(uuid) from public, anon;
revoke all on function public.complete_field_visit(uuid, text, timestamptz) from public, anon;

grant execute on function public.start_field_visit(uuid) to authenticated;
grant execute on function public.complete_field_visit(uuid, text, timestamptz) to authenticated;
