import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_vehicles_landing_highlights_icon" AS ENUM('engine', 'power', 'transmission', 'safety', 'comfort', 'technology');
  CREATE TYPE "public"."enum_vehicles_landing_feature_sections_type" AS ENUM('comfort', 'technology', 'safety', 'design', 'performance');
  CREATE TYPE "public"."enum_vehicles_landing_feature_sections_theme" AS ENUM('light', 'dark', 'cream');
  CREATE TYPE "public"."imgPos" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_vehicles_condition" AS ENUM('new', 'used');
  CREATE TYPE "public"."enum_vehicles_body_type" AS ENUM('sedan', 'suv', 'pickup', 'coupe', 'hatchback', 'van', 'other');
  CREATE TYPE "public"."enum_vehicles_transmission" AS ENUM('automatic', 'manual', 'cvt');
  CREATE TYPE "public"."enum_vehicles_fuel" AS ENUM('gasoline', 'diesel', 'hybrid', 'electric');
  CREATE TYPE "public"."enum_vehicles_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__vehicles_v_version_landing_highlights_icon" AS ENUM('engine', 'power', 'transmission', 'safety', 'comfort', 'technology');
  CREATE TYPE "public"."enum__vehicles_v_version_landing_feature_sections_type" AS ENUM('comfort', 'technology', 'safety', 'design', 'performance');
  CREATE TYPE "public"."enum__vehicles_v_version_landing_feature_sections_theme" AS ENUM('light', 'dark', 'cream');
  CREATE TYPE "public"."enum__vehicles_v_version_condition" AS ENUM('new', 'used');
  CREATE TYPE "public"."enum__vehicles_v_version_body_type" AS ENUM('sedan', 'suv', 'pickup', 'coupe', 'hatchback', 'van', 'other');
  CREATE TYPE "public"."enum__vehicles_v_version_transmission" AS ENUM('automatic', 'manual', 'cvt');
  CREATE TYPE "public"."enum__vehicles_v_version_fuel" AS ENUM('gasoline', 'diesel', 'hybrid', 'electric');
  CREATE TYPE "public"."enum__vehicles_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_leads_source" AS ENUM('website_form', 'whatsapp', 'phone', 'walk_in');
  CREATE TYPE "public"."enum_leads_stage" AS ENUM('new', 'contacted', 'in_progress', 'closed_won', 'closed_lost');
  CREATE TYPE "public"."enum_pages_blocks_featured_vehicles_source" AS ENUM('latestUsed', 'manual');
  CREATE TYPE "public"."enum_pages_blocks_media_text_layout" AS ENUM('mediaLeft', 'mediaRight');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_blocks_featured_vehicles_source" AS ENUM('latestUsed', 'manual');
  CREATE TYPE "public"."enum__pages_v_blocks_media_text_layout" AS ENUM('mediaLeft', 'mediaRight');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_analytics_events_event_type" AS ENUM('page_view', 'vehicle_view', 'vehicle_click', 'cta_click', 'page_duration');
  CREATE TYPE "public"."enum_analytics_events_device_type" AS ENUM('mobile', 'tablet', 'desktop');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_site_config_blocks_featured_vehicles_source" AS ENUM('latestUsed', 'manual');
  CREATE TYPE "public"."enum_site_config_blocks_media_text_layout" AS ENUM('mediaLeft', 'mediaRight');
  CREATE TYPE "public"."enum_site_config_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__site_config_v_blocks_featured_vehicles_source" AS ENUM('latestUsed', 'manual');
  CREATE TYPE "public"."enum__site_config_v_blocks_media_text_layout" AS ENUM('mediaLeft', 'mediaRight');
  CREATE TYPE "public"."enum__site_config_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "vehicles_badges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "vehicles_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar
  );
  
  CREATE TABLE "vehicles_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "vehicles_custom_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "vehicles_landing_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" "enum_vehicles_landing_highlights_icon",
  	"label" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "vehicles_landing_versions_key_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "vehicles_landing_versions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"price" varchar,
  	"cta_label" varchar
  );
  
  CREATE TABLE "vehicles_landing_feature_sections_bullets" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "vehicles_landing_feature_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_vehicles_landing_feature_sections_type",
  	"label" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"theme" "enum_vehicles_landing_feature_sections_theme" DEFAULT 'light',
  	"image_position" "imgPos" DEFAULT 'left'
  );
  
  CREATE TABLE "vehicles_landing_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar
  );
  
  CREATE TABLE "vehicles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"uuid" varchar,
  	"slug" varchar,
  	"brand" varchar,
  	"model" varchar,
  	"year" numeric,
  	"condition" "enum_vehicles_condition" DEFAULT 'new',
  	"city" varchar,
  	"mileage" numeric,
  	"body_type" "enum_vehicles_body_type",
  	"transmission" "enum_vehicles_transmission",
  	"fuel" "enum_vehicles_fuel",
  	"price" varchar,
  	"status" "enum_vehicles_status" DEFAULT 'available',
  	"image_id" integer,
  	"description" varchar,
  	"specs_motor" varchar,
  	"specs_potencia" varchar,
  	"specs_transmision" varchar,
  	"specs_combustible" varchar,
  	"specs_traccion" varchar,
  	"landing_section_settings_show_hero" boolean DEFAULT true,
  	"landing_section_settings_show_highlights" boolean DEFAULT true,
  	"landing_section_settings_show_versions" boolean DEFAULT true,
  	"landing_section_settings_show_feature_sections" boolean DEFAULT true,
  	"landing_section_settings_show_specs" boolean DEFAULT true,
  	"landing_section_settings_show_gallery" boolean DEFAULT true,
  	"landing_section_settings_show_final_cta" boolean DEFAULT true,
  	"landing_hero_eyebrow" varchar,
  	"landing_hero_headline" varchar,
  	"landing_hero_subheadline" varchar,
  	"landing_hero_image_id" integer,
  	"landing_hero_primary_cta_label" varchar,
  	"landing_hero_secondary_cta_label" varchar,
  	"landing_final_cta_heading" varchar,
  	"landing_final_cta_body" varchar,
  	"landing_final_cta_primary_label" varchar,
  	"landing_final_cta_show_whatsapp" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_vehicles_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_vehicles_v_version_badges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v_version_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v_version_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"feature" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v_version_custom_fields" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v_version_landing_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"icon" "enum__vehicles_v_version_landing_highlights_icon",
  	"label" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v_version_landing_versions_key_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"feature" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v_version_landing_versions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"price" varchar,
  	"cta_label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v_version_landing_feature_sections_bullets" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"feature" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v_version_landing_feature_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum__vehicles_v_version_landing_feature_sections_type",
  	"label" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"image_id" integer,
  	"theme" "enum__vehicles_v_version_landing_feature_sections_theme" DEFAULT 'light',
  	"image_position" "imgPos" DEFAULT 'left',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v_version_landing_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_vehicles_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_uuid" varchar,
  	"version_slug" varchar,
  	"version_brand" varchar,
  	"version_model" varchar,
  	"version_year" numeric,
  	"version_condition" "enum__vehicles_v_version_condition" DEFAULT 'new',
  	"version_city" varchar,
  	"version_mileage" numeric,
  	"version_body_type" "enum__vehicles_v_version_body_type",
  	"version_transmission" "enum__vehicles_v_version_transmission",
  	"version_fuel" "enum__vehicles_v_version_fuel",
  	"version_price" varchar,
  	"version_status" "enum__vehicles_v_version_status" DEFAULT 'available',
  	"version_image_id" integer,
  	"version_description" varchar,
  	"version_specs_motor" varchar,
  	"version_specs_potencia" varchar,
  	"version_specs_transmision" varchar,
  	"version_specs_combustible" varchar,
  	"version_specs_traccion" varchar,
  	"version_landing_section_settings_show_hero" boolean DEFAULT true,
  	"version_landing_section_settings_show_highlights" boolean DEFAULT true,
  	"version_landing_section_settings_show_versions" boolean DEFAULT true,
  	"version_landing_section_settings_show_feature_sections" boolean DEFAULT true,
  	"version_landing_section_settings_show_specs" boolean DEFAULT true,
  	"version_landing_section_settings_show_gallery" boolean DEFAULT true,
  	"version_landing_section_settings_show_final_cta" boolean DEFAULT true,
  	"version_landing_hero_eyebrow" varchar,
  	"version_landing_hero_headline" varchar,
  	"version_landing_hero_subheadline" varchar,
  	"version_landing_hero_image_id" integer,
  	"version_landing_hero_primary_cta_label" varchar,
  	"version_landing_hero_secondary_cta_label" varchar,
  	"version_landing_final_cta_heading" varchar,
  	"version_landing_final_cta_body" varchar,
  	"version_landing_final_cta_primary_label" varchar,
  	"version_landing_final_cta_show_whatsapp" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__vehicles_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "dealerships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"brand_name" varchar NOT NULL,
  	"display_name" varchar NOT NULL,
  	"city" varchar NOT NULL,
  	"phone" varchar,
  	"whatsapp" varchar,
  	"coordinates_lat" numeric,
  	"coordinates_lng" numeric,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "leads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar,
  	"email" varchar,
  	"phone" varchar NOT NULL,
  	"source" "enum_leads_source" DEFAULT 'website_form',
  	"vehicle_id" integer,
  	"message" varchar,
  	"stage" "enum_leads_stage" DEFAULT 'new',
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"video_url" varchar,
  	"primary_link_label" varchar,
  	"primary_link_href" varchar,
  	"secondary_link_label" varchar,
  	"secondary_link_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_promo_strip_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar,
  	"href" varchar
  );
  
  CREATE TABLE "pages_blocks_promo_strip" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_featured_vehicles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Seminuevos',
  	"heading" varchar DEFAULT 'Vehiculos destacados',
  	"body" varchar,
  	"limit" numeric DEFAULT 6,
  	"source" "enum_pages_blocks_featured_vehicles_source" DEFAULT 'latestUsed',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_brands" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Marcas',
  	"heading" varchar DEFAULT 'Las mejores marcas, en un solo lugar',
  	"body" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_agencies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Encuentranos',
  	"heading" varchar DEFAULT 'Nuestras agencias',
  	"body" varchar,
  	"show_map" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_media_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"layout" "enum_pages_blocks_media_text_layout" DEFAULT 'mediaLeft',
  	"link_label" varchar,
  	"link_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"primary_link_label" varchar,
  	"primary_link_href" varchar,
  	"secondary_link_label" varchar,
  	"secondary_link_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"is_visible" boolean DEFAULT true,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"seo_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "pages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"vehicles_id" integer
  );
  
  CREATE TABLE "_pages_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"video_url" varchar,
  	"primary_link_label" varchar,
  	"primary_link_href" varchar,
  	"secondary_link_label" varchar,
  	"secondary_link_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_promo_strip_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar,
  	"href" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_promo_strip" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_featured_vehicles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Seminuevos',
  	"heading" varchar DEFAULT 'Vehiculos destacados',
  	"body" varchar,
  	"limit" numeric DEFAULT 6,
  	"source" "enum__pages_v_blocks_featured_vehicles_source" DEFAULT 'latestUsed',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_brands" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Marcas',
  	"heading" varchar DEFAULT 'Las mejores marcas, en un solo lugar',
  	"body" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_agencies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Encuentranos',
  	"heading" varchar DEFAULT 'Nuestras agencias',
  	"body" varchar,
  	"show_map" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_media_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"layout" "enum__pages_v_blocks_media_text_layout" DEFAULT 'mediaLeft',
  	"link_label" varchar,
  	"link_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"primary_link_label" varchar,
  	"primary_link_href" varchar,
  	"secondary_link_label" varchar,
  	"secondary_link_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_is_visible" boolean DEFAULT true,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_seo_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_pages_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"vehicles_id" integer
  );
  
  CREATE TABLE "analytics_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_type" "enum_analytics_events_event_type" NOT NULL,
  	"page_path" varchar NOT NULL,
  	"page_title" varchar,
  	"vehicle_id" integer,
  	"vehicle_label" varchar,
  	"target_label" varchar,
  	"duration_seconds" numeric,
  	"session_id" varchar,
  	"visitor_id" varchar,
  	"device_type" "enum_analytics_events_device_type",
  	"referrer" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"vehicles_id" integer,
  	"dealerships_id" integer,
  	"leads_id" integer,
  	"pages_id" integer,
  	"analytics_events_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_config_navigation_main_links_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar
  );
  
  CREATE TABLE "site_config_navigation_main_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar
  );
  
  CREATE TABLE "site_config_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"video_url" varchar,
  	"primary_link_label" varchar,
  	"primary_link_href" varchar,
  	"secondary_link_label" varchar,
  	"secondary_link_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "site_config_blocks_promo_strip_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar,
  	"href" varchar
  );
  
  CREATE TABLE "site_config_blocks_promo_strip" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "site_config_blocks_featured_vehicles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Seminuevos',
  	"heading" varchar DEFAULT 'Vehiculos destacados',
  	"body" varchar,
  	"limit" numeric DEFAULT 6,
  	"source" "enum_site_config_blocks_featured_vehicles_source" DEFAULT 'latestUsed',
  	"block_name" varchar
  );
  
  CREATE TABLE "site_config_blocks_brands" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Marcas',
  	"heading" varchar DEFAULT 'Las mejores marcas, en un solo lugar',
  	"body" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "site_config_blocks_agencies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Encuentranos',
  	"heading" varchar DEFAULT 'Nuestras agencias',
  	"body" varchar,
  	"show_map" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "site_config_blocks_media_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"layout" "enum_site_config_blocks_media_text_layout" DEFAULT 'mediaLeft',
  	"link_label" varchar,
  	"link_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "site_config_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"primary_link_label" varchar,
  	"primary_link_href" varchar,
  	"secondary_link_label" varchar,
  	"secondary_link_href" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "site_config" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"general_site_name" varchar DEFAULT 'GB Automotriz',
  	"general_company_name" varchar,
  	"general_slogan" varchar,
  	"general_logo_id" integer,
  	"general_phone" varchar,
  	"general_whatsapp" varchar,
  	"general_email" varchar,
  	"general_address" varchar,
  	"general_social_links_facebook" varchar,
  	"general_social_links_instagram" varchar,
  	"general_social_links_whatsapp_url" varchar,
  	"navigation_cta_label" varchar,
  	"navigation_cta_href" varchar,
  	"templates_seminuevos_title" varchar DEFAULT 'Autos seminuevos',
  	"templates_seminuevos_intro" varchar,
  	"templates_seminuevos_hero_image_id" integer,
  	"templates_seminuevos_show_location_prompt" boolean DEFAULT true,
  	"templates_vehicle_detail_show_similar_vehicles" boolean DEFAULT true,
  	"templates_vehicle_detail_cta_heading" varchar DEFAULT 'Aparta este vehiculo',
  	"templates_vehicle_detail_cta_body" varchar,
  	"_status" "enum_site_config_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_config_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"vehicles_id" integer
  );
  
  CREATE TABLE "_site_config_v_version_navigation_main_links_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_config_v_version_navigation_main_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_config_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"video_url" varchar,
  	"primary_link_label" varchar,
  	"primary_link_href" varchar,
  	"secondary_link_label" varchar,
  	"secondary_link_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_site_config_v_blocks_promo_strip_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar,
  	"href" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_site_config_v_blocks_promo_strip" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_site_config_v_blocks_featured_vehicles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Seminuevos',
  	"heading" varchar DEFAULT 'Vehiculos destacados',
  	"body" varchar,
  	"limit" numeric DEFAULT 6,
  	"source" "enum__site_config_v_blocks_featured_vehicles_source" DEFAULT 'latestUsed',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_site_config_v_blocks_brands" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Marcas',
  	"heading" varchar DEFAULT 'Las mejores marcas, en un solo lugar',
  	"body" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_site_config_v_blocks_agencies" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar DEFAULT 'Encuentranos',
  	"heading" varchar DEFAULT 'Nuestras agencias',
  	"body" varchar,
  	"show_map" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_site_config_v_blocks_media_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"eyebrow" varchar,
  	"heading" varchar,
  	"body" varchar,
  	"media_id" integer,
  	"layout" "enum__site_config_v_blocks_media_text_layout" DEFAULT 'mediaLeft',
  	"link_label" varchar,
  	"link_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_site_config_v_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"primary_link_label" varchar,
  	"primary_link_href" varchar,
  	"secondary_link_label" varchar,
  	"secondary_link_href" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_site_config_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_general_site_name" varchar DEFAULT 'GB Automotriz',
  	"version_general_company_name" varchar,
  	"version_general_slogan" varchar,
  	"version_general_logo_id" integer,
  	"version_general_phone" varchar,
  	"version_general_whatsapp" varchar,
  	"version_general_email" varchar,
  	"version_general_address" varchar,
  	"version_general_social_links_facebook" varchar,
  	"version_general_social_links_instagram" varchar,
  	"version_general_social_links_whatsapp_url" varchar,
  	"version_navigation_cta_label" varchar,
  	"version_navigation_cta_href" varchar,
  	"version_templates_seminuevos_title" varchar DEFAULT 'Autos seminuevos',
  	"version_templates_seminuevos_intro" varchar,
  	"version_templates_seminuevos_hero_image_id" integer,
  	"version_templates_seminuevos_show_location_prompt" boolean DEFAULT true,
  	"version_templates_vehicle_detail_show_similar_vehicles" boolean DEFAULT true,
  	"version_templates_vehicle_detail_cta_heading" varchar DEFAULT 'Aparta este vehiculo',
  	"version_templates_vehicle_detail_cta_body" varchar,
  	"version__status" "enum__site_config_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_site_config_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"vehicles_id" integer
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_badges" ADD CONSTRAINT "vehicles_badges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_gallery" ADD CONSTRAINT "vehicles_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles_gallery" ADD CONSTRAINT "vehicles_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_features" ADD CONSTRAINT "vehicles_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_custom_fields" ADD CONSTRAINT "vehicles_custom_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_landing_highlights" ADD CONSTRAINT "vehicles_landing_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_landing_versions_key_features" ADD CONSTRAINT "vehicles_landing_versions_key_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles_landing_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_landing_versions" ADD CONSTRAINT "vehicles_landing_versions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_landing_feature_sections_bullets" ADD CONSTRAINT "vehicles_landing_feature_sections_bullets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles_landing_feature_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_landing_feature_sections" ADD CONSTRAINT "vehicles_landing_feature_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles_landing_feature_sections" ADD CONSTRAINT "vehicles_landing_feature_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles_landing_gallery" ADD CONSTRAINT "vehicles_landing_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles_landing_gallery" ADD CONSTRAINT "vehicles_landing_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_landing_hero_image_id_media_id_fk" FOREIGN KEY ("landing_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_badges" ADD CONSTRAINT "_vehicles_v_version_badges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_gallery" ADD CONSTRAINT "_vehicles_v_version_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_gallery" ADD CONSTRAINT "_vehicles_v_version_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_features" ADD CONSTRAINT "_vehicles_v_version_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_custom_fields" ADD CONSTRAINT "_vehicles_v_version_custom_fields_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_landing_highlights" ADD CONSTRAINT "_vehicles_v_version_landing_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_landing_versions_key_features" ADD CONSTRAINT "_vehicles_v_version_landing_versions_key_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v_version_landing_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_landing_versions" ADD CONSTRAINT "_vehicles_v_version_landing_versions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_landing_feature_sections_bullets" ADD CONSTRAINT "_vehicles_v_version_landing_feature_sections_bullets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v_version_landing_feature_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_landing_feature_sections" ADD CONSTRAINT "_vehicles_v_version_landing_feature_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_landing_feature_sections" ADD CONSTRAINT "_vehicles_v_version_landing_feature_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_landing_gallery" ADD CONSTRAINT "_vehicles_v_version_landing_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_vehicles_v_version_landing_gallery" ADD CONSTRAINT "_vehicles_v_version_landing_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_vehicles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_vehicles_v" ADD CONSTRAINT "_vehicles_v_parent_id_vehicles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_vehicles_v" ADD CONSTRAINT "_vehicles_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_vehicles_v" ADD CONSTRAINT "_vehicles_v_version_landing_hero_image_id_media_id_fk" FOREIGN KEY ("version_landing_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_promo_strip_items" ADD CONSTRAINT "pages_blocks_promo_strip_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_promo_strip_items" ADD CONSTRAINT "pages_blocks_promo_strip_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_promo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_promo_strip" ADD CONSTRAINT "pages_blocks_promo_strip_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_featured_vehicles" ADD CONSTRAINT "pages_blocks_featured_vehicles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_brands" ADD CONSTRAINT "pages_blocks_brands_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_agencies" ADD CONSTRAINT "pages_blocks_agencies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_text" ADD CONSTRAINT "pages_blocks_media_text_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_text" ADD CONSTRAINT "pages_blocks_media_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_cta" ADD CONSTRAINT "pages_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_image_id_media_id_fk" FOREIGN KEY ("seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_vehicles_fk" FOREIGN KEY ("vehicles_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_promo_strip_items" ADD CONSTRAINT "_pages_v_blocks_promo_strip_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_promo_strip_items" ADD CONSTRAINT "_pages_v_blocks_promo_strip_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_promo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_promo_strip" ADD CONSTRAINT "_pages_v_blocks_promo_strip_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_featured_vehicles" ADD CONSTRAINT "_pages_v_blocks_featured_vehicles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_brands" ADD CONSTRAINT "_pages_v_blocks_brands_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_agencies" ADD CONSTRAINT "_pages_v_blocks_agencies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_text" ADD CONSTRAINT "_pages_v_blocks_media_text_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_text" ADD CONSTRAINT "_pages_v_blocks_media_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_cta" ADD CONSTRAINT "_pages_v_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_image_id_media_id_fk" FOREIGN KEY ("version_seo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_vehicles_fk" FOREIGN KEY ("vehicles_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vehicles_fk" FOREIGN KEY ("vehicles_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_dealerships_fk" FOREIGN KEY ("dealerships_id") REFERENCES "public"."dealerships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_analytics_events_fk" FOREIGN KEY ("analytics_events_id") REFERENCES "public"."analytics_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_navigation_main_links_children" ADD CONSTRAINT "site_config_navigation_main_links_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config_navigation_main_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_navigation_main_links" ADD CONSTRAINT "site_config_navigation_main_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_blocks_hero" ADD CONSTRAINT "site_config_blocks_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_config_blocks_hero" ADD CONSTRAINT "site_config_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_blocks_promo_strip_items" ADD CONSTRAINT "site_config_blocks_promo_strip_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_config_blocks_promo_strip_items" ADD CONSTRAINT "site_config_blocks_promo_strip_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config_blocks_promo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_blocks_promo_strip" ADD CONSTRAINT "site_config_blocks_promo_strip_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_blocks_featured_vehicles" ADD CONSTRAINT "site_config_blocks_featured_vehicles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_blocks_brands" ADD CONSTRAINT "site_config_blocks_brands_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_blocks_agencies" ADD CONSTRAINT "site_config_blocks_agencies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_blocks_media_text" ADD CONSTRAINT "site_config_blocks_media_text_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_config_blocks_media_text" ADD CONSTRAINT "site_config_blocks_media_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_blocks_cta" ADD CONSTRAINT "site_config_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config" ADD CONSTRAINT "site_config_general_logo_id_media_id_fk" FOREIGN KEY ("general_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_config" ADD CONSTRAINT "site_config_templates_seminuevos_hero_image_id_media_id_fk" FOREIGN KEY ("templates_seminuevos_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_config_rels" ADD CONSTRAINT "site_config_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_config"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_config_rels" ADD CONSTRAINT "site_config_rels_vehicles_fk" FOREIGN KEY ("vehicles_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_version_navigation_main_links_children" ADD CONSTRAINT "_site_config_v_version_navigation_main_links_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v_version_navigation_main_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_version_navigation_main_links" ADD CONSTRAINT "_site_config_v_version_navigation_main_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_hero" ADD CONSTRAINT "_site_config_v_blocks_hero_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_hero" ADD CONSTRAINT "_site_config_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_promo_strip_items" ADD CONSTRAINT "_site_config_v_blocks_promo_strip_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_promo_strip_items" ADD CONSTRAINT "_site_config_v_blocks_promo_strip_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v_blocks_promo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_promo_strip" ADD CONSTRAINT "_site_config_v_blocks_promo_strip_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_featured_vehicles" ADD CONSTRAINT "_site_config_v_blocks_featured_vehicles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_brands" ADD CONSTRAINT "_site_config_v_blocks_brands_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_agencies" ADD CONSTRAINT "_site_config_v_blocks_agencies_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_media_text" ADD CONSTRAINT "_site_config_v_blocks_media_text_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_media_text" ADD CONSTRAINT "_site_config_v_blocks_media_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_blocks_cta" ADD CONSTRAINT "_site_config_v_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_site_config_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v" ADD CONSTRAINT "_site_config_v_version_general_logo_id_media_id_fk" FOREIGN KEY ("version_general_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_config_v" ADD CONSTRAINT "_site_config_v_version_templates_seminuevos_hero_image_id_media_id_fk" FOREIGN KEY ("version_templates_seminuevos_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_site_config_v_rels" ADD CONSTRAINT "_site_config_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_site_config_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_site_config_v_rels" ADD CONSTRAINT "_site_config_v_rels_vehicles_fk" FOREIGN KEY ("vehicles_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "vehicles_badges_order_idx" ON "vehicles_badges" USING btree ("_order");
  CREATE INDEX "vehicles_badges_parent_id_idx" ON "vehicles_badges" USING btree ("_parent_id");
  CREATE INDEX "vehicles_gallery_order_idx" ON "vehicles_gallery" USING btree ("_order");
  CREATE INDEX "vehicles_gallery_parent_id_idx" ON "vehicles_gallery" USING btree ("_parent_id");
  CREATE INDEX "vehicles_gallery_image_idx" ON "vehicles_gallery" USING btree ("image_id");
  CREATE INDEX "vehicles_features_order_idx" ON "vehicles_features" USING btree ("_order");
  CREATE INDEX "vehicles_features_parent_id_idx" ON "vehicles_features" USING btree ("_parent_id");
  CREATE INDEX "vehicles_custom_fields_order_idx" ON "vehicles_custom_fields" USING btree ("_order");
  CREATE INDEX "vehicles_custom_fields_parent_id_idx" ON "vehicles_custom_fields" USING btree ("_parent_id");
  CREATE INDEX "vehicles_landing_highlights_order_idx" ON "vehicles_landing_highlights" USING btree ("_order");
  CREATE INDEX "vehicles_landing_highlights_parent_id_idx" ON "vehicles_landing_highlights" USING btree ("_parent_id");
  CREATE INDEX "vehicles_landing_versions_key_features_order_idx" ON "vehicles_landing_versions_key_features" USING btree ("_order");
  CREATE INDEX "vehicles_landing_versions_key_features_parent_id_idx" ON "vehicles_landing_versions_key_features" USING btree ("_parent_id");
  CREATE INDEX "vehicles_landing_versions_order_idx" ON "vehicles_landing_versions" USING btree ("_order");
  CREATE INDEX "vehicles_landing_versions_parent_id_idx" ON "vehicles_landing_versions" USING btree ("_parent_id");
  CREATE INDEX "vehicles_landing_feature_sections_bullets_order_idx" ON "vehicles_landing_feature_sections_bullets" USING btree ("_order");
  CREATE INDEX "vehicles_landing_feature_sections_bullets_parent_id_idx" ON "vehicles_landing_feature_sections_bullets" USING btree ("_parent_id");
  CREATE INDEX "vehicles_landing_feature_sections_order_idx" ON "vehicles_landing_feature_sections" USING btree ("_order");
  CREATE INDEX "vehicles_landing_feature_sections_parent_id_idx" ON "vehicles_landing_feature_sections" USING btree ("_parent_id");
  CREATE INDEX "vehicles_landing_feature_sections_image_idx" ON "vehicles_landing_feature_sections" USING btree ("image_id");
  CREATE INDEX "vehicles_landing_gallery_order_idx" ON "vehicles_landing_gallery" USING btree ("_order");
  CREATE INDEX "vehicles_landing_gallery_parent_id_idx" ON "vehicles_landing_gallery" USING btree ("_parent_id");
  CREATE INDEX "vehicles_landing_gallery_image_idx" ON "vehicles_landing_gallery" USING btree ("image_id");
  CREATE UNIQUE INDEX "vehicles_uuid_idx" ON "vehicles" USING btree ("uuid");
  CREATE UNIQUE INDEX "vehicles_slug_idx" ON "vehicles" USING btree ("slug");
  CREATE INDEX "vehicles_image_idx" ON "vehicles" USING btree ("image_id");
  CREATE INDEX "vehicles_landing_hero_landing_hero_image_idx" ON "vehicles" USING btree ("landing_hero_image_id");
  CREATE INDEX "vehicles_updated_at_idx" ON "vehicles" USING btree ("updated_at");
  CREATE INDEX "vehicles_created_at_idx" ON "vehicles" USING btree ("created_at");
  CREATE INDEX "vehicles__status_idx" ON "vehicles" USING btree ("_status");
  CREATE INDEX "_vehicles_v_version_badges_order_idx" ON "_vehicles_v_version_badges" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_badges_parent_id_idx" ON "_vehicles_v_version_badges" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_gallery_order_idx" ON "_vehicles_v_version_gallery" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_gallery_parent_id_idx" ON "_vehicles_v_version_gallery" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_gallery_image_idx" ON "_vehicles_v_version_gallery" USING btree ("image_id");
  CREATE INDEX "_vehicles_v_version_features_order_idx" ON "_vehicles_v_version_features" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_features_parent_id_idx" ON "_vehicles_v_version_features" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_custom_fields_order_idx" ON "_vehicles_v_version_custom_fields" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_custom_fields_parent_id_idx" ON "_vehicles_v_version_custom_fields" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_landing_highlights_order_idx" ON "_vehicles_v_version_landing_highlights" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_landing_highlights_parent_id_idx" ON "_vehicles_v_version_landing_highlights" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_landing_versions_key_features_order_idx" ON "_vehicles_v_version_landing_versions_key_features" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_landing_versions_key_features_parent_id_idx" ON "_vehicles_v_version_landing_versions_key_features" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_landing_versions_order_idx" ON "_vehicles_v_version_landing_versions" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_landing_versions_parent_id_idx" ON "_vehicles_v_version_landing_versions" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_landing_feature_sections_bullets_order_idx" ON "_vehicles_v_version_landing_feature_sections_bullets" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_landing_feature_sections_bullets_parent_id_idx" ON "_vehicles_v_version_landing_feature_sections_bullets" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_landing_feature_sections_order_idx" ON "_vehicles_v_version_landing_feature_sections" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_landing_feature_sections_parent_id_idx" ON "_vehicles_v_version_landing_feature_sections" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_landing_feature_sections_image_idx" ON "_vehicles_v_version_landing_feature_sections" USING btree ("image_id");
  CREATE INDEX "_vehicles_v_version_landing_gallery_order_idx" ON "_vehicles_v_version_landing_gallery" USING btree ("_order");
  CREATE INDEX "_vehicles_v_version_landing_gallery_parent_id_idx" ON "_vehicles_v_version_landing_gallery" USING btree ("_parent_id");
  CREATE INDEX "_vehicles_v_version_landing_gallery_image_idx" ON "_vehicles_v_version_landing_gallery" USING btree ("image_id");
  CREATE INDEX "_vehicles_v_parent_idx" ON "_vehicles_v" USING btree ("parent_id");
  CREATE INDEX "_vehicles_v_version_version_uuid_idx" ON "_vehicles_v" USING btree ("version_uuid");
  CREATE INDEX "_vehicles_v_version_version_slug_idx" ON "_vehicles_v" USING btree ("version_slug");
  CREATE INDEX "_vehicles_v_version_version_image_idx" ON "_vehicles_v" USING btree ("version_image_id");
  CREATE INDEX "_vehicles_v_version_landing_hero_version_landing_hero_im_idx" ON "_vehicles_v" USING btree ("version_landing_hero_image_id");
  CREATE INDEX "_vehicles_v_version_version_updated_at_idx" ON "_vehicles_v" USING btree ("version_updated_at");
  CREATE INDEX "_vehicles_v_version_version_created_at_idx" ON "_vehicles_v" USING btree ("version_created_at");
  CREATE INDEX "_vehicles_v_version_version__status_idx" ON "_vehicles_v" USING btree ("version__status");
  CREATE INDEX "_vehicles_v_created_at_idx" ON "_vehicles_v" USING btree ("created_at");
  CREATE INDEX "_vehicles_v_updated_at_idx" ON "_vehicles_v" USING btree ("updated_at");
  CREATE INDEX "_vehicles_v_latest_idx" ON "_vehicles_v" USING btree ("latest");
  CREATE INDEX "_vehicles_v_autosave_idx" ON "_vehicles_v" USING btree ("autosave");
  CREATE INDEX "dealerships_updated_at_idx" ON "dealerships" USING btree ("updated_at");
  CREATE INDEX "dealerships_created_at_idx" ON "dealerships" USING btree ("created_at");
  CREATE INDEX "leads_vehicle_idx" ON "leads" USING btree ("vehicle_id");
  CREATE INDEX "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
  CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");
  CREATE INDEX "pages_blocks_hero_order_idx" ON "pages_blocks_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_parent_id_idx" ON "pages_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_path_idx" ON "pages_blocks_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_media_idx" ON "pages_blocks_hero" USING btree ("media_id");
  CREATE INDEX "pages_blocks_promo_strip_items_order_idx" ON "pages_blocks_promo_strip_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_promo_strip_items_parent_id_idx" ON "pages_blocks_promo_strip_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_promo_strip_items_image_idx" ON "pages_blocks_promo_strip_items" USING btree ("image_id");
  CREATE INDEX "pages_blocks_promo_strip_order_idx" ON "pages_blocks_promo_strip" USING btree ("_order");
  CREATE INDEX "pages_blocks_promo_strip_parent_id_idx" ON "pages_blocks_promo_strip" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_promo_strip_path_idx" ON "pages_blocks_promo_strip" USING btree ("_path");
  CREATE INDEX "pages_blocks_featured_vehicles_order_idx" ON "pages_blocks_featured_vehicles" USING btree ("_order");
  CREATE INDEX "pages_blocks_featured_vehicles_parent_id_idx" ON "pages_blocks_featured_vehicles" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_featured_vehicles_path_idx" ON "pages_blocks_featured_vehicles" USING btree ("_path");
  CREATE INDEX "pages_blocks_brands_order_idx" ON "pages_blocks_brands" USING btree ("_order");
  CREATE INDEX "pages_blocks_brands_parent_id_idx" ON "pages_blocks_brands" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_brands_path_idx" ON "pages_blocks_brands" USING btree ("_path");
  CREATE INDEX "pages_blocks_agencies_order_idx" ON "pages_blocks_agencies" USING btree ("_order");
  CREATE INDEX "pages_blocks_agencies_parent_id_idx" ON "pages_blocks_agencies" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_agencies_path_idx" ON "pages_blocks_agencies" USING btree ("_path");
  CREATE INDEX "pages_blocks_media_text_order_idx" ON "pages_blocks_media_text" USING btree ("_order");
  CREATE INDEX "pages_blocks_media_text_parent_id_idx" ON "pages_blocks_media_text" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_media_text_path_idx" ON "pages_blocks_media_text" USING btree ("_path");
  CREATE INDEX "pages_blocks_media_text_media_idx" ON "pages_blocks_media_text" USING btree ("media_id");
  CREATE INDEX "pages_blocks_cta_order_idx" ON "pages_blocks_cta" USING btree ("_order");
  CREATE INDEX "pages_blocks_cta_parent_id_idx" ON "pages_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_cta_path_idx" ON "pages_blocks_cta" USING btree ("_path");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_seo_seo_image_idx" ON "pages" USING btree ("seo_image_id");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "pages_rels_order_idx" ON "pages_rels" USING btree ("order");
  CREATE INDEX "pages_rels_parent_idx" ON "pages_rels" USING btree ("parent_id");
  CREATE INDEX "pages_rels_path_idx" ON "pages_rels" USING btree ("path");
  CREATE INDEX "pages_rels_vehicles_id_idx" ON "pages_rels" USING btree ("vehicles_id");
  CREATE INDEX "_pages_v_blocks_hero_order_idx" ON "_pages_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_parent_id_idx" ON "_pages_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_path_idx" ON "_pages_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_media_idx" ON "_pages_v_blocks_hero" USING btree ("media_id");
  CREATE INDEX "_pages_v_blocks_promo_strip_items_order_idx" ON "_pages_v_blocks_promo_strip_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_promo_strip_items_parent_id_idx" ON "_pages_v_blocks_promo_strip_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_promo_strip_items_image_idx" ON "_pages_v_blocks_promo_strip_items" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_promo_strip_order_idx" ON "_pages_v_blocks_promo_strip" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_promo_strip_parent_id_idx" ON "_pages_v_blocks_promo_strip" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_promo_strip_path_idx" ON "_pages_v_blocks_promo_strip" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_featured_vehicles_order_idx" ON "_pages_v_blocks_featured_vehicles" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_featured_vehicles_parent_id_idx" ON "_pages_v_blocks_featured_vehicles" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_featured_vehicles_path_idx" ON "_pages_v_blocks_featured_vehicles" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_brands_order_idx" ON "_pages_v_blocks_brands" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_brands_parent_id_idx" ON "_pages_v_blocks_brands" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_brands_path_idx" ON "_pages_v_blocks_brands" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_agencies_order_idx" ON "_pages_v_blocks_agencies" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_agencies_parent_id_idx" ON "_pages_v_blocks_agencies" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_agencies_path_idx" ON "_pages_v_blocks_agencies" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_media_text_order_idx" ON "_pages_v_blocks_media_text" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_media_text_parent_id_idx" ON "_pages_v_blocks_media_text" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_media_text_path_idx" ON "_pages_v_blocks_media_text" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_media_text_media_idx" ON "_pages_v_blocks_media_text" USING btree ("media_id");
  CREATE INDEX "_pages_v_blocks_cta_order_idx" ON "_pages_v_blocks_cta" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_cta_parent_id_idx" ON "_pages_v_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_cta_path_idx" ON "_pages_v_blocks_cta" USING btree ("_path");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_seo_version_seo_image_idx" ON "_pages_v" USING btree ("version_seo_image_id");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_autosave_idx" ON "_pages_v" USING btree ("autosave");
  CREATE INDEX "_pages_v_rels_order_idx" ON "_pages_v_rels" USING btree ("order");
  CREATE INDEX "_pages_v_rels_parent_idx" ON "_pages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_pages_v_rels_path_idx" ON "_pages_v_rels" USING btree ("path");
  CREATE INDEX "_pages_v_rels_vehicles_id_idx" ON "_pages_v_rels" USING btree ("vehicles_id");
  CREATE INDEX "analytics_events_vehicle_idx" ON "analytics_events" USING btree ("vehicle_id");
  CREATE INDEX "analytics_events_updated_at_idx" ON "analytics_events" USING btree ("updated_at");
  CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_vehicles_id_idx" ON "payload_locked_documents_rels" USING btree ("vehicles_id");
  CREATE INDEX "payload_locked_documents_rels_dealerships_id_idx" ON "payload_locked_documents_rels" USING btree ("dealerships_id");
  CREATE INDEX "payload_locked_documents_rels_leads_id_idx" ON "payload_locked_documents_rels" USING btree ("leads_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_analytics_events_id_idx" ON "payload_locked_documents_rels" USING btree ("analytics_events_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_config_navigation_main_links_children_order_idx" ON "site_config_navigation_main_links_children" USING btree ("_order");
  CREATE INDEX "site_config_navigation_main_links_children_parent_id_idx" ON "site_config_navigation_main_links_children" USING btree ("_parent_id");
  CREATE INDEX "site_config_navigation_main_links_order_idx" ON "site_config_navigation_main_links" USING btree ("_order");
  CREATE INDEX "site_config_navigation_main_links_parent_id_idx" ON "site_config_navigation_main_links" USING btree ("_parent_id");
  CREATE INDEX "site_config_blocks_hero_order_idx" ON "site_config_blocks_hero" USING btree ("_order");
  CREATE INDEX "site_config_blocks_hero_parent_id_idx" ON "site_config_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "site_config_blocks_hero_path_idx" ON "site_config_blocks_hero" USING btree ("_path");
  CREATE INDEX "site_config_blocks_hero_media_idx" ON "site_config_blocks_hero" USING btree ("media_id");
  CREATE INDEX "site_config_blocks_promo_strip_items_order_idx" ON "site_config_blocks_promo_strip_items" USING btree ("_order");
  CREATE INDEX "site_config_blocks_promo_strip_items_parent_id_idx" ON "site_config_blocks_promo_strip_items" USING btree ("_parent_id");
  CREATE INDEX "site_config_blocks_promo_strip_items_image_idx" ON "site_config_blocks_promo_strip_items" USING btree ("image_id");
  CREATE INDEX "site_config_blocks_promo_strip_order_idx" ON "site_config_blocks_promo_strip" USING btree ("_order");
  CREATE INDEX "site_config_blocks_promo_strip_parent_id_idx" ON "site_config_blocks_promo_strip" USING btree ("_parent_id");
  CREATE INDEX "site_config_blocks_promo_strip_path_idx" ON "site_config_blocks_promo_strip" USING btree ("_path");
  CREATE INDEX "site_config_blocks_featured_vehicles_order_idx" ON "site_config_blocks_featured_vehicles" USING btree ("_order");
  CREATE INDEX "site_config_blocks_featured_vehicles_parent_id_idx" ON "site_config_blocks_featured_vehicles" USING btree ("_parent_id");
  CREATE INDEX "site_config_blocks_featured_vehicles_path_idx" ON "site_config_blocks_featured_vehicles" USING btree ("_path");
  CREATE INDEX "site_config_blocks_brands_order_idx" ON "site_config_blocks_brands" USING btree ("_order");
  CREATE INDEX "site_config_blocks_brands_parent_id_idx" ON "site_config_blocks_brands" USING btree ("_parent_id");
  CREATE INDEX "site_config_blocks_brands_path_idx" ON "site_config_blocks_brands" USING btree ("_path");
  CREATE INDEX "site_config_blocks_agencies_order_idx" ON "site_config_blocks_agencies" USING btree ("_order");
  CREATE INDEX "site_config_blocks_agencies_parent_id_idx" ON "site_config_blocks_agencies" USING btree ("_parent_id");
  CREATE INDEX "site_config_blocks_agencies_path_idx" ON "site_config_blocks_agencies" USING btree ("_path");
  CREATE INDEX "site_config_blocks_media_text_order_idx" ON "site_config_blocks_media_text" USING btree ("_order");
  CREATE INDEX "site_config_blocks_media_text_parent_id_idx" ON "site_config_blocks_media_text" USING btree ("_parent_id");
  CREATE INDEX "site_config_blocks_media_text_path_idx" ON "site_config_blocks_media_text" USING btree ("_path");
  CREATE INDEX "site_config_blocks_media_text_media_idx" ON "site_config_blocks_media_text" USING btree ("media_id");
  CREATE INDEX "site_config_blocks_cta_order_idx" ON "site_config_blocks_cta" USING btree ("_order");
  CREATE INDEX "site_config_blocks_cta_parent_id_idx" ON "site_config_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "site_config_blocks_cta_path_idx" ON "site_config_blocks_cta" USING btree ("_path");
  CREATE INDEX "site_config_general_general_logo_idx" ON "site_config" USING btree ("general_logo_id");
  CREATE INDEX "site_config_templates_seminuevos_templates_seminuevos_he_idx" ON "site_config" USING btree ("templates_seminuevos_hero_image_id");
  CREATE INDEX "site_config__status_idx" ON "site_config" USING btree ("_status");
  CREATE INDEX "site_config_rels_order_idx" ON "site_config_rels" USING btree ("order");
  CREATE INDEX "site_config_rels_parent_idx" ON "site_config_rels" USING btree ("parent_id");
  CREATE INDEX "site_config_rels_path_idx" ON "site_config_rels" USING btree ("path");
  CREATE INDEX "site_config_rels_vehicles_id_idx" ON "site_config_rels" USING btree ("vehicles_id");
  CREATE INDEX "_site_config_v_version_navigation_main_links_children_order_idx" ON "_site_config_v_version_navigation_main_links_children" USING btree ("_order");
  CREATE INDEX "_site_config_v_version_navigation_main_links_children_parent_id_idx" ON "_site_config_v_version_navigation_main_links_children" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_version_navigation_main_links_order_idx" ON "_site_config_v_version_navigation_main_links" USING btree ("_order");
  CREATE INDEX "_site_config_v_version_navigation_main_links_parent_id_idx" ON "_site_config_v_version_navigation_main_links" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_blocks_hero_order_idx" ON "_site_config_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_site_config_v_blocks_hero_parent_id_idx" ON "_site_config_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_blocks_hero_path_idx" ON "_site_config_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_site_config_v_blocks_hero_media_idx" ON "_site_config_v_blocks_hero" USING btree ("media_id");
  CREATE INDEX "_site_config_v_blocks_promo_strip_items_order_idx" ON "_site_config_v_blocks_promo_strip_items" USING btree ("_order");
  CREATE INDEX "_site_config_v_blocks_promo_strip_items_parent_id_idx" ON "_site_config_v_blocks_promo_strip_items" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_blocks_promo_strip_items_image_idx" ON "_site_config_v_blocks_promo_strip_items" USING btree ("image_id");
  CREATE INDEX "_site_config_v_blocks_promo_strip_order_idx" ON "_site_config_v_blocks_promo_strip" USING btree ("_order");
  CREATE INDEX "_site_config_v_blocks_promo_strip_parent_id_idx" ON "_site_config_v_blocks_promo_strip" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_blocks_promo_strip_path_idx" ON "_site_config_v_blocks_promo_strip" USING btree ("_path");
  CREATE INDEX "_site_config_v_blocks_featured_vehicles_order_idx" ON "_site_config_v_blocks_featured_vehicles" USING btree ("_order");
  CREATE INDEX "_site_config_v_blocks_featured_vehicles_parent_id_idx" ON "_site_config_v_blocks_featured_vehicles" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_blocks_featured_vehicles_path_idx" ON "_site_config_v_blocks_featured_vehicles" USING btree ("_path");
  CREATE INDEX "_site_config_v_blocks_brands_order_idx" ON "_site_config_v_blocks_brands" USING btree ("_order");
  CREATE INDEX "_site_config_v_blocks_brands_parent_id_idx" ON "_site_config_v_blocks_brands" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_blocks_brands_path_idx" ON "_site_config_v_blocks_brands" USING btree ("_path");
  CREATE INDEX "_site_config_v_blocks_agencies_order_idx" ON "_site_config_v_blocks_agencies" USING btree ("_order");
  CREATE INDEX "_site_config_v_blocks_agencies_parent_id_idx" ON "_site_config_v_blocks_agencies" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_blocks_agencies_path_idx" ON "_site_config_v_blocks_agencies" USING btree ("_path");
  CREATE INDEX "_site_config_v_blocks_media_text_order_idx" ON "_site_config_v_blocks_media_text" USING btree ("_order");
  CREATE INDEX "_site_config_v_blocks_media_text_parent_id_idx" ON "_site_config_v_blocks_media_text" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_blocks_media_text_path_idx" ON "_site_config_v_blocks_media_text" USING btree ("_path");
  CREATE INDEX "_site_config_v_blocks_media_text_media_idx" ON "_site_config_v_blocks_media_text" USING btree ("media_id");
  CREATE INDEX "_site_config_v_blocks_cta_order_idx" ON "_site_config_v_blocks_cta" USING btree ("_order");
  CREATE INDEX "_site_config_v_blocks_cta_parent_id_idx" ON "_site_config_v_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "_site_config_v_blocks_cta_path_idx" ON "_site_config_v_blocks_cta" USING btree ("_path");
  CREATE INDEX "_site_config_v_version_general_version_general_logo_idx" ON "_site_config_v" USING btree ("version_general_logo_id");
  CREATE INDEX "_site_config_v_version_templates_seminuevos_version_temp_idx" ON "_site_config_v" USING btree ("version_templates_seminuevos_hero_image_id");
  CREATE INDEX "_site_config_v_version_version__status_idx" ON "_site_config_v" USING btree ("version__status");
  CREATE INDEX "_site_config_v_created_at_idx" ON "_site_config_v" USING btree ("created_at");
  CREATE INDEX "_site_config_v_updated_at_idx" ON "_site_config_v" USING btree ("updated_at");
  CREATE INDEX "_site_config_v_latest_idx" ON "_site_config_v" USING btree ("latest");
  CREATE INDEX "_site_config_v_autosave_idx" ON "_site_config_v" USING btree ("autosave");
  CREATE INDEX "_site_config_v_rels_order_idx" ON "_site_config_v_rels" USING btree ("order");
  CREATE INDEX "_site_config_v_rels_parent_idx" ON "_site_config_v_rels" USING btree ("parent_id");
  CREATE INDEX "_site_config_v_rels_path_idx" ON "_site_config_v_rels" USING btree ("path");
  CREATE INDEX "_site_config_v_rels_vehicles_id_idx" ON "_site_config_v_rels" USING btree ("vehicles_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "vehicles_badges" CASCADE;
  DROP TABLE "vehicles_gallery" CASCADE;
  DROP TABLE "vehicles_features" CASCADE;
  DROP TABLE "vehicles_custom_fields" CASCADE;
  DROP TABLE "vehicles_landing_highlights" CASCADE;
  DROP TABLE "vehicles_landing_versions_key_features" CASCADE;
  DROP TABLE "vehicles_landing_versions" CASCADE;
  DROP TABLE "vehicles_landing_feature_sections_bullets" CASCADE;
  DROP TABLE "vehicles_landing_feature_sections" CASCADE;
  DROP TABLE "vehicles_landing_gallery" CASCADE;
  DROP TABLE "vehicles" CASCADE;
  DROP TABLE "_vehicles_v_version_badges" CASCADE;
  DROP TABLE "_vehicles_v_version_gallery" CASCADE;
  DROP TABLE "_vehicles_v_version_features" CASCADE;
  DROP TABLE "_vehicles_v_version_custom_fields" CASCADE;
  DROP TABLE "_vehicles_v_version_landing_highlights" CASCADE;
  DROP TABLE "_vehicles_v_version_landing_versions_key_features" CASCADE;
  DROP TABLE "_vehicles_v_version_landing_versions" CASCADE;
  DROP TABLE "_vehicles_v_version_landing_feature_sections_bullets" CASCADE;
  DROP TABLE "_vehicles_v_version_landing_feature_sections" CASCADE;
  DROP TABLE "_vehicles_v_version_landing_gallery" CASCADE;
  DROP TABLE "_vehicles_v" CASCADE;
  DROP TABLE "dealerships" CASCADE;
  DROP TABLE "leads" CASCADE;
  DROP TABLE "pages_blocks_hero" CASCADE;
  DROP TABLE "pages_blocks_promo_strip_items" CASCADE;
  DROP TABLE "pages_blocks_promo_strip" CASCADE;
  DROP TABLE "pages_blocks_featured_vehicles" CASCADE;
  DROP TABLE "pages_blocks_brands" CASCADE;
  DROP TABLE "pages_blocks_agencies" CASCADE;
  DROP TABLE "pages_blocks_media_text" CASCADE;
  DROP TABLE "pages_blocks_cta" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_rels" CASCADE;
  DROP TABLE "_pages_v_blocks_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_promo_strip_items" CASCADE;
  DROP TABLE "_pages_v_blocks_promo_strip" CASCADE;
  DROP TABLE "_pages_v_blocks_featured_vehicles" CASCADE;
  DROP TABLE "_pages_v_blocks_brands" CASCADE;
  DROP TABLE "_pages_v_blocks_agencies" CASCADE;
  DROP TABLE "_pages_v_blocks_media_text" CASCADE;
  DROP TABLE "_pages_v_blocks_cta" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "_pages_v_rels" CASCADE;
  DROP TABLE "analytics_events" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_config_navigation_main_links_children" CASCADE;
  DROP TABLE "site_config_navigation_main_links" CASCADE;
  DROP TABLE "site_config_blocks_hero" CASCADE;
  DROP TABLE "site_config_blocks_promo_strip_items" CASCADE;
  DROP TABLE "site_config_blocks_promo_strip" CASCADE;
  DROP TABLE "site_config_blocks_featured_vehicles" CASCADE;
  DROP TABLE "site_config_blocks_brands" CASCADE;
  DROP TABLE "site_config_blocks_agencies" CASCADE;
  DROP TABLE "site_config_blocks_media_text" CASCADE;
  DROP TABLE "site_config_blocks_cta" CASCADE;
  DROP TABLE "site_config" CASCADE;
  DROP TABLE "site_config_rels" CASCADE;
  DROP TABLE "_site_config_v_version_navigation_main_links_children" CASCADE;
  DROP TABLE "_site_config_v_version_navigation_main_links" CASCADE;
  DROP TABLE "_site_config_v_blocks_hero" CASCADE;
  DROP TABLE "_site_config_v_blocks_promo_strip_items" CASCADE;
  DROP TABLE "_site_config_v_blocks_promo_strip" CASCADE;
  DROP TABLE "_site_config_v_blocks_featured_vehicles" CASCADE;
  DROP TABLE "_site_config_v_blocks_brands" CASCADE;
  DROP TABLE "_site_config_v_blocks_agencies" CASCADE;
  DROP TABLE "_site_config_v_blocks_media_text" CASCADE;
  DROP TABLE "_site_config_v_blocks_cta" CASCADE;
  DROP TABLE "_site_config_v" CASCADE;
  DROP TABLE "_site_config_v_rels" CASCADE;
  DROP TYPE "public"."enum_vehicles_landing_highlights_icon";
  DROP TYPE "public"."enum_vehicles_landing_feature_sections_type";
  DROP TYPE "public"."enum_vehicles_landing_feature_sections_theme";
  DROP TYPE "public"."imgPos";
  DROP TYPE "public"."enum_vehicles_condition";
  DROP TYPE "public"."enum_vehicles_body_type";
  DROP TYPE "public"."enum_vehicles_transmission";
  DROP TYPE "public"."enum_vehicles_fuel";
  DROP TYPE "public"."enum_vehicles_status";
  DROP TYPE "public"."enum__vehicles_v_version_landing_highlights_icon";
  DROP TYPE "public"."enum__vehicles_v_version_landing_feature_sections_type";
  DROP TYPE "public"."enum__vehicles_v_version_landing_feature_sections_theme";
  DROP TYPE "public"."enum__vehicles_v_version_condition";
  DROP TYPE "public"."enum__vehicles_v_version_body_type";
  DROP TYPE "public"."enum__vehicles_v_version_transmission";
  DROP TYPE "public"."enum__vehicles_v_version_fuel";
  DROP TYPE "public"."enum__vehicles_v_version_status";
  DROP TYPE "public"."enum_leads_source";
  DROP TYPE "public"."enum_leads_stage";
  DROP TYPE "public"."enum_pages_blocks_featured_vehicles_source";
  DROP TYPE "public"."enum_pages_blocks_media_text_layout";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_blocks_featured_vehicles_source";
  DROP TYPE "public"."enum__pages_v_blocks_media_text_layout";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_analytics_events_event_type";
  DROP TYPE "public"."enum_analytics_events_device_type";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_site_config_blocks_featured_vehicles_source";
  DROP TYPE "public"."enum_site_config_blocks_media_text_layout";
  DROP TYPE "public"."enum_site_config_status";
  DROP TYPE "public"."enum__site_config_v_blocks_featured_vehicles_source";
  DROP TYPE "public"."enum__site_config_v_blocks_media_text_layout";
  DROP TYPE "public"."enum__site_config_v_version_status";`)
}
