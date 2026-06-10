import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * GBE inventory workflow upgrade.
 *
 * Purely additive and idempotent: adds vehicle workflow fields, a user role,
 * and the import-jobs / vehicle-media-assets / workshop-jobs collections.
 * Existing data and tables are left untouched. Safe to run against the live DB.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ---- Enums -----------------------------------------------------------
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_publish_status" AS ENUM('draft','needs_review','published','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_image_status" AS ENUM('missing','candidate_found','uploaded','generated','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_spec_status" AS ENUM('missing','partial','matched','manual','verified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_users_role" AS ENUM('admin','inventory_manager','content_editor','sales_manager','media_editor','viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_import_jobs_file_type" AS ENUM('csv','xlsx'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_import_jobs_status" AS ENUM('pending','validating','ready','importing','completed','rolled_back','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_media_assets_source_type" AS ENUM('uploaded','dealer_photo','api_candidate','ai_generated','ai_edited','representative'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_media_assets_approval_status" AS ENUM('draft','needs_review','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_media_assets_match_confidence" AS ENUM('exact_vehicle','same_trim_color','same_model_color','same_model','representative','generated','unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_media_assets_rights_status" AS ENUM('owned','licensed','unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_media_assets_usage" AS ENUM('vehicle_hero','vehicle_gallery','homepage','landing_page','promo_banner','social_ad'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_workshop_jobs_prompt_preset" AS ENUM('vehicle_hero','transparent_bg','clean_dealership_bg','logo_overlay','homepage_banner','social_ad','promo_banner','seminuevo_gallery_cover','new_car_representative'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_workshop_jobs_save_destination" AS ENUM('vehicle_hero','vehicle_gallery','vehicle_listing_section','homepage_section','landing_section','promo_banner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_workshop_jobs_status" AS ENUM('draft','generating','ready_for_review','approved','rejected','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ---- Vehicles: new workflow columns ---------------------------------
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "model_family" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "trim" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "exterior_color" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "interior_color" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "vehicle_type" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "segment" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "motor_type" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "source_id" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "source_import_id" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "source_dealer_name" varchar;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "publish_status" "public"."enum_vehicles_publish_status" DEFAULT 'draft';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "image_status" "public"."enum_vehicles_image_status" DEFAULT 'missing';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "spec_status" "public"."enum_vehicles_spec_status" DEFAULT 'missing';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "completeness_score" numeric DEFAULT 0;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "published_at" timestamp(3) with time zone;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "last_published_by_id" integer;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "last_reviewed_at" timestamp(3) with time zone;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "last_reviewed_by_id" integer;
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "review_notes" varchar;

    -- Price and year become optional (required only at publish time).
    ALTER TABLE "vehicles" ALTER COLUMN "year" DROP NOT NULL;
    ALTER TABLE "vehicles" ALTER COLUMN "price" DROP NOT NULL;

    DO $$ BEGIN
      ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_last_published_by_id_users_id_fk"
        FOREIGN KEY ("last_published_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_last_reviewed_by_id_users_id_fk"
        FOREIGN KEY ("last_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "vehicles_last_published_by_idx" ON "vehicles" USING btree ("last_published_by_id");
    CREATE INDEX IF NOT EXISTS "vehicles_last_reviewed_by_idx" ON "vehicles" USING btree ("last_reviewed_by_id");

    -- ---- Users: role -----------------------------------------------------
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "public"."enum_users_role" DEFAULT 'viewer';

    -- ---- import_jobs -----------------------------------------------------
    CREATE TABLE IF NOT EXISTS "import_jobs" (
      "id" serial PRIMARY KEY NOT NULL,
      "file_name" varchar NOT NULL,
      "file_type" "public"."enum_import_jobs_file_type" DEFAULT 'csv',
      "status" "public"."enum_import_jobs_status" DEFAULT 'pending',
      "row_count" numeric DEFAULT 0,
      "created_count" numeric DEFAULT 0,
      "updated_count" numeric DEFAULT 0,
      "skipped_count" numeric DEFAULT 0,
      "review_count" numeric DEFAULT 0,
      "error_count" numeric DEFAULT 0,
      "mapping" jsonb,
      "summary" varchar,
      "created_vehicle_ids" jsonb,
      "uploaded_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "import_jobs_errors" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "row" numeric,
      "message" varchar
    );
    DO $$ BEGIN
      ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_uploaded_by_id_users_id_fk"
        FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "import_jobs_errors" ADD CONSTRAINT "import_jobs_errors_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "import_jobs_uploaded_by_idx" ON "import_jobs" USING btree ("uploaded_by_id");
    CREATE INDEX IF NOT EXISTS "import_jobs_updated_at_idx" ON "import_jobs" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "import_jobs_created_at_idx" ON "import_jobs" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "import_jobs_errors_order_idx" ON "import_jobs_errors" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "import_jobs_errors_parent_id_idx" ON "import_jobs_errors" USING btree ("_parent_id");

    -- ---- vehicle_media_assets -------------------------------------------
    CREATE TABLE IF NOT EXISTS "vehicle_media_assets" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "vehicle_id" integer,
      "media_id" integer NOT NULL,
      "source_type" "public"."enum_vehicle_media_assets_source_type" DEFAULT 'uploaded',
      "source_url" varchar,
      "approval_status" "public"."enum_vehicle_media_assets_approval_status" DEFAULT 'draft',
      "match_confidence" "public"."enum_vehicle_media_assets_match_confidence" DEFAULT 'unknown',
      "exterior_color_matched" boolean,
      "rights_status" "public"."enum_vehicle_media_assets_rights_status" DEFAULT 'unknown',
      "usage" "public"."enum_vehicle_media_assets_usage",
      "notes" varchar,
      "created_by_id" integer,
      "approved_by_id" integer,
      "approved_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "vehicle_media_assets" ADD CONSTRAINT "vehicle_media_assets_vehicle_id_vehicles_id_fk"
        FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "vehicle_media_assets" ADD CONSTRAINT "vehicle_media_assets_media_id_media_id_fk"
        FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "vehicle_media_assets" ADD CONSTRAINT "vehicle_media_assets_created_by_id_users_id_fk"
        FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "vehicle_media_assets" ADD CONSTRAINT "vehicle_media_assets_approved_by_id_users_id_fk"
        FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "vehicle_media_assets_vehicle_idx" ON "vehicle_media_assets" USING btree ("vehicle_id");
    CREATE INDEX IF NOT EXISTS "vehicle_media_assets_media_idx" ON "vehicle_media_assets" USING btree ("media_id");
    CREATE INDEX IF NOT EXISTS "vehicle_media_assets_updated_at_idx" ON "vehicle_media_assets" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "vehicle_media_assets_created_at_idx" ON "vehicle_media_assets" USING btree ("created_at");

    -- ---- workshop_jobs --------------------------------------------------
    CREATE TABLE IF NOT EXISTS "workshop_jobs" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar,
      "linked_vehicle_id" integer,
      "prompt_preset" "public"."enum_workshop_jobs_prompt_preset" DEFAULT 'vehicle_hero',
      "prompt" varchar,
      "vehicle_context_brand" varchar,
      "vehicle_context_model" varchar,
      "vehicle_context_year" numeric,
      "vehicle_context_color" varchar,
      "approved_output_id" integer,
      "save_destination" "public"."enum_workshop_jobs_save_destination",
      "status" "public"."enum_workshop_jobs_status" DEFAULT 'draft',
      "error" varchar,
      "created_by_id" integer,
      "completed_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "workshop_jobs_input_images" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer
    );
    CREATE TABLE IF NOT EXISTS "workshop_jobs_outputs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer,
      "url" varchar,
      "selected" boolean
    );
    DO $$ BEGIN
      ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_linked_vehicle_id_vehicles_id_fk"
        FOREIGN KEY ("linked_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_approved_output_id_media_id_fk"
        FOREIGN KEY ("approved_output_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_created_by_id_users_id_fk"
        FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "workshop_jobs_input_images" ADD CONSTRAINT "workshop_jobs_input_images_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."workshop_jobs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "workshop_jobs_input_images" ADD CONSTRAINT "workshop_jobs_input_images_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "workshop_jobs_outputs" ADD CONSTRAINT "workshop_jobs_outputs_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."workshop_jobs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "workshop_jobs_outputs" ADD CONSTRAINT "workshop_jobs_outputs_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "workshop_jobs_linked_vehicle_idx" ON "workshop_jobs" USING btree ("linked_vehicle_id");
    CREATE INDEX IF NOT EXISTS "workshop_jobs_approved_output_idx" ON "workshop_jobs" USING btree ("approved_output_id");
    CREATE INDEX IF NOT EXISTS "workshop_jobs_updated_at_idx" ON "workshop_jobs" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "workshop_jobs_created_at_idx" ON "workshop_jobs" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "workshop_jobs_input_images_order_idx" ON "workshop_jobs_input_images" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "workshop_jobs_input_images_parent_id_idx" ON "workshop_jobs_input_images" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "workshop_jobs_outputs_order_idx" ON "workshop_jobs_outputs" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "workshop_jobs_outputs_parent_id_idx" ON "workshop_jobs_outputs" USING btree ("_parent_id");

    -- ---- Payload internal rels tables: columns for the new collections ----
    -- Payload generates one relationship column per collection in both the
    -- locked-documents and preferences rels tables. Without these, every admin
    -- page load fails with "column ..._id does not exist".
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "import_jobs_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "vehicle_media_assets_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "workshop_jobs_id" integer;
    ALTER TABLE "payload_preferences_rels" ADD COLUMN IF NOT EXISTS "import_jobs_id" integer;
    ALTER TABLE "payload_preferences_rels" ADD COLUMN IF NOT EXISTS "vehicle_media_assets_id" integer;
    ALTER TABLE "payload_preferences_rels" ADD COLUMN IF NOT EXISTS "workshop_jobs_id" integer;

    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_jobs_fk" FOREIGN KEY ("import_jobs_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vehicle_media_assets_fk" FOREIGN KEY ("vehicle_media_assets_id") REFERENCES "public"."vehicle_media_assets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_workshop_jobs_fk" FOREIGN KEY ("workshop_jobs_id") REFERENCES "public"."workshop_jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_import_jobs_fk" FOREIGN KEY ("import_jobs_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_vehicle_media_assets_fk" FOREIGN KEY ("vehicle_media_assets_id") REFERENCES "public"."vehicle_media_assets"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_workshop_jobs_fk" FOREIGN KEY ("workshop_jobs_id") REFERENCES "public"."workshop_jobs"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_import_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("import_jobs_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_vehicle_media_assets_id_idx" ON "payload_locked_documents_rels" USING btree ("vehicle_media_assets_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_workshop_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("workshop_jobs_id");
    CREATE INDEX IF NOT EXISTS "payload_preferences_rels_import_jobs_id_idx" ON "payload_preferences_rels" USING btree ("import_jobs_id");
    CREATE INDEX IF NOT EXISTS "payload_preferences_rels_vehicle_media_assets_id_idx" ON "payload_preferences_rels" USING btree ("vehicle_media_assets_id");
    CREATE INDEX IF NOT EXISTS "payload_preferences_rels_workshop_jobs_id_idx" ON "payload_preferences_rels" USING btree ("workshop_jobs_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "import_jobs_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "vehicle_media_assets_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "workshop_jobs_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "import_jobs_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "vehicle_media_assets_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "workshop_jobs_id";

    DROP TABLE IF EXISTS "workshop_jobs_outputs" CASCADE;
    DROP TABLE IF EXISTS "workshop_jobs_input_images" CASCADE;
    DROP TABLE IF EXISTS "workshop_jobs" CASCADE;
    DROP TABLE IF EXISTS "vehicle_media_assets" CASCADE;
    DROP TABLE IF EXISTS "import_jobs_errors" CASCADE;
    DROP TABLE IF EXISTS "import_jobs" CASCADE;

    ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "name";

    ALTER TABLE "vehicles" DROP CONSTRAINT IF EXISTS "vehicles_last_published_by_id_users_id_fk";
    ALTER TABLE "vehicles" DROP CONSTRAINT IF EXISTS "vehicles_last_reviewed_by_id_users_id_fk";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "model_family";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "trim";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "exterior_color";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "interior_color";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "vehicle_type";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "segment";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "motor_type";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "source_id";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "source_import_id";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "source_dealer_name";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "publish_status";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "image_status";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "spec_status";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "completeness_score";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "published_at";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "last_published_by_id";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "last_reviewed_at";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "last_reviewed_by_id";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "review_notes";

    DROP TYPE IF EXISTS "public"."enum_workshop_jobs_status";
    DROP TYPE IF EXISTS "public"."enum_workshop_jobs_save_destination";
    DROP TYPE IF EXISTS "public"."enum_workshop_jobs_prompt_preset";
    DROP TYPE IF EXISTS "public"."enum_vehicle_media_assets_usage";
    DROP TYPE IF EXISTS "public"."enum_vehicle_media_assets_rights_status";
    DROP TYPE IF EXISTS "public"."enum_vehicle_media_assets_match_confidence";
    DROP TYPE IF EXISTS "public"."enum_vehicle_media_assets_approval_status";
    DROP TYPE IF EXISTS "public"."enum_vehicle_media_assets_source_type";
    DROP TYPE IF EXISTS "public"."enum_import_jobs_status";
    DROP TYPE IF EXISTS "public"."enum_import_jobs_file_type";
    DROP TYPE IF EXISTS "public"."enum_users_role";
    DROP TYPE IF EXISTS "public"."enum_vehicles_spec_status";
    DROP TYPE IF EXISTS "public"."enum_vehicles_image_status";
    DROP TYPE IF EXISTS "public"."enum_vehicles_publish_status";
  `)
}
