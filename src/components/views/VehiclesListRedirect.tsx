import { redirect } from 'next/navigation'

/**
 * Replaces the default Vehículos list view (/admin/collections/vehicles).
 * The custom Inventario manager at /admin/inventory is the primary inventory
 * UI, so any old link or bookmark to the default list lands there instead.
 */
export default function VehiclesListRedirect() {
  redirect('/admin/inventory')
}
