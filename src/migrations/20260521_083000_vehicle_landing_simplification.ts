import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_vehicles_blocks_image_text_image_position" AS ENUM('left', 'right');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "vehicles_blocks_image_text" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar,
      "heading" varchar NOT NULL,
      "body" varchar,
      "image_id" integer,
      "image_position" "public"."enum_vehicles_blocks_image_text_image_position" DEFAULT 'left',
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "vehicles_blocks_gallery" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "vehicles_blocks_gallery_images" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer NOT NULL,
      "alt" varchar
    );

    CREATE TABLE IF NOT EXISTS "vehicles_blocks_highlight_list" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar NOT NULL,
      "body" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "vehicles_blocks_highlight_list_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "description" varchar
    );

    CREATE TABLE IF NOT EXISTS "vehicles_blocks_feature_grid" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar NOT NULL,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "vehicles_blocks_feature_grid_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "feature" varchar NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "vehicles_blocks_cta" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar NOT NULL,
      "body" varchar,
      "button_label" varchar DEFAULT 'Consultar por WhatsApp',
      "block_name" varchar
    );

    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "dealership_id" integer;

    DO $$ BEGIN
      ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_dealership_id_dealerships_id_fk"
        FOREIGN KEY ("dealership_id") REFERENCES "public"."dealerships"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_image_text" ADD CONSTRAINT "vehicles_blocks_image_text_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_image_text" ADD CONSTRAINT "vehicles_blocks_image_text_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_gallery" ADD CONSTRAINT "vehicles_blocks_gallery_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_gallery_images" ADD CONSTRAINT "vehicles_blocks_gallery_images_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_gallery_images" ADD CONSTRAINT "vehicles_blocks_gallery_images_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_highlight_list" ADD CONSTRAINT "vehicles_blocks_highlight_list_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_highlight_list_items" ADD CONSTRAINT "vehicles_blocks_highlight_list_items_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles_blocks_highlight_list"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_feature_grid" ADD CONSTRAINT "vehicles_blocks_feature_grid_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_feature_grid_items" ADD CONSTRAINT "vehicles_blocks_feature_grid_items_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "vehicles_blocks_cta" ADD CONSTRAINT "vehicles_blocks_cta_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS "vehicles_dealership_idx" ON "vehicles" USING btree ("dealership_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_image_text_order_idx" ON "vehicles_blocks_image_text" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_image_text_parent_id_idx" ON "vehicles_blocks_image_text" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_image_text_image_idx" ON "vehicles_blocks_image_text" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_gallery_order_idx" ON "vehicles_blocks_gallery" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_gallery_parent_id_idx" ON "vehicles_blocks_gallery" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_gallery_images_order_idx" ON "vehicles_blocks_gallery_images" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_gallery_images_parent_id_idx" ON "vehicles_blocks_gallery_images" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_gallery_images_image_idx" ON "vehicles_blocks_gallery_images" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_highlight_list_order_idx" ON "vehicles_blocks_highlight_list" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_highlight_list_parent_id_idx" ON "vehicles_blocks_highlight_list" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_highlight_list_items_order_idx" ON "vehicles_blocks_highlight_list_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_highlight_list_items_parent_id_idx" ON "vehicles_blocks_highlight_list_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_feature_grid_order_idx" ON "vehicles_blocks_feature_grid" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_feature_grid_parent_id_idx" ON "vehicles_blocks_feature_grid" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_feature_grid_items_order_idx" ON "vehicles_blocks_feature_grid_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_feature_grid_items_parent_id_idx" ON "vehicles_blocks_feature_grid_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_cta_order_idx" ON "vehicles_blocks_cta" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "vehicles_blocks_cta_parent_id_idx" ON "vehicles_blocks_cta" USING btree ("_parent_id");

    INSERT INTO "dealerships" ("brand_name", "display_name", "city", "phone", "whatsapp", "is_active", "updated_at", "created_at")
    VALUES
      ('seminuevos', 'Seminuevos GB Culiacan', 'Culiacan', '6442364338', '526442364338', true, now(), now()),
      ('seminuevos', 'Seminuevos GB Mazatlan', 'Mazatlan', '6442364338', '526442364338', true, now(), now()),
      ('seminuevos', 'Seminuevos GB Guasave', 'Guasave', '6442364338', '526442364338', true, now(), now()),
      ('seminuevos', 'Seminuevos GB Los Mochis', 'Los Mochis', '6442364338', '526442364338', true, now(), now())
    ON CONFLICT DO NOTHING;

    WITH demo(slug, agency_brand, agency_city, condition, mileage, body_type, transmission, fuel, stock_id) AS (
      VALUES
        ('territory', 'ford', 'Culiacan', 'new', 0, 'suv', 'automatic', 'gasoline', 'DEMO-FOR-TERR-26'),
        ('mazda2', 'mazda', 'Mazatlan', 'new', 0, 'sedan', 'automatic', 'gasoline', 'DEMO-MAZ-2-25'),
        ('p-22', 'dongfeng', 'Culiacan', 'new', 0, 'pickup', 'manual', 'diesel', 'DEMO-DFAC-P22-25'),
        ('ram-700', 'stellantis', 'Ciudad Obregon', 'new', 0, 'pickup', 'manual', 'gasoline', 'DEMO-RAM-700-25'),
        ('peugeot-2009', 'stellantis', 'Ciudad Obregon', 'new', 0, 'suv', 'automatic', 'gasoline', 'DEMO-PEU-2008-25'),
        ('pulse-fiat', 'stellantis', 'Ciudad Obregon', 'new', 0, 'suv', 'cvt', 'gasoline', 'DEMO-FIAT-PULSE-25'),
        ('navigator', 'lincoln', 'Culiacan', 'new', 0, 'suv', 'automatic', 'gasoline', 'DEMO-LIN-NAV-25'),
        ('x-70', 'jetour', 'Culiacan', 'new', 0, 'suv', 'automatic', 'gasoline', 'DEMO-JET-X70-25'),
        ('attitude', 'stellantis', 'Ciudad Obregon', 'new', 0, 'sedan', 'cvt', 'gasoline', 'DEMO-DOD-ATT-25'),
        ('acura-acura-mdx-3-5-at-2019-c7152b', 'seminuevos', 'Culiacan', 'used', 68200, 'suv', 'automatic', 'gasoline', 'USED-ACU-MDX-19'),
        ('ford-ford-territory-1-5t-163-hp-dct-2025-f95309', 'ford', 'Los Mochis', 'used', 9800, 'suv', 'automatic', 'gasoline', 'USED-FOR-TERR-25'),
        ('hafei-hafei-sigma-1-6-mt-2007-d4ea1d', 'seminuevos', 'Mazatlan', 'used', 118000, 'hatchback', 'manual', 'gasoline', 'USED-HAF-SIG-07')
    )
    UPDATE "vehicles" v
    SET
      "dealership_id" = d.id,
      "city" = demo.agency_city,
      "condition" = demo.condition::"public"."enum_vehicles_condition",
      "mileage" = demo.mileage,
      "body_type" = demo.body_type::"public"."enum_vehicles_body_type",
      "transmission" = demo.transmission::"public"."enum_vehicles_transmission",
      "fuel" = demo.fuel::"public"."enum_vehicles_fuel",
      "stock_id" = demo.stock_id,
      "inventory_status" = 'available'
    FROM demo
    JOIN "dealerships" d ON
      d."brand_name" = demo.agency_brand
      AND lower(translate(d."city", 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = lower(demo.agency_city)
    WHERE v."slug" = demo.slug;

    UPDATE "vehicles"
    SET "dealership_id" = (
      SELECT "id" FROM "dealerships" ORDER BY CASE WHEN "brand_name" = 'seminuevos' THEN 0 ELSE 1 END, "id" LIMIT 1
    )
    WHERE "dealership_id" IS NULL;

    ALTER TABLE "vehicles" ALTER COLUMN "dealership_id" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "vehicles" ALTER COLUMN "dealership_id" DROP NOT NULL;
    ALTER TABLE "vehicles" DROP CONSTRAINT IF EXISTS "vehicles_dealership_id_dealerships_id_fk";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "dealership_id";
    DROP TABLE IF EXISTS "vehicles_blocks_cta" CASCADE;
    DROP TABLE IF EXISTS "vehicles_blocks_feature_grid_items" CASCADE;
    DROP TABLE IF EXISTS "vehicles_blocks_feature_grid" CASCADE;
    DROP TABLE IF EXISTS "vehicles_blocks_highlight_list_items" CASCADE;
    DROP TABLE IF EXISTS "vehicles_blocks_highlight_list" CASCADE;
    DROP TABLE IF EXISTS "vehicles_blocks_gallery_images" CASCADE;
    DROP TABLE IF EXISTS "vehicles_blocks_gallery" CASCADE;
    DROP TABLE IF EXISTS "vehicles_blocks_image_text" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_vehicles_blocks_image_text_image_position";
  `)
}
