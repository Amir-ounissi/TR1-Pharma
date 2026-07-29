#!/bin/sh
set -eu

project_id=$(sed -n 's/^project_id = "\(.*\)"$/\1/p' supabase/config.toml)
test -n "$project_id"
container_name=${SUPABASE_DB_CONTAINER:-supabase_db_$project_id}

docker exec "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select 1" >/dev/null

cat <<'SQL' | docker exec -i "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1
truncate table storage.objects, storage.buckets cascade;
truncate table auth.users cascade;
drop schema if exists private cascade;
drop schema if exists public cascade;
create schema public authorization postgres;
grant all on schema public to postgres;
grant usage on schema public to anon, authenticated, service_role;
truncate table supabase_migrations.schema_migrations;
SQL

for migration in $(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort); do
  file_name=$(basename "$migration" .sql)
  version=${file_name%%_*}
  name=${file_name#*_}
  echo "Applying migration $file_name"
  docker exec -i "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$migration"
  docker exec "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "insert into supabase_migrations.schema_migrations(version, statements, name) values ('$version', '{}', '$name');" >/dev/null
done

echo "Loading seed"
docker exec -i "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/seed.sql
docker exec "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "notify pgrst, 'reload schema';" >/dev/null
echo "Sandbox database rebuild: OK"
