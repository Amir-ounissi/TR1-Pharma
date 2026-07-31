#!/bin/sh
set -eu

npm run db:test
npx vitest run scripts/import-benchmark.test.ts --pool=vmThreads --no-file-parallelism
