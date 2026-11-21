
-- Taux Vitalora : 18 % implantations et réassorts selon déclaration de l'agent.
-- Réassorts DIRECTS non contractuellement confirmés : désactivés jusqu'à preuve écrite.
update public.private_catalog_agent_mandates
set direct_repeat=false,updated_at=now()
where brand_id in (select id from public.private_catalog_brands where slug='vitalora')
  and verified=false;
