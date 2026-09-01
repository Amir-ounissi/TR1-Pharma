#!/bin/sh
set -eu

api_url=${NEXT_PUBLIC_SUPABASE_URL:-}
anon_key=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}

if [ -z "$api_url" ] || [ -z "$anon_key" ]; then
  echo "Les variables Supabase locales sont requises pour le contrôle de disponibilité." >&2
  exit 1
fi

attempt=0
consecutive_ready=0

while [ "$attempt" -lt 60 ]; do
  attempt=$((attempt + 1))

  if curl -fsS "$api_url/rest/v1/" >/dev/null 2>&1 \
    && curl -fsS "$api_url/auth/v1/health" >/dev/null 2>&1 \
    && curl -fsS "$api_url/storage/v1/status" >/dev/null 2>&1 \
    && curl -fsS \
      -H "apikey: $anon_key" \
      -H "Content-Type: application/json" \
      --data '{"email":"agent@dermavita.local","password":"DemoTR1!2026"}' \
      "$api_url/auth/v1/token?grant_type=password" >/dev/null 2>&1; then
    consecutive_ready=$((consecutive_ready + 1))
    if [ "$consecutive_ready" -ge 3 ]; then
      echo "Supabase local est stable et prêt pour Playwright."
      exit 0
    fi
  else
    consecutive_ready=0
  fi

  sleep 2
done

echo "Supabase local n'est pas devenu stable dans le délai imparti." >&2
exit 1
