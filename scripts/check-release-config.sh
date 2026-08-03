#!/bin/sh
set -eu

grep -Eq 'unoptimized:[[:space:]]*true' next.config.ts || {
  echo "Gate Sharp: images.unoptimized=true est obligatoire." >&2
  exit 1
}

if rg -l 'from ["'"'"']next/image["'"'"']|require\\(["'"'"']next/image["'"'"']\\)' src >/dev/null; then
  echo "Gate Sharp: une utilisation de next/image doit être revue explicitement." >&2
  exit 1
fi

test "$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')" = "13" || {
  echo "Gate migrations: 13 migrations sont attendues pour le Sprint 12." >&2
  exit 1
}

grep -q '^LEAD_CAPTURE_SALT=' .env.example || {
  echo "Gate acquisition: LEAD_CAPTURE_SALT doit être documenté." >&2
  exit 1
}

test -f package-lock.json
test -f .env.example
test -f .nvmrc
echo "Release configuration: OK"
