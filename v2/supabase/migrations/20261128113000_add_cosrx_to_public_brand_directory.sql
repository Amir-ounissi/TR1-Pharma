begin;

insert into public.brands (name, slug, active)
values ('COSRX', 'cosrx', false)
on conflict (slug) do update
set name = excluded.name;

insert into public.brand_discovery_directory (
  brand_id,
  discoverable,
  short_description,
  catalogue_note,
  updated_at
)
select
  id,
  true,
  'Soins coréens du visage : nettoyage, hydratation et soins ciblés.',
  null,
  now()
from public.brands
where slug = 'cosrx'
on conflict (brand_id) do update
set
  discoverable = true,
  short_description = excluded.short_description,
  catalogue_note = null,
  updated_at = now();

commit;
