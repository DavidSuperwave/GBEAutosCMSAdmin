# GBE Autos CMS Admin

Payload CMS admin/API for the GB Automotriz public web app.

## Local Setup

1. Copy `.env.example` to `.env`.
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

5. Open `http://localhost:3001/admin` and create the first admin user.

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
- Choose production media storage before relying on image uploads at scale.
