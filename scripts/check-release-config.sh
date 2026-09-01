#!/bin/sh
set -eu

grep -Eq 'unoptimized:[[:space:]]*true' next.config.ts || {
  echo "Gate Sharp: images.unoptimized=true est obligatoire." >&2
  exit 1
}

next_image_files="$(find src -type f -exec grep -E -l "from[[:space:]]+['\"]next/image['\"]|require\\([[:space:]]*['\"]next/image['\"][[:space:]]*\\)" {} \;)"
for file in $next_image_files; do
  case "$file" in
    'src/app/(public)/page.tsx'|'src/components/marketing/product-proof.tsx') ;;
    *)
      echo "Gate Sharp: utilisation non revue de next/image dans $file." >&2
      exit 1
      ;;
  esac
done

migration_count="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d '[:space:]')"
test "$migration_count" -gt 0 || {
  echo "Gate migrations: aucune migration SQL détectée." >&2
  exit 1
}
echo "Gate migrations: $migration_count migration(s) détectée(s)."

grep -q '^LEAD_CAPTURE_SALT=' .env.example || {
  echo "Gate acquisition: LEAD_CAPTURE_SALT doit être documenté." >&2
  exit 1
}

test -f package-lock.json
test -f .env.example
test -f .nvmrc
echo "Release configuration: OK"
