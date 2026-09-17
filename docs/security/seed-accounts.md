# Local fixture accounts

The `.local` accounts in `supabase/seed.sql` are local test fixtures only.

Production rule:

- fixture accounts may exist only if they are banned in Supabase Auth;
- every membership attached to a fixture account must be suspended;
- production builds run `scripts/check-production-seed-accounts.mjs` and fail closed if either condition is violated.

E2E rule:

- Playwright never reads a committed password;
- `scripts/e2e.sh` generates a fresh password for each run;
- `scripts/prepare-e2e-users.mjs` applies that password only to a local Supabase instance and refuses non-local hosts.

If a fixture account is ever found active in production, suspend its memberships, ban the Auth user, revoke sessions and refresh tokens, then investigate the last sign-in timestamp before redeploying.
