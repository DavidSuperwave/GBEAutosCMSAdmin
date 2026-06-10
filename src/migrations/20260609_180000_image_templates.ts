import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the `image-templates` collection (reusable AI image presets/prompts) and
 * the matching Payload internal relationship columns. Purely additive and
 * idempotent, following the same pattern as the inventory workflow migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "public"."enum_image_templates_preset" AS ENUM('vehicle_hero','transparent_bg','clean_dealership_bg','logo_overlay','homepage_banner','social_ad','promo_banner','seminuevo_gallery_cover','new_car_representative'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "image_templates" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "preset" "public"."enum_image_templates_preset" DEFAULT 'vehicle_hero',
      "prompt" varchar,
      "reference_image_id" integer,
      "description" varchar,
      "created_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_reference_image_id_media_id_fk"
        FOREIGN KEY ("reference_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "image_templates" ADD CONSTRAINT "image_templates_created_by_id_users_id_fk"
        FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "image_templates_reference_image_idx" ON "image_templates" USING btree ("reference_image_id");
    CREATE INDEX IF NOT EXISTS "image_templates_created_by_idx" ON "image_templates" USING btree ("created_by_id");
    CREATE INDEX IF NOT EXISTS "image_templates_updated_at_idx" ON "image_templates" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "image_templates_created_at_idx" ON "image_templates" USING btree ("created_at");

    -- Payload internal rels columns for the new collection.
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "image_templates_id" integer;
    ALTER TABLE "payload_preferences_rels" ADD COLUMN IF NOT EXISTS "image_templates_id" integer;

    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_image_templates_fk" FOREIGN KEY ("image_templates_id") REFERENCES "public"."image_templates"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_image_templates_fk" FOREIGN KEY ("image_templates_id") REFERENCES "public"."image_templates"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_image_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("image_templates_id");
    CREATE INDEX IF NOT EXISTS "payload_preferences_rels_image_templates_id_idx" ON "payload_preferences_rels" USING btree ("image_templates_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "image_templates_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "image_templates_id";
    DROP TABLE IF EXISTS "image_templates" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_image_templates_preset";
  `)
}
