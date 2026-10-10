-- Harden the isolated ChatGPT OAuth reader role against legacy PUBLIC RPC EXECUTE grants.
-- These seven SECURITY INVOKER performance routines also have explicit grants to
-- anon/authenticated/service_role; removing the PUBLIC grant preserves app access.
-- Safe when the MCP connector is OFF as well as when it is activated.
DO $guard$
DECLARE
  v_function record;
  v_count integer := 0;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS function_signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'archive_performance_objective',
        'get_objective_progress',
        'get_performance_network',
        'get_performance_overview',
        'get_performance_team',
        'get_product_distribution',
        'save_performance_objective'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_function.function_signature);
    v_count := v_count + 1;
  END LOOP;
  IF v_count <> 7 THEN
    RAISE EXCEPTION
      'Expected seven legacy performance RPCs, found %; refusing partial hardening',
      v_count;
  END IF;
END $guard$;
