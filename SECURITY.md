# Security

TR1 Pharma uses local fixture accounts for development and automated tests. Accounts using a `.local` email domain are test-only and must never be active in a production database.

If you discover an active `.local` account in production, suspend its membership, revoke its sessions/refresh tokens, rotate its password, and block the account before continuing the release.
