import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_template_overrides_gallery" AS ENUM('inherit','show','hide'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_template_overrides_purchase_card" AS ENUM('inherit','show','hide'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_template_overrides_quick_specs" AS ENUM('inherit','show','hide'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_template_overrides_description" AS ENUM('inherit','show','hide'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_template_overrides_features" AS ENUM('inherit','show','hide'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_template_overrides_similar_vehicles" AS ENUM('inherit','show','hide'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE TYPE "public"."enum_vehicles_template_overrides_mobile_cta" AS ENUM('inherit','show','hide'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "template_overrides_gallery" "public"."enum_vehicles_template_overrides_gallery" DEFAULT 'inherit';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "template_overrides_purchase_card" "public"."enum_vehicles_template_overrides_purchase_card" DEFAULT 'inherit';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "template_overrides_quick_specs" "public"."enum_vehicles_template_overrides_quick_specs" DEFAULT 'inherit';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "template_overrides_description" "public"."enum_vehicles_template_overrides_description" DEFAULT 'inherit';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "template_overrides_features" "public"."enum_vehicles_template_overrides_features" DEFAULT 'inherit';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "template_overrides_similar_vehicles" "public"."enum_vehicles_template_overrides_similar_vehicles" DEFAULT 'inherit';
    ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "template_overrides_mobile_cta" "public"."enum_vehicles_template_overrides_mobile_cta" DEFAULT 'inherit';

    ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "templates_vehicle_detail_show_gallery" boolean DEFAULT true;
    ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "templates_vehicle_detail_show_purchase_card" boolean DEFAULT true;
    ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "templates_vehicle_detail_show_quick_specs" boolean DEFAULT true;
    ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "templates_vehicle_detail_show_description" boolean DEFAULT true;
    ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "templates_vehicle_detail_show_features" boolean DEFAULT true;
    ALTER TABLE "site_config" ADD COLUMN IF NOT EXISTS "templates_vehicle_detail_show_mobile_cta" boolean DEFAULT true;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_config" DROP COLUMN IF EXISTS "templates_vehicle_detail_show_mobile_cta";
    ALTER TABLE "site_config" DROP COLUMN IF EXISTS "templates_vehicle_detail_show_features";
    ALTER TABLE "site_config" DROP COLUMN IF EXISTS "templates_vehicle_detail_show_description";
    ALTER TABLE "site_config" DROP COLUMN IF EXISTS "templates_vehicle_detail_show_quick_specs";
    ALTER TABLE "site_config" DROP COLUMN IF EXISTS "templates_vehicle_detail_show_purchase_card";
    ALTER TABLE "site_config" DROP COLUMN IF EXISTS "templates_vehicle_detail_show_gallery";

    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "template_overrides_mobile_cta";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "template_overrides_similar_vehicles";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "template_overrides_features";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "template_overrides_description";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "template_overrides_quick_specs";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "template_overrides_purchase_card";
    ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "template_overrides_gallery";

    DROP TYPE IF EXISTS "public"."enum_vehicles_template_overrides_mobile_cta";
    DROP TYPE IF EXISTS "public"."enum_vehicles_template_overrides_similar_vehicles";
    DROP TYPE IF EXISTS "public"."enum_vehicles_template_overrides_features";
    DROP TYPE IF EXISTS "public"."enum_vehicles_template_overrides_description";
    DROP TYPE IF EXISTS "public"."enum_vehicles_template_overrides_quick_specs";
    DROP TYPE IF EXISTS "public"."enum_vehicles_template_overrides_purchase_card";
    DROP TYPE IF EXISTS "public"."enum_vehicles_template_overrides_gallery";
  `)
}
