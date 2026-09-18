# Production auth hardening

Production releases must not expose usable demo or seed accounts.

`npm run release:check` now runs `security:production-auth` whenever `APP_ENV=production`.
The guard allows historical `.local` users only when they are both:

- banned in Supabase Auth with a future `banned_until`;
- detached from any active membership.

Any unbanned `.local` user or active membership blocks the release.

The `supabase/seed.sql` fixture is for local development and E2E only. It must never be applied to a hosted production project.
