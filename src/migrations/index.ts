import * as migration_20260521_060610_site_builder_schema from './20260521_060610_site_builder_schema';
import * as migration_20260521_083000_vehicle_landing_simplification from './20260521_083000_vehicle_landing_simplification';
import * as migration_20260609_120000_gbe_inventory_workflow_upgrade from './20260609_120000_gbe_inventory_workflow_upgrade';
import * as migration_20260609_180000_image_templates from './20260609_180000_image_templates';
import * as migration_20260610_090000_vehicle_image_reuse_workspace from './20260610_090000_vehicle_image_reuse_workspace';

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
];
