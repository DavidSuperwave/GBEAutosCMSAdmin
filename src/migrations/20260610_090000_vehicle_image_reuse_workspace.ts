import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "public"."enum_workshop_jobs_messages_role" AS ENUM('user','assistant','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "vehicle_media_assets" ADD COLUMN IF NOT EXISTS "source_provider" varchar;
    ALTER TABLE "vehicle_media_assets" ADD COLUMN IF NOT EXISTS "match_key" varchar;
    ALTER TABLE "vehicle_media_assets" ADD COLUMN IF NOT EXISTS "make" varchar;
    ALTER TABLE "vehicle_media_assets" ADD COLUMN IF NOT EXISTS "model" varchar;
    ALTER TABLE "vehicle_media_assets" ADD COLUMN IF NOT EXISTS "year" numeric;
    ALTER TABLE "vehicle_media_assets" ADD COLUMN IF NOT EXISTS "trim" varchar;
    ALTER TABLE "vehicle_media_assets" ADD COLUMN IF NOT EXISTS "exterior_color" varchar;
    CREATE INDEX IF NOT EXISTS "vehicle_media_assets_match_key_idx" ON "vehicle_media_assets" USING btree ("match_key");

    CREATE TABLE IF NOT EXISTS "vehicle_image_searches" (
      "id" serial PRIMARY KEY NOT NULL,
      "provider" varchar DEFAULT 'carsxe' NOT NULL,
      "match_key" varchar NOT NULL,
      "query" jsonb,
      "candidates" jsonb,
      "fetched_at" timestamp(3) with time zone,
      "expires_at" timestamp(3) with time zone,
      "last_error" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "vehicle_image_searches_match_key_idx" ON "vehicle_image_searches" USING btree ("match_key");
    CREATE INDEX IF NOT EXISTS "vehicle_image_searches_expires_at_idx" ON "vehicle_image_searches" USING btree ("expires_at");
    CREATE INDEX IF NOT EXISTS "vehicle_image_searches_updated_at_idx" ON "vehicle_image_searches" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "vehicle_image_searches_created_at_idx" ON "vehicle_image_searches" USING btree ("created_at");

    CREATE TABLE IF NOT EXISTS "workshop_jobs_messages" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "role" "public"."enum_workshop_jobs_messages_role" DEFAULT 'user' NOT NULL,
      "content" varchar NOT NULL,
      "created_at" timestamp(3) with time zone
    );
    DO $$ BEGIN
      ALTER TABLE "workshop_jobs_messages" ADD CONSTRAINT "workshop_jobs_messages_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."workshop_jobs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "workshop_jobs_messages_order_idx" ON "workshop_jobs_messages" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "workshop_jobs_messages_parent_id_idx" ON "workshop_jobs_messages" USING btree ("_parent_id");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "vehicle_image_searches_id" integer;
    ALTER TABLE "payload_preferences_rels" ADD COLUMN IF NOT EXISTS "vehicle_image_searches_id" integer;
    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vehicle_image_searches_fk" FOREIGN KEY ("vehicle_image_searches_id") REFERENCES "public"."vehicle_image_searches"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_vehicle_image_searches_fk" FOREIGN KEY ("vehicle_image_searches_id") REFERENCES "public"."vehicle_image_searches"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_vehicle_image_searches_id_idx" ON "payload_locked_documents_rels" USING btree ("vehicle_image_searches_id");
    CREATE INDEX IF NOT EXISTS "payload_preferences_rels_vehicle_image_searches_id_idx" ON "payload_preferences_rels" USING btree ("vehicle_image_searches_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "vehicle_image_searches_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "vehicle_image_searches_id";

    DROP TABLE IF EXISTS "workshop_jobs_messages" CASCADE;
    DROP TABLE IF EXISTS "vehicle_image_searches" CASCADE;

    ALTER TABLE "vehicle_media_assets" DROP COLUMN IF EXISTS "source_provider";
    ALTER TABLE "vehicle_media_assets" DROP COLUMN IF EXISTS "match_key";
    ALTER TABLE "vehicle_media_assets" DROP COLUMN IF EXISTS "make";
    ALTER TABLE "vehicle_media_assets" DROP COLUMN IF EXISTS "model";
    ALTER TABLE "vehicle_media_assets" DROP COLUMN IF EXISTS "year";
    ALTER TABLE "vehicle_media_assets" DROP COLUMN IF EXISTS "trim";
    ALTER TABLE "vehicle_media_assets" DROP COLUMN IF EXISTS "exterior_color";

    DROP TYPE IF EXISTS "public"."enum_workshop_jobs_messages_role";
  `)
}
