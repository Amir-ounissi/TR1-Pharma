#!/bin/sh
set -eu

if [ "$(uname -s)" = "Darwin" ]; then
  temporary_root=/private/tmp
else
  temporary_root=${TMPDIR:-/tmp}
fi

test_directory=$(mktemp -d "$temporary_root/tr1-pgtap.XXXXXX")
trap 'rm -rf "$test_directory"' EXIT HUP INT TERM

cp supabase/tests/database/*.sql "$test_directory/"
sh scripts/supabase-local.sh test db "$test_directory"
