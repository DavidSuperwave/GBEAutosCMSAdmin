import * as migration_20260521_060610_site_builder_schema from './20260521_060610_site_builder_schema';
import * as migration_20260521_083000_vehicle_landing_simplification from './20260521_083000_vehicle_landing_simplification';

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
];
