import type { PayloadRequest } from 'payload'

type AnalyticsEvent = {
  createdAt?: string
  durationSeconds?: number
  eventType?: string
  pagePath?: string
  pageTitle?: string
  targetLabel?: string
  vehicle?: {
    brand?: string
    model?: string
    price?: string
    status?: string
    year?: number
  }
  vehicleLabel?: string
}

type Vehicle = {
  brand?: string
  inventoryStatus?: string
  model?: string
  price?: string
  status?: string
  year?: number
}

type Props = {
  req: PayloadRequest
}

const formatter = new Intl.NumberFormat('es-MX')

function formatNumber(value: number) {
  return formatter.format(Math.round(value))
}

function formatDuration(seconds: number) {
  if (!seconds) return '0 s'
  if (seconds < 60) return `${Math.round(seconds)} s`
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`
}

function formatVehicleName(event: AnalyticsEvent) {
  if (event.vehicle && typeof event.vehicle === 'object') {
    return [event.vehicle.brand, event.vehicle.model, event.vehicle.year].filter(Boolean).join(' ')
  }

  return event.vehicleLabel || 'Vehiculo sin identificar'
}

function percentageChange(current: number, previous: number) {
  if (!previous && current) return '+100%'
  if (!previous) return '0%'

  const change = ((current - previous) / previous) * 100
  return `${change > 0 ? '+' : ''}${Math.round(change)}%`
}

function groupCount(items: AnalyticsEvent[], getKey: (item: AnalyticsEvent) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function topEntries(entries: Record<string, number>, limit = 5) {
  return Object.entries(entries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
}

export default async function AnalyticsDashboard({ req }: Props) {
  const now = new Date()
  const currentStart = new Date(now)
  currentStart.setDate(now.getDate() - 30)
  const previousStart = new Date(now)
  previousStart.setDate(now.getDate() - 60)

  const [eventsResult, vehiclesResult] = await Promise.all([
    req.payload.find({
      collection: 'analytics-events',
      depth: 1,
      limit: 1000,
      sort: '-createdAt',
      where: {
        createdAt: {
          greater_than_equal: previousStart.toISOString(),
        },
      },
    }),
    req.payload.find({
      collection: 'vehicles',
      depth: 0,
      limit: 1000,
      sort: '-createdAt',
    }),
  ])

  const events = eventsResult.docs as AnalyticsEvent[]
  const vehicles = vehiclesResult.docs as Vehicle[]
  const currentEvents = events.filter((event) => new Date(event.createdAt || 0) >= currentStart)
  const previousEvents = events.filter((event) => {
    const createdAt = new Date(event.createdAt || 0)
    return createdAt >= previousStart && createdAt < currentStart
  })

  const pageViews = currentEvents.filter((event) => event.eventType === 'page_view')
  const previousPageViews = previousEvents.filter((event) => event.eventType === 'page_view')
  const vehicleViews = currentEvents.filter((event) => event.eventType === 'vehicle_view')
  const vehicleClicks = currentEvents.filter((event) => event.eventType === 'vehicle_click')
  const durationEvents = currentEvents.filter(
    (event) => event.eventType === 'page_duration' && Number(event.durationSeconds) > 0,
  )
  const averageDuration =
    durationEvents.reduce((sum, event) => sum + Number(event.durationSeconds || 0), 0) /
    (durationEvents.length || 1)

  const availableVehicles = vehicles.filter((vehicle) => getInventoryStatus(vehicle) === 'available').length
  const soldVehicles = vehicles.filter((vehicle) => getInventoryStatus(vehicle) === 'sold').length
  const reservedVehicles = vehicles.filter((vehicle) => getInventoryStatus(vehicle) === 'reserved').length

  const pageViewCounts = topEntries(
    groupCount(pageViews, (event) => event.pageTitle || event.pagePath || 'Pagina sin titulo'),
  )
  const vehicleViewCounts = topEntries(groupCount(vehicleViews, formatVehicleName))
  const vehicleClickCounts = topEntries(groupCount(vehicleClicks, formatVehicleName))
  const clickTargetCounts = topEntries(
    groupCount(
      currentEvents.filter((event) => event.eventType === 'cta_click' || event.eventType === 'vehicle_click'),
      (event) => event.targetLabel || 'Clic sin etiqueta',
    ),
  )

  const dailyViews = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    const count = pageViews.filter((event) => event.createdAt?.slice(0, 10) === key).length
    return { key, count }
  })
  const maxDailyViews = Math.max(...dailyViews.map((day) => day.count), 1)

  return (
    <section className="analytics-dashboard">
      <div className="analytics-dashboard__hero">
        <div>
          <p>Tablero principal</p>
          <h1>Analitica de inventario</h1>
          <span>Ultimos 30 dias de actividad del sitio y comportamiento por vehiculo.</span>
        </div>
        <a href="/admin/collections/analytics-events">Ver eventos</a>
      </div>

      <div className="analytics-dashboard__metrics">
        <article>
          <span>Vistas de pagina</span>
          <strong>{formatNumber(pageViews.length)}</strong>
          <small>{percentageChange(pageViews.length, previousPageViews.length)} vs. periodo anterior</small>
        </article>
        <article>
          <span>Autos mostrados</span>
          <strong>{formatNumber(vehicleViews.length)}</strong>
          <small>{formatNumber(availableVehicles)} disponibles en inventario</small>
        </article>
        <article>
          <span>Clics en autos</span>
          <strong>{formatNumber(vehicleClicks.length)}</strong>
          <small>Interes directo sobre fichas y tarjetas</small>
        </article>
        <article>
          <span>Tiempo promedio</span>
          <strong>{formatDuration(averageDuration)}</strong>
          <small>Promedio registrado por pagina</small>
        </article>
      </div>

      <div className="analytics-dashboard__grid">
        <article className="analytics-dashboard__panel analytics-dashboard__panel--wide">
          <div className="analytics-dashboard__panel-header">
            <h2>Tendencia de vistas</h2>
            <span>Ultimos 7 dias</span>
          </div>
          <div className="analytics-dashboard__bars">
            {dailyViews.map((day) => (
              <div key={day.key}>
                <span style={{ height: `${Math.max((day.count / maxDailyViews) * 100, 6)}%` }} />
                <small>
                  {new Date(`${day.key}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'short' })}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article className="analytics-dashboard__panel">
          <div className="analytics-dashboard__panel-header">
            <h2>Inventario</h2>
            <span>{formatNumber(vehicles.length)} unidades</span>
          </div>
          <div className="analytics-dashboard__inventory">
            <div><strong>{formatNumber(availableVehicles)}</strong><span>Disponibles</span></div>
            <div><strong>{formatNumber(reservedVehicles)}</strong><span>Apartados</span></div>
            <div><strong>{formatNumber(soldVehicles)}</strong><span>Vendidos</span></div>
          </div>
        </article>

        <Leaderboard title="Paginas mas vistas" entries={pageViewCounts} empty="Aun no hay vistas registradas." />
        <Leaderboard title="Vehiculos mas mostrados" entries={vehicleViewCounts} empty="Aun no hay vistas de vehiculos." />
        <Leaderboard title="Autos con mas clics" entries={vehicleClickCounts} empty="Aun no hay clics en vehiculos." />
        <Leaderboard title="Elementos con mas clics" entries={clickTargetCounts} empty="Aun no hay clics registrados." />
      </div>
    </section>
  )
}

function getInventoryStatus(vehicle: Vehicle) {
  return vehicle.inventoryStatus || vehicle.status || 'available'
}

function Leaderboard({
  empty,
  entries,
  title,
}: {
  empty: string
  entries: [string, number][]
  title: string
}) {
  const max = Math.max(...entries.map(([, count]) => count), 1)

  return (
    <article className="analytics-dashboard__panel">
      <div className="analytics-dashboard__panel-header">
        <h2>{title}</h2>
      </div>
      {entries.length ? (
        <ol className="analytics-dashboard__leaderboard">
          {entries.map(([label, count]) => (
            <li key={label}>
              <div>
                <span>{label}</span>
                <strong>{formatNumber(count)}</strong>
              </div>
              <span style={{ width: `${Math.max((count / max) * 100, 8)}%` }} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="analytics-dashboard__empty">{empty}</p>
      )}
    </article>
  )
}
