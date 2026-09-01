#!/bin/sh

TR1_LOCAL_ENV_LOCK_DIR=${TR1_LOCAL_ENV_LOCK_DIR:-${TMPDIR:-/tmp}/tr1-pharma-sprint112-local-env.lock}

tr1_acquire_local_env_lock() {
  attempts=0
  announced_wait=false

  while ! mkdir "$TR1_LOCAL_ENV_LOCK_DIR" 2>/dev/null; do
    attempts=$((attempts + 1))
    owner_pid=""
    if [ -f "$TR1_LOCAL_ENV_LOCK_DIR/pid" ]; then
      owner_pid=$(sed -n '1p' "$TR1_LOCAL_ENV_LOCK_DIR/pid" 2>/dev/null || true)
    fi

    case "$owner_pid" in
      ''|*[!0-9]*) ;;
      *)
        if ! kill -0 "$owner_pid" 2>/dev/null; then
          rm -f "$TR1_LOCAL_ENV_LOCK_DIR/pid"
          rmdir "$TR1_LOCAL_ENV_LOCK_DIR" 2>/dev/null || true
          continue
        fi
        ;;
    esac

    if [ "$announced_wait" = false ]; then
      echo "Un autre contrôle de l'environnement local est en cours ; attente du verrou..." >&2
      announced_wait=true
    fi
    if [ "$attempts" -ge 1800 ]; then
      echo "Délai dépassé en attendant le verrou de l'environnement local." >&2
      return 1
    fi
    sleep 1
  done

  printf '%s\n' "$$" > "$TR1_LOCAL_ENV_LOCK_DIR/pid"
}

tr1_release_local_env_lock() {
  if [ -f "$TR1_LOCAL_ENV_LOCK_DIR/pid" ] && [ "$(sed -n '1p' "$TR1_LOCAL_ENV_LOCK_DIR/pid" 2>/dev/null || true)" = "$$" ]; then
    rm -f "$TR1_LOCAL_ENV_LOCK_DIR/pid"
    rmdir "$TR1_LOCAL_ENV_LOCK_DIR" 2>/dev/null || true
  fi
}
