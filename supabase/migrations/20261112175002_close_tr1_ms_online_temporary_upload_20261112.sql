-- Historical staging-only cleanup of the temporary supplier photo upload path.
-- The temporary endpoint is retired; no production schema change is required.
-- Retain this no-op marker to keep staging and production migration histories aligned.
select 1;
