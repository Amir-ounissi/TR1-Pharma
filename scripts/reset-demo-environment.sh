#!/bin/sh
set -eu

if [ "${APP_ENV:-}" != "staging" ]; then
  echo "APP_ENV=staging est obligatoire." >&2
  exit 1
fi
if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "SUPABASE_PROJECT_REF est obligatoire." >&2
  exit 1
fi
if [ "${CONFIRM_STAGING_RESET:-}" != "RESET_${SUPABASE_PROJECT_REF}" ]; then
  echo "Définissez CONFIRM_STAGING_RESET=RESET_${SUPABASE_PROJECT_REF} pour confirmer." >&2
  exit 1
fi

echo "Réinitialisation destructive du projet staging ${SUPABASE_PROJECT_REF}."
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase db reset --linked
