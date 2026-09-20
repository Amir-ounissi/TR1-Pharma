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

production_workflow='.github/workflows/release-production.yml'
staging_workflow='.github/workflows/release-staging.yml'
grep -Fq 'deploy --prod --skip-domain' "$production_workflow" || {
  echo "Gate production: la candidate doit être créée avec --skip-domain." >&2
  exit 1
}
grep -Fq '/aliases/$deployment_id/protection-bypass?teamId=$VERCEL_ORG_ID' "$production_workflow" || {
  echo "Gate production: la candidate protégée doit recevoir un bypass temporaire." >&2
  exit 1
}
grep -Fq '/aliases/$deployment_id/protection-bypass?teamId=$VERCEL_ORG_ID' "$staging_workflow" || {
  echo "Gate staging: le preview protégé doit recevoir un bypass temporaire." >&2
  exit 1
}
if grep -Fq 'vercel@${VERCEL_CLI_VERSION}" curl' "$production_workflow" "$staging_workflow"; then
  echo "Gate release: vercel curl est interdit car incompatible avec le jeton d'équipe." >&2
  exit 1
fi
grep -Fq '/promote/$PRODUCTION_DEPLOYMENT_ID?teamId=$VERCEL_ORG_ID' "$production_workflow" || {
  echo "Gate production: seule l'identité de la candidate validée doit être promue." >&2
  exit 1
}

candidate_smoke_line="$(grep -nF 'name: Vérifier la candidate production avant promotion' "$production_workflow" | cut -d: -f1)"
promotion_line="$(grep -nF 'name: Promouvoir la candidate validée vers les domaines production' "$production_workflow" | cut -d: -f1)"
public_smoke_line="$(grep -nF 'name: Smoke du domaine public après promotion' "$production_workflow" | cut -d: -f1)"
test "$candidate_smoke_line" -lt "$promotion_line" && test "$promotion_line" -lt "$public_smoke_line" || {
  echo "Gate production: l'ordre candidate → smoke → promotion → smoke public est invalide." >&2
  exit 1
}

emergency_workflow='.github/workflows/emergency-promote-known-good.yml'
grep -Fq '/promote/$KNOWN_GOOD_DEPLOYMENT_ID?teamId=$VERCEL_ORG_ID' "$emergency_workflow" || {
  echo "Gate production: le rollback d'urgence doit utiliser l'API de promotion authentifiée." >&2
  exit 1
}

test -f package-lock.json
test -f .env.example
test -f .nvmrc
echo "Release configuration: OK"
