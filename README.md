# Nirbhor API

Production-oriented MERN marketplace backend with JWT access and refresh tokens in HTTP-only cookies, separate User/Admin collections, proposal-bound chat, NID gates, and transaction-safe escrow state transitions.

## Run

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Start MongoDB first. Replace every secret in `.env`; use long random values and never commit `.env`. Set `FRONTEND_ORIGIN` to the exact Vite origin. For cross-site payment callbacks, change cookie `sameSite` to `lax` only after reviewing the CSRF strategy.

## Routes

- `/api/auth`: user registration, email verification, login, refresh, logout, reset.
- `/api/admin/auth`: separate admin login, refresh, logout and cookies.
- `/api/jobs`: classical text/category/district job search and proposal lifecycle.
- `/api/chats`: job-and-proposal-bound chat only.
- `/api/payments`: SSLCommerz initiation, IPN validation, escrow release.
- `/api/admin`: category, NID review, suspension, and super-admin creation.

## Beginner setup checklist

1. In MongoDB Atlas, create a free shared cluster, create a database user, and add your development IP under **Network Access**. `0.0.0.0/0` is acceptable only for temporary local testing; restrict it before deployment.
2. Copy the Atlas driver connection string into `MONGO_URI`, replacing the password and URL-encoding special characters.
3. Create an SSLCommerz sandbox merchant account, then copy its Store ID and Store Password into `.env`. Set `SSLCOMMERZ_IS_LIVE=false` and expose `API_PUBLIC_URL` to the callback URLs during sandbox testing.
4. Configure SMTP values for email verification and password reset. In production, missing SMTP configuration is rejected.
5. Copy `.env.example` to `.env`, replace all secret values with long random strings, and never commit `.env`.
6. Install and run with `npm install` and `npm run dev`. Seed demo NID records with `npm run seed:mock-nid` after MongoDB is reachable.
7. A local transaction-capable MongoDB must run as a replica set. Atlas already supports transactions.
8. The React client must use `fetch(..., { credentials: "include" })` or Axios `{ withCredentials: true }`. Socket.IO must connect with credentials. Tokens must never enter localStorage or sessionStorage.

The demo NID records are in `src/scripts/seedMockNid.js`; submit their matching name/date of birth through `POST /api/auth/nid`. Replace `NIDVerificationService.js` with an official provider adapter when available. Contact shielding is classical regex filtering only; no AI or ML features are used.

User routes are mounted at `/api/auth`, admin routes at `/api/admin/auth`, marketplace routes at `/api/jobs` and `/api/services`, chat at `/api/chats`, and payments at `/api/payments`. Always enforce resource ownership in the database query in addition to route middleware.
