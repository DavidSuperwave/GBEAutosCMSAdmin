/**
 * Triage queue ("Trabajar en cola") shared between the Inventory list and the
 * vehicle workspace. The inventory screen snapshots the ordered ids of the
 * current filter into sessionStorage; the workspace renders prev/next
 * navigation against that snapshot. The queue is intentionally a static
 * snapshot: publishing a vehicle mid-queue does not reshuffle it.
 */

export type VehicleQueue = {
  label: string
  ids: string[]
  index: number
  returnTo: string
  createdAt: number
}

const STORAGE_KEY = 'gbe.vehicleQueue'

export function readVehicleQueue(): VehicleQueue | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as VehicleQueue
    if (!Array.isArray(parsed.ids) || parsed.ids.length === 0) return null
    return {
      label: String(parsed.label || ''),
      ids: parsed.ids.map(String),
      index: Math.min(Math.max(0, Number(parsed.index) || 0), parsed.ids.length - 1),
      returnTo: String(parsed.returnTo || '/admin/inventory'),
      createdAt: Number(parsed.createdAt) || Date.now(),
    }
  } catch {
    return null
  }
}

export function writeVehicleQueue(queue: VehicleQueue): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Session storage full/unavailable: queue navigation simply won't persist.
  }
}

export function clearVehicleQueue(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function vehicleWorkspacePath(vehicleId: string | number): string {
  return `/admin/collections/vehicles/${vehicleId}/workspace`
}
