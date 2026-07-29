#!/bin/sh
set -eu

tracked_env=$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '(^|/)\.env\.example$' || true)
if [ -n "$tracked_env" ]; then
  echo "Fichier d'environnement réel suivi par Git :" >&2
  printf '%s\n' "$tracked_env" >&2
  exit 1
fi

generated=$(git ls-files | grep -E '(^|/)(node_modules|\.next[^/]*|test-results|playwright-report|supabase/\.temp|\.supabase-home)(/|$)' || true)
if [ -n "$generated" ]; then
  echo "Artefact généré suivi par Git :" >&2
  printf '%s\n' "$generated" >&2
  exit 1
fi

matches=$(git grep -IEn \
  -e 'gh[pousr]_[A-Za-z0-9_]{20,}' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' \
  -e 'NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|TOKEN|PASSWORD|PRIVATE_KEY)[[:space:]]*=' \
  -e 'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}' \
  -- . ':!package-lock.json' || true)

if [ -n "$matches" ]; then
  echo "Secret potentiel détecté (contenu masqué) :" >&2
  printf '%s\n' "$matches" | cut -d: -f1-2 | sort -u >&2
  exit 1
fi

echo "Secret scan: OK"
