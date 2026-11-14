-- Toute soumission doit passer par le controle multimarque qui valide
-- les minimums fournisseurs avant de creer les demandes atomiquement.
-- Le RPC mono-marque est reserve aux appels internes depuis le RPC definer.
alter function public.catalogue_submit_multibrand_request(jsonb) security definer;
revoke all on function public.catalogue_submit_multibrand_request(jsonb) from public, anon, authenticated;
grant execute on function public.catalogue_submit_multibrand_request(jsonb) to authenticated;

revoke all on function public.catalogue_submit_request(text,jsonb) from public, anon, authenticated;
