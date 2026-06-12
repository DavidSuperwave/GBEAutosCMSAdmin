import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * P2 pages/navigation metadata and analytics dimensions.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_status" AS ENUM('draft','published','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_config_navigation_main_links_type" AS ENUM('page','collection','brand','inventory','custom'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TYPE "public"."enum_analytics_events_event_type" ADD VALUE IF NOT EXISTS 'collection_view';
    ALTER TYPE "public"."enum_analytics_events_event_type" ADD VALUE IF NOT EXISTS 'filter_used';

    ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "status" "public"."enum_pages_status" DEFAULT 'draft';
    ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "show_in_navigation" boolean DEFAULT false;
    ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "nav_label" varchar;
    ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "nav_parent" varchar;

    ALTER TABLE "site_config_navigation_main_links" ADD COLUMN IF NOT EXISTS "type" "public"."enum_site_config_navigation_main_links_type" DEFAULT 'custom';

    CREATE TABLE IF NOT EXISTS "site_config_navigation_footer_links" (
      "id" varchar PRIMARY KEY NOT NULL,
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "label" varchar NOT NULL,
      "href" varchar NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "site_config_navigation_legal_links" (
      "id" varchar PRIMARY KEY NOT NULL,
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "label" varchar NOT NULL,
      "href" varchar NOT NULL
    );
    DO $$ BEGIN ALTER TABLE "site_config_navigation_footer_links" ADD CONSTRAINT "site_config_navigation_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_navigation_legal_links" ADD CONSTRAINT "site_config_navigation_legal_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "site_config_navigation_footer_links_order_idx" ON "site_config_navigation_footer_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_navigation_footer_links_parent_id_idx" ON "site_config_navigation_footer_links" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_navigation_legal_links_order_idx" ON "site_config_navigation_legal_links" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_navigation_legal_links_parent_id_idx" ON "site_config_navigation_legal_links" USING btree ("_parent_id");

    ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "agency_id" integer;
    ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "city" varchar;
    ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "brand" varchar;
    ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "condition" varchar;
    ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "collection_id_id" integer;
    ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "lead_id_id" integer;
    ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "source_section" varchar;
    DO $$ BEGIN ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_agency_id_dealerships_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."dealerships"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_collection_id_id_vehicle_collections_id_fk" FOREIGN KEY ("collection_id_id") REFERENCES "public"."vehicle_collections"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_lead_id_id_leads_id_fk" FOREIGN KEY ("lead_id_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "analytics_events_agency_idx" ON "analytics_events" USING btree ("agency_id");
    CREATE INDEX IF NOT EXISTS "analytics_events_collection_id_idx" ON "analytics_events" USING btree ("collection_id_id");
    CREATE INDEX IF NOT EXISTS "analytics_events_lead_id_idx" ON "analytics_events" USING btree ("lead_id_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "source_section";
    ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "lead_id_id";
    ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "collection_id_id";
    ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "condition";
    ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "brand";
    ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "city";
    ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "agency_id";
    DROP TABLE IF EXISTS "site_config_navigation_legal_links" CASCADE;
    DROP TABLE IF EXISTS "site_config_navigation_footer_links" CASCADE;
    ALTER TABLE "site_config_navigation_main_links" DROP COLUMN IF EXISTS "type";
    ALTER TABLE "pages" DROP COLUMN IF EXISTS "nav_parent";
    ALTER TABLE "pages" DROP COLUMN IF EXISTS "nav_label";
    ALTER TABLE "pages" DROP COLUMN IF EXISTS "show_in_navigation";
    ALTER TABLE "pages" DROP COLUMN IF EXISTS "status";
    DROP TYPE IF EXISTS "public"."enum_site_config_navigation_main_links_type";
    DROP TYPE IF EXISTS "public"."enum_pages_status";
  `)
}
