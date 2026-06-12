import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * P0 WhatsApp routing contracts.
 *
 * Additive migration for agency routing, optional-agency vehicle drafts,
 * WhatsApp lead attribution, and funnel analytics events.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ---- Enums -----------------------------------------------------------
    DO $$ BEGIN CREATE TYPE "public"."enum_leads_lead_source" AS ENUM('whatsapp_vehicle_form','contact_form','phone_click'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TYPE "public"."enum_leads_source" ADD VALUE IF NOT EXISTS 'whatsapp_vehicle_form';
    ALTER TYPE "public"."enum_leads_source" ADD VALUE IF NOT EXISTS 'contact_form';
    ALTER TYPE "public"."enum_leads_source" ADD VALUE IF NOT EXISTS 'phone_click';

    ALTER TYPE "public"."enum_leads_stage" ADD VALUE IF NOT EXISTS 'whatsapp_opened';
    ALTER TYPE "public"."enum_leads_stage" ADD VALUE IF NOT EXISTS 'appointment_set';

    ALTER TYPE "public"."enum_analytics_events_event_type" ADD VALUE IF NOT EXISTS 'whatsapp_form_open';
    ALTER TYPE "public"."enum_analytics_events_event_type" ADD VALUE IF NOT EXISTS 'whatsapp_form_submit';
    ALTER TYPE "public"."enum_analytics_events_event_type" ADD VALUE IF NOT EXISTS 'whatsapp_open';

    -- ---- Dealership routing fields --------------------------------------
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "state" varchar;
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "address" varchar;
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "email" varchar;
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "hours" varchar;
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "default_for_city" boolean DEFAULT false;
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "sales_rep_name" varchar;
    ALTER TABLE "dealerships" ADD COLUMN IF NOT EXISTS "internal_notes" varchar;

    -- ---- Vehicle route fallback -----------------------------------------
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "allow_fallback_routing" boolean DEFAULT false;
    ALTER TABLE "vehicles" ALTER COLUMN "dealership_id" DROP NOT NULL;

    -- ---- Lead attribution ------------------------------------------------
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "city" varchar;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "agency_id" integer;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "vehicle_label" varchar;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "whatsapp_number" varchar;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "whatsapp_opened_at" timestamp(3) with time zone;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source_page" varchar;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "source_section" varchar;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lead_source" "public"."enum_leads_lead_source" DEFAULT 'whatsapp_vehicle_form';
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assigned_to_id" integer;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contacted_by_id" integer;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contacted_at" timestamp(3) with time zone;
    ALTER TABLE "leads" ALTER COLUMN "phone" DROP NOT NULL;

    DO $$ BEGIN
      ALTER TABLE "leads" ADD CONSTRAINT "leads_agency_id_dealerships_id_fk"
        FOREIGN KEY ("agency_id") REFERENCES "public"."dealerships"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_users_id_fk"
        FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "leads" ADD CONSTRAINT "leads_contacted_by_id_users_id_fk"
        FOREIGN KEY ("contacted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "leads_agency_idx" ON "leads" USING btree ("agency_id");
    CREATE INDEX IF NOT EXISTS "leads_assigned_to_idx" ON "leads" USING btree ("assigned_to_id");
    CREATE INDEX IF NOT EXISTS "leads_contacted_by_idx" ON "leads" USING btree ("contacted_by_id");
    CREATE INDEX IF NOT EXISTS "leads_city_idx" ON "leads" USING btree ("city");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_contacted_by_id_users_id_fk";
    ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_assigned_to_id_users_id_fk";
    ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_agency_id_dealerships_id_fk";

    DROP INDEX IF EXISTS "leads_city_idx";
    DROP INDEX IF EXISTS "leads_contacted_by_idx";
    DROP INDEX IF EXISTS "leads_assigned_to_idx";
    DROP INDEX IF EXISTS "leads_agency_idx";

    ALTER TABLE "leads" DROP COLUMN IF EXISTS "contacted_at";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "contacted_by_id";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "assigned_to_id";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "lead_source";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "source_section";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "source_page";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "whatsapp_opened_at";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "whatsapp_number";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "vehicle_label";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "agency_id";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "city";

    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "allow_fallback_routing";

    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "internal_notes";
    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "sales_rep_name";
    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "default_for_city";
    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "hours";
    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "email";
    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "address";
    ALTER TABLE "dealerships" DROP COLUMN IF EXISTS "state";
  `)
}
