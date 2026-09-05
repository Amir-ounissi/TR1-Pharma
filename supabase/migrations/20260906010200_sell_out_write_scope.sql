create or replace function private.enforce_sell_out_line_write_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  );
begin
  if jwt_role <> 'service_role'
     and not private.can_capture_sell_out(old.brand_id, old.brand_pharmacy_id) then
    raise exception 'Sell-out line update forbidden' using errcode = '42501';
  end if;

  if new.capture_id <> old.capture_id
     or new.organization_id <> old.organization_id
     or new.brand_id <> old.brand_id
     or new.brand_pharmacy_id <> old.brand_pharmacy_id then
    raise exception 'Sell-out line scope is immutable' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_sell_out_line_write_scope() from public, anon, authenticated;

drop trigger if exists sell_out_lines_write_scope on public.sell_out_lines;
create trigger sell_out_lines_write_scope
before update on public.sell_out_lines
for each row execute function private.enforce_sell_out_line_write_scope();
