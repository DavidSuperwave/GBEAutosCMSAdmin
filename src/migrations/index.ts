import * as migration_20260521_060610_site_builder_schema from './20260521_060610_site_builder_schema';
import * as migration_20260521_083000_vehicle_landing_simplification from './20260521_083000_vehicle_landing_simplification';
import * as migration_20260609_120000_gbe_inventory_workflow_upgrade from './20260609_120000_gbe_inventory_workflow_upgrade';
import * as migration_20260609_180000_image_templates from './20260609_180000_image_templates';
import * as migration_20260610_090000_vehicle_image_reuse_workspace from './20260610_090000_vehicle_image_reuse_workspace';
import * as migration_20260610_100000_p0_whatsapp_routing_contracts from './20260610_100000_p0_whatsapp_routing_contracts';
import * as migration_20260610_110000_p1_tags_and_smart_collections from './20260610_110000_p1_tags_and_smart_collections';
import * as migration_20260610_120000_p2_pages_nav_and_analytics from './20260610_120000_p2_pages_nav_and_analytics';
import * as migration_20260610_130000_p3_page_home_block_schema_sync from './20260610_130000_p3_page_home_block_schema_sync';
import * as migration_20260610_140000_p3_site_config_nav_link_id_sync from './20260610_140000_p3_site_config_nav_link_id_sync';
import * as migration_20260611_090000_vehicle_create_preview_template_controls from './20260611_090000_vehicle_create_preview_template_controls';
import * as migration_20260611_150000_workshop_job_style_fields from './20260611_150000_workshop_job_style_fields';
import * as migration_20260611_160000_workshop_job_turn_ids from './20260611_160000_workshop_job_turn_ids';
import * as migration_20260611_170000_general_media_workspace from './20260611_170000_general_media_workspace';
import * as migration_20260611_180000_vehicle_image_sync_columns from './20260611_180000_vehicle_image_sync_columns';
import * as migration_20260710_150000_three_role_model from './20260710_150000_three_role_model';
import * as migration_20260715_220000_lock_down_supabase_data_api from './20260715_220000_lock_down_supabase_data_api';
import * as migration_20260715_230000_dealership_links_and_aliases from './20260715_230000_dealership_links_and_aliases';
import * as migration_20260715_240000_media_storage_prefix from './20260715_240000_media_storage_prefix';

export const migrations = [
  {
    up: migration_20260521_060610_site_builder_schema.up,
    down: migration_20260521_060610_site_builder_schema.down,
    name: '20260521_060610_site_builder_schema'
  },
  {
    up: migration_20260521_083000_vehicle_landing_simplification.up,
    down: migration_20260521_083000_vehicle_landing_simplification.down,
    name: '20260521_083000_vehicle_landing_simplification'
  },
  {
    up: migration_20260609_120000_gbe_inventory_workflow_upgrade.up,
    down: migration_20260609_120000_gbe_inventory_workflow_upgrade.down,
    name: '20260609_120000_gbe_inventory_workflow_upgrade'
  },
  {
    up: migration_20260609_180000_image_templates.up,
    down: migration_20260609_180000_image_templates.down,
    name: '20260609_180000_image_templates'
  },
  {
    up: migration_20260610_090000_vehicle_image_reuse_workspace.up,
    down: migration_20260610_090000_vehicle_image_reuse_workspace.down,
    name: '20260610_090000_vehicle_image_reuse_workspace'
  },
  {
    up: migration_20260610_100000_p0_whatsapp_routing_contracts.up,
    down: migration_20260610_100000_p0_whatsapp_routing_contracts.down,
    name: '20260610_100000_p0_whatsapp_routing_contracts'
  },
  {
    up: migration_20260610_110000_p1_tags_and_smart_collections.up,
    down: migration_20260610_110000_p1_tags_and_smart_collections.down,
    name: '20260610_110000_p1_tags_and_smart_collections'
  },
  {
    up: migration_20260610_120000_p2_pages_nav_and_analytics.up,
    down: migration_20260610_120000_p2_pages_nav_and_analytics.down,
    name: '20260610_120000_p2_pages_nav_and_analytics'
  },
  {
    up: migration_20260610_130000_p3_page_home_block_schema_sync.up,
    down: migration_20260610_130000_p3_page_home_block_schema_sync.down,
    name: '20260610_130000_p3_page_home_block_schema_sync'
  },
  {
    up: migration_20260610_140000_p3_site_config_nav_link_id_sync.up,
    down: migration_20260610_140000_p3_site_config_nav_link_id_sync.down,
    name: '20260610_140000_p3_site_config_nav_link_id_sync'
  },
  {
    up: migration_20260611_090000_vehicle_create_preview_template_controls.up,
    down: migration_20260611_090000_vehicle_create_preview_template_controls.down,
    name: '20260611_090000_vehicle_create_preview_template_controls'
  },
  {
    up: migration_20260611_150000_workshop_job_style_fields.up,
    down: migration_20260611_150000_workshop_job_style_fields.down,
    name: '20260611_150000_workshop_job_style_fields'
  },
  {
    up: migration_20260611_160000_workshop_job_turn_ids.up,
    down: migration_20260611_160000_workshop_job_turn_ids.down,
    name: '20260611_160000_workshop_job_turn_ids'
  },
  {
    up: migration_20260611_170000_general_media_workspace.up,
    down: migration_20260611_170000_general_media_workspace.down,
    name: '20260611_170000_general_media_workspace'
  },
  {
    up: migration_20260611_180000_vehicle_image_sync_columns.up,
    down: migration_20260611_180000_vehicle_image_sync_columns.down,
    name: '20260611_180000_vehicle_image_sync_columns'
  },
  {
    up: migration_20260710_150000_three_role_model.up,
    down: migration_20260710_150000_three_role_model.down,
    name: '20260710_150000_three_role_model'
  },
  {
    up: migration_20260715_220000_lock_down_supabase_data_api.up,
    down: migration_20260715_220000_lock_down_supabase_data_api.down,
    name: '20260715_220000_lock_down_supabase_data_api'
  },
  {
    up: migration_20260715_230000_dealership_links_and_aliases.up,
    down: migration_20260715_230000_dealership_links_and_aliases.down,
    name: '20260715_230000_dealership_links_and_aliases'
  },
  {
    up: migration_20260715_240000_media_storage_prefix.up,
    down: migration_20260715_240000_media_storage_prefix.down,
    name: '20260715_240000_media_storage_prefix'
  },
];
