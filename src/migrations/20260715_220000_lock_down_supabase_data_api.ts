import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Payload is the only public API boundary for application data. The Supabase
 * project previously exposed raw Payload tables to the anon/authenticated
 * Data API roles with a permissive USING (true) policy. That bypassed the
 * bounded DTOs and publication checks in /api/public/*.
 *
 * Keep Storage untouched: vehicle assets are still served by Supabase
 * Storage, while the metadata and inventory tables remain private.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Payload is the only application data boundary. Revoke every direct
    -- relation/sequence privilege first so a relation added between the audit
    -- and deployment cannot remain exposed merely because it is absent from
    -- the historical policy list below.
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public"
      FROM PUBLIC, anon, authenticated;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public"
      FROM PUBLIC, anon, authenticated;
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "public"
      FROM PUBLIC, anon, authenticated;

    DO $$
    DECLARE table_name text;
    BEGIN
      FOREACH table_name IN ARRAY ARRAY[
        'dealerships',
        'home',
        'home_brands',
        'home_stats',
        'media',
        'pages',
        'pages_blocks_agencies',
        'pages_blocks_brands',
        'pages_blocks_cta',
        'pages_blocks_featured_vehicles',
        'pages_blocks_hero',
        'pages_blocks_inventory_search',
        'pages_blocks_media_text',
        'pages_blocks_promo_strip',
        'pages_blocks_promo_strip_items',
        'pages_rels',
        'site_config',
        'site_config_blocks_agencies',
        'site_config_blocks_brands',
        'site_config_blocks_cta',
        'site_config_blocks_featured_vehicles',
        'site_config_blocks_hero',
        'site_config_blocks_inventory_search',
        'site_config_blocks_media_text',
        'site_config_blocks_promo_strip',
        'site_config_blocks_promo_strip_items',
        'site_config_navigation_main_links',
        'site_config_navigation_main_links_children',
        'site_config_rels',
        'vehicles',
        'vehicles_badges',
        'vehicles_blocks_cta',
        'vehicles_blocks_feature_grid',
        'vehicles_blocks_feature_grid_items',
        'vehicles_blocks_gallery',
        'vehicles_blocks_gallery_images',
        'vehicles_blocks_highlight_list',
        'vehicles_blocks_highlight_list_items',
        'vehicles_blocks_image_text',
        'vehicles_custom_fields',
        'vehicles_features',
        'vehicles_gallery',
        'vehicles_landing_feature_sections',
        'vehicles_landing_feature_sections_bullets',
        'vehicles_landing_gallery',
        'vehicles_landing_highlights',
        'vehicles_landing_versions',
        'vehicles_landing_versions_key_features'
      ]
      LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
          EXECUTE format(
            'REVOKE SELECT ON TABLE public.%I FROM anon, authenticated',
            table_name
          );
          EXECUTE format(
            'DROP POLICY IF EXISTS public_api_read ON public.%I',
            table_name
          );
        END IF;
      END LOOP;
    END $$;
  `)
}

/**
 * Restores only the exact legacy read surface for rollback. It intentionally
 * does not grant writes and does not alter Supabase Storage policies.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE table_name text;
    BEGIN
      FOREACH table_name IN ARRAY ARRAY[
        'dealerships',
        'home',
        'home_brands',
        'home_stats',
        'media',
        'pages',
        'pages_blocks_agencies',
        'pages_blocks_brands',
        'pages_blocks_cta',
        'pages_blocks_featured_vehicles',
        'pages_blocks_hero',
        'pages_blocks_inventory_search',
        'pages_blocks_media_text',
        'pages_blocks_promo_strip',
        'pages_blocks_promo_strip_items',
        'pages_rels',
        'site_config',
        'site_config_blocks_agencies',
        'site_config_blocks_brands',
        'site_config_blocks_cta',
        'site_config_blocks_featured_vehicles',
        'site_config_blocks_hero',
        'site_config_blocks_inventory_search',
        'site_config_blocks_media_text',
        'site_config_blocks_promo_strip',
        'site_config_blocks_promo_strip_items',
        'site_config_navigation_main_links',
        'site_config_navigation_main_links_children',
        'site_config_rels',
        'vehicles',
        'vehicles_badges',
        'vehicles_blocks_cta',
        'vehicles_blocks_feature_grid',
        'vehicles_blocks_feature_grid_items',
        'vehicles_blocks_gallery',
        'vehicles_blocks_gallery_images',
        'vehicles_blocks_highlight_list',
        'vehicles_blocks_highlight_list_items',
        'vehicles_blocks_image_text',
        'vehicles_custom_fields',
        'vehicles_features',
        'vehicles_gallery',
        'vehicles_landing_feature_sections',
        'vehicles_landing_feature_sections_bullets',
        'vehicles_landing_gallery',
        'vehicles_landing_highlights',
        'vehicles_landing_versions',
        'vehicles_landing_versions_key_features'
      ]
      LOOP
        IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
          EXECUTE format(
            'GRANT SELECT ON TABLE public.%I TO anon, authenticated',
            table_name
          );
          EXECUTE format(
            'DROP POLICY IF EXISTS public_api_read ON public.%I',
            table_name
          );
          EXECUTE format(
            'CREATE POLICY public_api_read ON public.%I FOR SELECT TO anon, authenticated USING (true)',
            table_name
          );
        END IF;
      END LOOP;
    END $$;

    GRANT USAGE ON SEQUENCE "public"."analytics_events_id_seq"
      TO anon, authenticated;
    GRANT USAGE ON SEQUENCE "public"."leads_id_seq"
      TO anon, authenticated;
  `)
}
