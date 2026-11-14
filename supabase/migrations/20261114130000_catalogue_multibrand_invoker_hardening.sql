-- The multibrand wrapper reads only its JSON input and delegates all
-- protected reads/writes to the already-authorized catalogue_submit_request RPC.
-- Keep the wrapper SECURITY INVOKER to avoid adding another exposed definer function.
alter function public.catalogue_submit_multibrand_request(jsonb) security invoker;
