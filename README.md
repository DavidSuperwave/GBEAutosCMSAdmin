# GBE Autos CMS Admin

Payload CMS admin/API for the GB Automotriz public web app.

## Local Setup

1. Copy `.env.example` to `.env`.
   - To deliver invite and password-reset emails, configure `SMTP_*` values in `.env`.
   - Without SMTP, an administrator can still generate a private one-time setup link when inviting a user.
2. Start Postgres:

```bash
docker compose up -d
```

3. Install dependencies:

```bash
npm install
```

4. Start Payload:

```bash
npm run dev
```

5. Open `http://localhost:3001`.
   - The root URL now redirects to `/admin`.
   - If the database has no admin users yet, Payload sends you to `/admin/create-first-user`.
   - Otherwise, unauthenticated users are sent to `/admin/login`.

## Authentication Model

- Auth is handled by Payload CMS using the `users` collection.
- Supabase is used here as the Postgres database backing `DATABASE_URI`, not as the auth provider.
- User sessions, login, forgot-password, and reset-password flows are all Payload-native.

## User Creation

- First admin user:
  - On a fresh database, visit `http://localhost:3001` or `http://localhost:3001/admin`.
  - Payload will open `/admin/create-first-user` so the initial admin can set their email and password.
- Additional users:
  - Go to `Usuarios` in the Payload admin.
  - Click `Invitar usuario`.
  - Choose one of the three explicit roles: `admin`, `general`, or `sales`.
  - The CMS creates the user with a temporary password and immediately triggers Payload's forgot-password flow so the user can set their own password.
  - Re-inviting an existing user never changes their current role.

## User Invites (Admin)

- Go to `Usuarios` in the Payload admin.
- Click `Invitar usuario`.
- Enter the email and choose the initial role.
- With SMTP configured, the CMS sends a password-setup email.
- Without SMTP, the response contains a private one-time setup link that the administrator can copy and share directly. The URL is never rendered into the page or logged by the client.
- Only users whose role is exactly `admin` can see or call this workflow.

## Password Reset

- Existing users can request a reset from `/admin/forgot`.
- Payload sends a reset link to `/admin/reset/<token>`.
- The user chooses a new password from that reset screen.
- Self-service email reset depends on `NEXT_PUBLIC_SERVER_URL` being correct and SMTP being configured. The admin invite fallback can generate the same reset screen without sending email.

## Email Delivery Requirements

- Invite and password reset emails use Payload's nodemailer adapter.
- Configure these values in `.env`:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM_EMAIL`
  - Optional: `SMTP_FROM_NAME`, `SMTP_SECURE`
- The repository already includes these keys in `.env.example`.

## Production Media Storage

- Payload media uses Supabase Storage through its S3-compatible endpoint when every `SUPABASE_S3_*` value in `.env.example` is configured.
- Set `SUPABASE_S3_REQUIRED=true` in Vercel so an incomplete storage configuration fails deployment instead of writing uploads to an ephemeral filesystem.
- Keep the S3 access key server-side and store it only in the deployment secret manager.
- Use an isolated collection prefix (for example `cms_media`) inside the public `vehicle-images` bucket.
- `SUPABASE_S3_PUBLIC_URL_BASE` must point at Supabase's public object endpoint, not the authenticated S3 endpoint.
- Run `npm run sync:media-storage` in dry-run mode before activating the adapter so existing Payload media files are confirmed present in Storage.

## Seed Data

After the admin app can connect to Postgres, seed the initial inventory and dealerships:

```bash
npm run seed
```

The seed creates:

- 9 vehicles
- 14 dealership records
- initial `home` global content
- initial `site-config` global content

Vehicle image uploads are intentionally left for the admin UI so production media storage can be chosen deliberately.

## Public Web App Connection

In the `DavidSuperwave/GBECMS` web app, set:

```bash
CMS_URL=http://localhost:3001
```

For production, use the deployed CMS URL instead.

## Core API Endpoints

- `GET /api/public/vehicles`
- `GET /api/public/dealerships`
- `POST /api/public/leads`
- `POST /api/public/analytics`
- `GET /api/globals/home`
- `GET /api/globals/site-config`

## Production Notes

- Use Supabase Postgres for `DATABASE_URI`.
  - On Vercel/serverless, use the Supabase transaction pooler connection string on port `6543`, not session mode on port `5432`.
  - Keep `POSTGRES_POOL_MAX=2` for production deployments. Payload retains one client during
    initialization, so a pool of one leaves no connection available for request queries.
- Set a strong `PAYLOAD_SECRET`.
- Set `NEXT_PUBLIC_SERVER_URL` to the deployed CMS URL.
- Configure the `SMTP_*` variables when automatic invite and password-reset email delivery is required; the admin-only manual invite link remains available without SMTP.
- Configure Supabase S3 media storage before relying on image uploads. Vercel's local filesystem is not durable.
- Run `npm run audit:data-api` after database migrations. The Data API lockdown migration must finish in the `up` state; rolling it down intentionally restores the former anonymous raw-table exposure and requires explicit security approval.
