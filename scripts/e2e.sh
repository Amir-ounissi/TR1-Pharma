#!/bin/sh
set -eu

if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

api_url=${NEXT_PUBLIC_SUPABASE_URL:-}
anon_key=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}
service_role_key=${SUPABASE_SECRET_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}

if [ -z "$api_url" ] || [ -z "$anon_key" ] || [ -z "$service_role_key" ]; then
  status_output="$(sh scripts/supabase-local.sh status -o env)"
  api_url="$(printf '%s\n' "$status_output" | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
  anon_key="$(printf '%s\n' "$status_output" | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
  service_role_key="$(printf '%s\n' "$status_output" | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"
fi

if [ -z "$api_url" ] || [ -z "$anon_key" ] || [ -z "$service_role_key" ]; then
  echo "Supabase local doit être démarré avant les tests E2E." >&2
  exit 1
fi

. ./scripts/local-env-lock.sh
tr1_acquire_local_env_lock
trap 'tr1_release_local_env_lock' EXIT HUP INT TERM

export NEXT_PUBLIC_SUPABASE_URL="$api_url"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$anon_key"
export SUPABASE_SERVICE_ROLE_KEY="$service_role_key"
export NEXT_PUBLIC_APP_URL="http://127.0.0.1:3002"
export APP_ENV="test"
export LEAD_CAPTURE_SALT="tr1-e2e-lead-capture-salt"
export LEAD_CAPTURE_ENABLED="true"
export WHATSAPP_SIMULATOR_ENABLED="true"
export E2E_SKIP_TYPECHECK="true"
export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-playwright-prod}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/private/tmp/tr1-playwright-browsers}"

rm -rf "$NEXT_DIST_DIR"
playwright test "$@"
