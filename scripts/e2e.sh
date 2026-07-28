#!/bin/sh
set -eu

status_output="$(sh scripts/supabase-local.sh status -o env)"
api_url="$(printf '%s\n' "$status_output" | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
anon_key="$(printf '%s\n' "$status_output" | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')"
service_role_key="$(printf '%s\n' "$status_output" | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"

if [ -z "$api_url" ] || [ -z "$anon_key" ] || [ -z "$service_role_key" ]; then
  echo "Supabase local doit être démarré avant les tests E2E." >&2
  exit 1
fi

export NEXT_PUBLIC_SUPABASE_URL="$api_url"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$anon_key"
export SUPABASE_SERVICE_ROLE_KEY="$service_role_key"
export NEXT_PUBLIC_APP_URL="http://127.0.0.1:3002"
export WHATSAPP_SIMULATOR_ENABLED="true"
export NEXT_DIST_DIR="${NEXT_DIST_DIR:-.next-e2e-sprint9}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/private/tmp/tr1-playwright-browsers}"

playwright test "$@"
