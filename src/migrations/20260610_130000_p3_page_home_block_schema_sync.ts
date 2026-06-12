import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * P3 schema sync for page/home builder blocks added after the original site
 * builder migration. The local DB had the collection/global records but was
 * missing these newer block tables, causing `/api/pages` reads to 500.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_city_inventory_layout" AS ENUM('cards','compact','map'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_promo_banner_variant" AS ENUM('image','split','compact'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_promo_banner_theme" AS ENUM('brand','light','dark'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_trust_steps_steps_icon" AS ENUM('search','inspection','financing','delivery','shield'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_trust_steps_layout" AS ENUM('steps','cards'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_testimonials_layout" AS ENUM('carousel','grid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_pages_blocks_video_tips_layout" AS ENUM('featured','grid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN CREATE TYPE "public"."enum_site_config_blocks_city_inventory_layout" AS ENUM('cards','compact','map'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_config_blocks_promo_banner_variant" AS ENUM('image','split','compact'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_config_blocks_promo_banner_theme" AS ENUM('brand','light','dark'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_config_blocks_trust_steps_steps_icon" AS ENUM('search','inspection','financing','delivery','shield'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_config_blocks_trust_steps_layout" AS ENUM('steps','cards'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_config_blocks_testimonials_layout" AS ENUM('carousel','grid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_site_config_blocks_video_tips_layout" AS ENUM('featured','grid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "pages_blocks_city_inventory" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Inventario por ciudad',
      "heading" varchar DEFAULT 'Encuentra seminuevos cerca de ti',
      "body" varchar,
      "layout" "public"."enum_pages_blocks_city_inventory_layout" DEFAULT 'cards',
      "limit" numeric DEFAULT 6,
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_city_inventory_cities" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "city" varchar,
      "label" varchar,
      "href" varchar,
      "image_id" integer
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_promo_banner" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Promocion',
      "heading" varchar DEFAULT 'Promocion especial',
      "body" varchar,
      "image_id" integer,
      "mobile_image_id" integer,
      "image_alt" varchar,
      "variant" "public"."enum_pages_blocks_promo_banner_variant" DEFAULT 'image',
      "theme" "public"."enum_pages_blocks_promo_banner_theme" DEFAULT 'brand',
      "href" varchar,
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_trust_steps" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Compra con confianza',
      "heading" varchar DEFAULT 'Te acompanamos en cada paso',
      "body" varchar,
      "layout" "public"."enum_pages_blocks_trust_steps_layout" DEFAULT 'steps',
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_trust_steps_steps" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "icon" "public"."enum_pages_blocks_trust_steps_steps_icon" DEFAULT 'search',
      "label" varchar,
      "description" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_testimonials" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Clientes felices',
      "heading" varchar DEFAULT 'Historias de nuestros clientes',
      "body" varchar,
      "layout" "public"."enum_pages_blocks_testimonials_layout" DEFAULT 'carousel',
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_testimonials_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "quote" varchar,
      "author" varchar,
      "role" varchar,
      "city" varchar,
      "rating" numeric DEFAULT 5,
      "image_id" integer
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_video_tips" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Guias en video',
      "heading" varchar DEFAULT 'Tips para elegir tu proximo auto',
      "body" varchar,
      "layout" "public"."enum_pages_blocks_video_tips_layout" DEFAULT 'featured',
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "pages_blocks_video_tips_videos" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "description" varchar,
      "video_url" varchar,
      "thumbnail_id" integer,
      "duration" varchar
    );

    CREATE TABLE IF NOT EXISTS "site_config_blocks_city_inventory" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Inventario por ciudad',
      "heading" varchar DEFAULT 'Encuentra seminuevos cerca de ti',
      "body" varchar,
      "layout" "public"."enum_site_config_blocks_city_inventory_layout" DEFAULT 'cards',
      "limit" numeric DEFAULT 6,
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "site_config_blocks_city_inventory_cities" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "city" varchar,
      "label" varchar,
      "href" varchar,
      "image_id" integer
    );
    CREATE TABLE IF NOT EXISTS "site_config_blocks_promo_banner" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Promocion',
      "heading" varchar DEFAULT 'Promocion especial',
      "body" varchar,
      "image_id" integer,
      "mobile_image_id" integer,
      "image_alt" varchar,
      "variant" "public"."enum_site_config_blocks_promo_banner_variant" DEFAULT 'image',
      "theme" "public"."enum_site_config_blocks_promo_banner_theme" DEFAULT 'brand',
      "href" varchar,
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "site_config_blocks_trust_steps" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Compra con confianza',
      "heading" varchar DEFAULT 'Te acompanamos en cada paso',
      "body" varchar,
      "layout" "public"."enum_site_config_blocks_trust_steps_layout" DEFAULT 'steps',
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "site_config_blocks_trust_steps_steps" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "icon" "public"."enum_site_config_blocks_trust_steps_steps_icon" DEFAULT 'search',
      "label" varchar,
      "description" varchar
    );
    CREATE TABLE IF NOT EXISTS "site_config_blocks_testimonials" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Clientes felices',
      "heading" varchar DEFAULT 'Historias de nuestros clientes',
      "body" varchar,
      "layout" "public"."enum_site_config_blocks_testimonials_layout" DEFAULT 'carousel',
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "site_config_blocks_testimonials_items" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "quote" varchar,
      "author" varchar,
      "role" varchar,
      "city" varchar,
      "rating" numeric DEFAULT 5,
      "image_id" integer
    );
    CREATE TABLE IF NOT EXISTS "site_config_blocks_video_tips" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "eyebrow" varchar DEFAULT 'Guias en video',
      "heading" varchar DEFAULT 'Tips para elegir tu proximo auto',
      "body" varchar,
      "layout" "public"."enum_site_config_blocks_video_tips_layout" DEFAULT 'featured',
      "cta_label" varchar,
      "cta_href" varchar,
      "block_name" varchar
    );
    CREATE TABLE IF NOT EXISTS "site_config_blocks_video_tips_videos" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar,
      "description" varchar,
      "video_url" varchar,
      "thumbnail_id" integer,
      "duration" varchar
    );

    DO $$ BEGIN ALTER TABLE "pages_blocks_city_inventory" ADD CONSTRAINT "pages_blocks_city_inventory_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_city_inventory_cities" ADD CONSTRAINT "pages_blocks_city_inventory_cities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_city_inventory"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_city_inventory_cities" ADD CONSTRAINT "pages_blocks_city_inventory_cities_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_promo_banner" ADD CONSTRAINT "pages_blocks_promo_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_promo_banner" ADD CONSTRAINT "pages_blocks_promo_banner_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_promo_banner" ADD CONSTRAINT "pages_blocks_promo_banner_mobile_image_id_media_id_fk" FOREIGN KEY ("mobile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_trust_steps" ADD CONSTRAINT "pages_blocks_trust_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_trust_steps_steps" ADD CONSTRAINT "pages_blocks_trust_steps_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_trust_steps"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_testimonials" ADD CONSTRAINT "pages_blocks_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_testimonials_items" ADD CONSTRAINT "pages_blocks_testimonials_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_testimonials"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_testimonials_items" ADD CONSTRAINT "pages_blocks_testimonials_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_video_tips" ADD CONSTRAINT "pages_blocks_video_tips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_video_tips_videos" ADD CONSTRAINT "pages_blocks_video_tips_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_video_tips"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "pages_blocks_video_tips_videos" ADD CONSTRAINT "pages_blocks_video_tips_videos_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN ALTER TABLE "site_config_blocks_city_inventory" ADD CONSTRAINT "site_config_blocks_city_inventory_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_city_inventory_cities" ADD CONSTRAINT "site_config_blocks_city_inventory_cities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config_blocks_city_inventory"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_city_inventory_cities" ADD CONSTRAINT "site_config_blocks_city_inventory_cities_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_promo_banner" ADD CONSTRAINT "site_config_blocks_promo_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_promo_banner" ADD CONSTRAINT "site_config_blocks_promo_banner_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_promo_banner" ADD CONSTRAINT "site_config_blocks_promo_banner_mobile_image_id_media_id_fk" FOREIGN KEY ("mobile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_trust_steps" ADD CONSTRAINT "site_config_blocks_trust_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_trust_steps_steps" ADD CONSTRAINT "site_config_blocks_trust_steps_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config_blocks_trust_steps"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_testimonials" ADD CONSTRAINT "site_config_blocks_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_testimonials_items" ADD CONSTRAINT "site_config_blocks_testimonials_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config_blocks_testimonials"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_testimonials_items" ADD CONSTRAINT "site_config_blocks_testimonials_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_video_tips" ADD CONSTRAINT "site_config_blocks_video_tips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_video_tips_videos" ADD CONSTRAINT "site_config_blocks_video_tips_videos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config_blocks_video_tips"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "site_config_blocks_video_tips_videos" ADD CONSTRAINT "site_config_blocks_video_tips_videos_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "pages_blocks_city_inventory_order_idx" ON "pages_blocks_city_inventory" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_city_inventory_parent_id_idx" ON "pages_blocks_city_inventory" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_city_inventory_path_idx" ON "pages_blocks_city_inventory" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_city_inventory_cities_order_idx" ON "pages_blocks_city_inventory_cities" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_city_inventory_cities_parent_id_idx" ON "pages_blocks_city_inventory_cities" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_city_inventory_cities_image_idx" ON "pages_blocks_city_inventory_cities" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_promo_banner_order_idx" ON "pages_blocks_promo_banner" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_promo_banner_parent_id_idx" ON "pages_blocks_promo_banner" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_promo_banner_path_idx" ON "pages_blocks_promo_banner" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_promo_banner_image_idx" ON "pages_blocks_promo_banner" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_promo_banner_mobile_image_idx" ON "pages_blocks_promo_banner" USING btree ("mobile_image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_trust_steps_order_idx" ON "pages_blocks_trust_steps" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_trust_steps_parent_id_idx" ON "pages_blocks_trust_steps" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_trust_steps_path_idx" ON "pages_blocks_trust_steps" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_trust_steps_steps_order_idx" ON "pages_blocks_trust_steps_steps" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_trust_steps_steps_parent_id_idx" ON "pages_blocks_trust_steps_steps" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_order_idx" ON "pages_blocks_testimonials" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_parent_id_idx" ON "pages_blocks_testimonials" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_path_idx" ON "pages_blocks_testimonials" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_items_order_idx" ON "pages_blocks_testimonials_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_items_parent_id_idx" ON "pages_blocks_testimonials_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_testimonials_items_image_idx" ON "pages_blocks_testimonials_items" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_video_tips_order_idx" ON "pages_blocks_video_tips" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_video_tips_parent_id_idx" ON "pages_blocks_video_tips" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_video_tips_path_idx" ON "pages_blocks_video_tips" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "pages_blocks_video_tips_videos_order_idx" ON "pages_blocks_video_tips_videos" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "pages_blocks_video_tips_videos_parent_id_idx" ON "pages_blocks_video_tips_videos" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pages_blocks_video_tips_videos_thumbnail_idx" ON "pages_blocks_video_tips_videos" USING btree ("thumbnail_id");

    CREATE INDEX IF NOT EXISTS "site_config_blocks_city_inventory_order_idx" ON "site_config_blocks_city_inventory" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_city_inventory_parent_id_idx" ON "site_config_blocks_city_inventory" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_city_inventory_path_idx" ON "site_config_blocks_city_inventory" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_city_inventory_cities_order_idx" ON "site_config_blocks_city_inventory_cities" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_city_inventory_cities_parent_id_idx" ON "site_config_blocks_city_inventory_cities" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_city_inventory_cities_image_idx" ON "site_config_blocks_city_inventory_cities" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_promo_banner_order_idx" ON "site_config_blocks_promo_banner" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_promo_banner_parent_id_idx" ON "site_config_blocks_promo_banner" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_promo_banner_path_idx" ON "site_config_blocks_promo_banner" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_promo_banner_image_idx" ON "site_config_blocks_promo_banner" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_promo_banner_mobile_image_idx" ON "site_config_blocks_promo_banner" USING btree ("mobile_image_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_trust_steps_order_idx" ON "site_config_blocks_trust_steps" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_trust_steps_parent_id_idx" ON "site_config_blocks_trust_steps" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_trust_steps_path_idx" ON "site_config_blocks_trust_steps" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_trust_steps_steps_order_idx" ON "site_config_blocks_trust_steps_steps" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_trust_steps_steps_parent_id_idx" ON "site_config_blocks_trust_steps_steps" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_testimonials_order_idx" ON "site_config_blocks_testimonials" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_testimonials_parent_id_idx" ON "site_config_blocks_testimonials" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_testimonials_path_idx" ON "site_config_blocks_testimonials" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_testimonials_items_order_idx" ON "site_config_blocks_testimonials_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_testimonials_items_parent_id_idx" ON "site_config_blocks_testimonials_items" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_testimonials_items_image_idx" ON "site_config_blocks_testimonials_items" USING btree ("image_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_video_tips_order_idx" ON "site_config_blocks_video_tips" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_video_tips_parent_id_idx" ON "site_config_blocks_video_tips" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_video_tips_path_idx" ON "site_config_blocks_video_tips" USING btree ("_path");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_video_tips_videos_order_idx" ON "site_config_blocks_video_tips_videos" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_video_tips_videos_parent_id_idx" ON "site_config_blocks_video_tips_videos" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "site_config_blocks_video_tips_videos_thumbnail_idx" ON "site_config_blocks_video_tips_videos" USING btree ("thumbnail_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "site_config_blocks_video_tips_videos" CASCADE;
    DROP TABLE IF EXISTS "site_config_blocks_video_tips" CASCADE;
    DROP TABLE IF EXISTS "site_config_blocks_testimonials_items" CASCADE;
    DROP TABLE IF EXISTS "site_config_blocks_testimonials" CASCADE;
    DROP TABLE IF EXISTS "site_config_blocks_trust_steps_steps" CASCADE;
    DROP TABLE IF EXISTS "site_config_blocks_trust_steps" CASCADE;
    DROP TABLE IF EXISTS "site_config_blocks_promo_banner" CASCADE;
    DROP TABLE IF EXISTS "site_config_blocks_city_inventory_cities" CASCADE;
    DROP TABLE IF EXISTS "site_config_blocks_city_inventory" CASCADE;

    DROP TABLE IF EXISTS "pages_blocks_video_tips_videos" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_video_tips" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_testimonials_items" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_testimonials" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_trust_steps_steps" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_trust_steps" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_promo_banner" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_city_inventory_cities" CASCADE;
    DROP TABLE IF EXISTS "pages_blocks_city_inventory" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_site_config_blocks_video_tips_layout";
    DROP TYPE IF EXISTS "public"."enum_site_config_blocks_testimonials_layout";
    DROP TYPE IF EXISTS "public"."enum_site_config_blocks_trust_steps_layout";
    DROP TYPE IF EXISTS "public"."enum_site_config_blocks_trust_steps_steps_icon";
    DROP TYPE IF EXISTS "public"."enum_site_config_blocks_promo_banner_theme";
    DROP TYPE IF EXISTS "public"."enum_site_config_blocks_promo_banner_variant";
    DROP TYPE IF EXISTS "public"."enum_site_config_blocks_city_inventory_layout";

    DROP TYPE IF EXISTS "public"."enum_pages_blocks_video_tips_layout";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_testimonials_layout";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_trust_steps_layout";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_trust_steps_steps_icon";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_promo_banner_theme";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_promo_banner_variant";
    DROP TYPE IF EXISTS "public"."enum_pages_blocks_city_inventory_layout";
  `)
}
