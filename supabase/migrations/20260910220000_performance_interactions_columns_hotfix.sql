-- Hotfix the commercial performance cockpit to use the actual interactions schema.
-- `interactions` stores the author in `created_by` and the type in `interaction_type`.

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.get_commercial_performance_cockpit(uuid,date,date,uuid,uuid,public.pharmacy_group_type,uuid,public.potential_level,public.priority_level,uuid)'::regprocedure
  )
  into function_definition;

  if position('i.user_id' in function_definition) = 0
     or position('i.kind' in function_definition) = 0 then
    raise exception 'Expected legacy interaction column references were not found in performance cockpit';
  end if;

  function_definition := replace(function_definition, 'i.user_id', 'i.created_by');
  function_definition := replace(function_definition, 'i.kind', 'i.interaction_type');

  execute function_definition;
end;
$migration$;

notify pgrst, 'reload schema';
