import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * P1 tags and smart collections.
 *
 * Add first-class vehicle tags, manual/smart vehicle collections, vehicle tag
 * relationships, and inventory collection blocks for pages + site config.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ---- Enums -----------------------------------------------------------
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_tags_type" AS ENUM('manual','automatic','system'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_collections_collection_type" AS ENUM('manual','smart'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_collections_rules_condition" AS ENUM('new','used'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_collections_rules_body_type" AS ENUM('sedan','suv','pickup','coupe','hatchback','van','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_collections_rules_fuel" AS ENUM('gasoline','diesel','hybrid','electric'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_collections_rules_transmission" AS ENUM('automatic','manual','cvt'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_collections_rules_inventory_status" AS ENUM('available','reserved','sold'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_collections_rules_publish_status" AS ENUM('draft','needs_review','published','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicle_collections_sort" AS ENUM('newest','mostViewed','mostClicked','mostLeads','priceAsc','priceDesc','mileageAsc','yearDesc'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_inventory_collection_layout" AS ENUM('grid','carousel','featuredSplit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_config_blocks_inventory_collection_layout" AS ENUM('grid','carousel','featuredSplit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    -- ---- Tags ------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS "vehicle_tags" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "label" varchar,
      "description" varchar,
      "type" "public"."enum_vehicle_tags_type" DEFAULT 'manual',
      "color" varchar,
      "is_visible" boolean DEFAULT true,
      "sort_order" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_tags_slug_idx" ON "vehicle_tags" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "vehicle_tags_updated_at_idx" ON "vehicle_tags" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "vehicle_tags_created_at_idx" ON "vehicle_tags" USING btree ("created_at");

    -- ---- Collections -----------------------------------------------------
    CREATE TABLE IF NOT EXISTS "vehicle_collections" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "description" varchar,
      "image_id" integer,
      "collection_type" "public"."enum_vehicle_collections_collection_type" DEFAULT 'smart' NOT NULL,
      "rules_condition" "public"."enum_vehicle_collections_rules_condition",
      "rules_brand" varchar,
      "rules_city" varchar,
      "rules_dealership_id" integer,
      "rules_body_type" "public"."enum_vehicle_collections_rules_body_type",
      "rules_segment" varchar,
      "rules_vehicle_type" varchar,
      "rules_fuel" "public"."enum_vehicle_collections_rules_fuel",
      "rules_transmission" "public"."enum_vehicle_collections_rules_transmission",
      "rules_inventory_status" "public"."enum_vehicle_collections_rules_inventory_status",
      "rules_publish_status" "public"."enum_vehicle_collections_rules_publish_status",
      "sort" "public"."enum_vehicle_collections_sort" DEFAULT 'newest',
      "limit" numeric DEFAULT 12,
      "is_visible" boolean DEFAULT true,
      "seo_title" varchar,
      "seo_description" varchar,
      "seo_image_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    DO $$ BEGIN ALTER TABLE "vehicle_collections" ADD CONSTRAINT "vehicle_collections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "vehicle_collections" ADD CONSTRAINT "vehicle_collections_rules_dealership_id_dealerships_id_fk" FOREIGN KEY ("rules_dealership_id") REFERENCES "public"."dealerships"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "vehicle_collections" ADD CONSTRAINT "vehicle_collections_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_collections_slug_idx" ON "vehicle_collections" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "vehicle_collections_image_idx" ON "vehicle_collections" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "vehicle_collections_rules_rules_dealership_idx" ON "vehicle_collections" USING btree ("rules_dealership_id");
    CREATE INDEX IF NOT EXISTS "vehicle_collections_seo_seo_image_idx" ON "vehicle_collections" USING btree ("seo_image_id");
    CREATE INDEX IF NOT EXISTS "vehicle_collections_updated_at_idx" ON "vehicle_collections" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "vehicle_collections_created_at_idx" ON "vehicle_collections" USING btree ("created_at");

    CREATE TABLE IF NOT EXISTS "vehicle_collections_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "vehicles_id" integer,
      "vehicle_tags_id" integer
    );
    DO $$ BEGIN ALTER TABLE "vehicle_collections_rels" ADD CONSTRAINT "vehicle_collections_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."vehicle_collections"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "vehicle_collections_rels" ADD CONSTRAINT "vehicle_collections_rels_vehicles_fk" FOREIGN KEY ("vehicles_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "vehicle_collections_rels" ADD CONSTRAINT "vehicle_collections_rels_vehicle_tags_fk" FOREIGN KEY ("vehicle_tags_id") REFERENCES "public"."vehicle_tags"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "vehicle_collections_rels_order_idx" ON "vehicle_collections_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "vehicle_collections_rels_parent_idx" ON "vehicle_collections_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "vehicle_collections_rels_path_idx" ON "vehicle_collections_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "vehicle_collections_rels_vehicles_id_idx" ON "vehicle_collections_rels" USING btree ("vehicles_id");
    CREATE INDEX IF NOT EXISTS "vehicle_collections_rels_vehicle_tags_id_idx" ON "vehicle_collections_rels" USING btree ("vehicle_tags_id");

    -- ---- Vehicle tag relationship ---------------------------------------
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "featured" boolean DEFAULT false;
    CREATE TABLE IF NOT EXISTS "vehicles_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "vehicle_tags_id" integer
    );
    DO $$ BEGIN ALTER TABLE "vehicles_rels" ADD CONSTRAINT "vehicles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "vehicles_rels" ADD CONSTRAINT "vehicles_rels_vehicle_tags_fk" FOREIGN KEY ("vehicle_tags_id") REFERENCES "public"."vehicle_tags"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "vehicles_rels_order_idx" ON "vehicles_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "vehicles_rels_parent_idx" ON "vehicles_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "vehicles_rels_path_idx" ON "vehicles_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "vehicles_rels_vehicle_tags_id_idx" ON "vehicles_rels" USING btree ("vehicle_tags_id");

    -- ---- Inventory collection blocks ------------------------------------
    CREATE TABLE IF NOT EXISTS "pages_blocks_inventory_collection" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "collection_id" integer NOT NULL,
      "heading" varchar,
      "body" varchar,
      "layout" "public"."enum_pages_blocks_inventory_collection_layout" DEFAULT 'grid',
      "limit" numeric DEFAULT 8,
      "display_show_price" boolean DEFAULT true,
      "display_show_mileage" boolean DEFAULT true,
      "display_show_city" boolean DEFAULT true,
      "display_show_tags" boolean DEFAULT true,
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    DO $$ BEGIN ALTER TABLE "pages_blocks_inventory_collection" ADD CONSTRAINT "pages_blocks_inventory_collection_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_inventory_collection" ADD CONSTRAINT "pages_blocks_inventory_collection_collection_id_vehicle_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."vehicle_collections"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "pages_blocks_inventory_collection_order_idx" ON "pages_blocks_inventory_collection" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_inventory_collection_parent_id_idx" ON "pages_blocks_inventory_collection" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_inventory_collection_path_idx" ON "pages_blocks_inventory_collection" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_inventory_collection_collection_idx" ON "pages_blocks_inventory_collection" USING btree ("collection_id");

    CREATE TABLE IF NOT EXISTS "site_config_blocks_inventory_collection" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "collection_id" integer NOT NULL,
      "heading" varchar,
      "body" varchar,
      "layout" "public"."enum_site_config_blocks_inventory_collection_layout" DEFAULT 'grid',
      "limit" numeric DEFAULT 8,
      "display_show_price" boolean DEFAULT true,
      "display_show_mileage" boolean DEFAULT true,
      "display_show_city" boolean DEFAULT true,
      "display_show_tags" boolean DEFAULT true,
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    DO $$ BEGIN ALTER TABLE "site_config_blocks_inventory_collection" ADD CONSTRAINT "site_config_blocks_inventory_collection_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_inventory_collection" ADD CONSTRAINT "site_config_blocks_inventory_collection_collection_id_vehicle_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."vehicle_collections"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "site_config_blocks_inventory_collection_order_idx" ON "site_config_blocks_inventory_collection" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_inventory_collection_parent_id_idx" ON "site_config_blocks_inventory_collection" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_inventory_collection_path_idx" ON "site_config_blocks_inventory_collection" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_inventory_collection_collection_idx" ON "site_config_blocks_inventory_collection" USING btree ("collection_id");

    -- ---- Payload internal relationship lock support ---------------------
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "vehicle_tags_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "vehicle_collections_id" integer;
    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vehicle_tags_fk" FOREIGN KEY ("vehicle_tags_id") REFERENCES "public"."vehicle_tags"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vehicle_collections_fk" FOREIGN KEY ("vehicle_collections_id") REFERENCES "public"."vehicle_collections"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_vehicle_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("vehicle_tags_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_vehicle_collections_id_idx" ON "payload_locked_documents_rels" USING btree ("vehicle_collections_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "vehicle_collections_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "vehicle_tags_id";

    DROP TABLE IF EXISTS "site_config_blocks_inventory_collection" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_inventory_collection" CASCADE;
    DROP TABLE IF EXISTS "vehicles_rels" CASCADE;
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "featured";
    DROP TABLE IF EXISTS "vehicle_collections_rels" CASCADE;
    DROP TABLE IF EXISTS "vehicle_collections" CASCADE;
    DROP TABLE IF EXISTS "vehicle_tags" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_site_config_blocks_inventory_collection_layout";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_inventory_collection_layout";
    DROP TYPE IF EXISTS "public"."enum_vehicle_collections_sort";
    DROP TYPE IF EXISTS "public"."enum_vehicle_collections_rules_publish_status";
    DROP TYPE IF EXISTS "public"."enum_vehicle_collections_rules_inventory_status";
    DROP TYPE IF EXISTS "public"."enum_vehicle_collections_rules_transmission";
    DROP TYPE IF EXISTS "public"."enum_vehicle_collections_rules_fuel";
    DROP TYPE IF EXISTS "public"."enum_vehicle_collections_rules_body_type";
    DROP TYPE IF EXISTS "public"."enum_vehicle_collections_rules_condition";
    DROP TYPE IF EXISTS "public"."enum_vehicle_collections_collection_type";
    DROP TYPE IF EXISTS "public"."enum_vehicle_tags_type";
  `)
}
