#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
original_home=${HOME:-}
export HOME="${SUPABASE_SANDBOX_HOME:-$project_root/.supabase-home}"
export XDG_CONFIG_HOME="$HOME/.config"
if [ -n "$original_home" ] && [ -S "$original_home/.docker/run/docker.sock" ]; then
  export DOCKER_HOST="unix://$original_home/.docker/run/docker.sock"
fi
export DO_NOT_TRACK=1
export SUPABASE_TELEMETRY_DISABLED=1
mkdir -p "$HOME" "$XDG_CONFIG_HOME"

exec "$project_root/node_modules/.bin/supabase" "$@"
