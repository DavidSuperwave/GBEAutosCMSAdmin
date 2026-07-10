export function formatMileage(mileage: number | null | undefined): string {
  return mileage ? `${mileage.toLocaleString('es-MX')} km` : 'Por confirmar'
}
