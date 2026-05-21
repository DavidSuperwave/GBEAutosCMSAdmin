# GBE Autos CMS Admin

Payload CMS admin/API for the GB Automotriz public web app.

## Local Setup

1. Copy `.env.example` to `.env`.
   - To enable user invite emails, configure `SMTP_*` values in `.env`.
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
- Additional admin users:
  - Go to `Usuarios` in the Payload admin.
  - Click `Invitar usuario`.
  - The CMS creates the user with a temporary password and immediately triggers Payload's forgot-password flow so the user can set their own password from the email link.

## User Invites (Admin)

- Go to `Usuarios` in the Payload admin.
- Click `Invitar usuario`.
- Enter the email.
- The CMS creates the user and sends a password-setup email through the configured SMTP provider.

## Password Reset

- Existing users can request a reset from `/admin/forgot`.
- Payload sends a reset link to `/admin/reset/<token>`.
- The user chooses a new password from that reset screen.
- This flow depends on `NEXT_PUBLIC_SERVER_URL` being correct and SMTP being configured.

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

- `GET /api/vehicles`
- `GET /api/dealerships`
- `POST /api/leads`
- `GET /api/globals/home`
- `GET /api/globals/site-config`

## Production Notes

- Use Supabase Postgres for `DATABASE_URI`.
- Set a strong `PAYLOAD_SECRET`.
- Set `NEXT_PUBLIC_SERVER_URL` to the deployed CMS URL.
- Configure the `SMTP_*` variables so invite and password reset emails can be delivered.
- Choose production media storage before relying on image uploads at scale.
