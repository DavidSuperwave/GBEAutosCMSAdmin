import type { PayloadRequest } from 'payload'

type AnalyticsEvent = {
  agency?: { displayName?: string; brandName?: string; city?: string } | string | number | null
  brand?: string
  city?: string
  condition?: string
  createdAt?: string
  durationSeconds?: number
  eventType?: string
  pagePath?: string
  pageTitle?: string
  sourceSection?: string
  targetLabel?: string
  vehicle?:
    | {
        brand?: string
        model?: string
        year?: number
      }
    | string
    | number
    | null
  vehicleLabel?: string
}

type Lead = {
  agency?: { displayName?: string; brandName?: string; city?: string } | string | number | null
  city?: string
  createdAt?: string
  stage?: string
  vehicleLabel?: string
}

type Vehicle = {
  brand?: string
  city?: string
  dealership?: unknown
  image?: unknown
  imageUrl?: string | null
  imageStatus?: string
  inventoryStatus?: string
  model?: string
  publishStatus?: string
  status?: string
  year?: number
}

type Props = {
  req: PayloadRequest
}

type PayloadFindResult<T> = {
  docs: T[]
  unavailable?: boolean
}

const formatter = new Intl.NumberFormat('es-MX')

function formatNumber(value: number) {
  return formatter.format(Math.round(value))
}

function formatPercent(numerator: number, denominator: number) {
  if (!denominator) return '0%'
  return `${Math.round((numerator / denominator) * 100)}%`
}

function formatVehicleName(event: AnalyticsEvent) {
  if (event.vehicle && typeof event.vehicle === 'object') {
    return [event.vehicle.brand, event.vehicle.model, event.vehicle.year].filter(Boolean).join(' ')
  }
  return event.vehicleLabel || 'Vehiculo sin identificar'
}

function agencyName(value: Lead['agency'] | AnalyticsEvent['agency']) {
  if (value && typeof value === 'object') {
    return value.displayName || value.brandName || value.city || 'Agencia asignada'
  }
  return value ? 'Agencia asignada' : 'Sin agencia'
}

function groupCount<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || 'Sin dato'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function topEntries(entries: Record<string, number>, limit = 6) {
  return Object.entries(entries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
}

function getInventoryStatus(vehicle: Vehicle) {
  return vehicle.inventoryStatus || vehicle.status || 'available'
}

function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

async function runLimited<T>(tasks: Array<() => Promise<T>>, concurrency: number) {
  const results: T[] = []
  let index = 0

  async function worker() {
    while (index < tasks.length) {
      const current = index
      index += 1
      results[current] = await tasks[current]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))

  return results
}

function emptyResult<T>(): PayloadFindResult<T> {
  return { docs: [], unavailable: true }
}

export default async function AnalyticsDashboard({ req }: Props) {
  const now = new Date()
  const currentStart = new Date(now)
  currentStart.setDate(now.getDate() - 30)

  async function safeFind<T>(label: string, task: () => Promise<PayloadFindResult<T>>) {
    try {
      return await task()
    } catch (error) {
      console.error(`Analytics dashboard query failed: ${label}`, error)
      return emptyResult<T>()
    }
  }

  const [eventsResult, vehiclesResult, leadsResult] = (await runLimited<PayloadFindResult<unknown>>(
    [
      () =>
        safeFind('analytics-events', () =>
          req.payload.find({
            collection: 'analytics-events',
            depth: 1,
            limit: 2000,
            sort: '-createdAt',
            where: { createdAt: { greater_than_equal: currentStart.toISOString() } },
          }),
        ),
      () =>
        safeFind('vehicles', () =>
          req.payload.find({ collection: 'vehicles', depth: 1, limit: 2000, sort: '-createdAt' }),
        ),
      () =>
        safeFind('leads', () =>
          req.payload.find({
            collection: 'leads',
            depth: 1,
            limit: 2000,
            sort: '-createdAt',
            where: { createdAt: { greater_than_equal: currentStart.toISOString() } },
          }),
        ),
    ],
    readPositiveInt('ADMIN_DASHBOARD_QUERY_CONCURRENCY', 2),
  )) as unknown as [
    PayloadFindResult<AnalyticsEvent>,
    PayloadFindResult<Vehicle>,
    PayloadFindResult<Lead>,
  ]

  const events = eventsResult.docs as AnalyticsEvent[]
  const vehicles = vehiclesResult.docs as Vehicle[]
  const leads = leadsResult.docs as Lead[]
  const hasUnavailableData = Boolean(
    eventsResult.unavailable || vehiclesResult.unavailable || leadsResult.unavailable,
  )

  const pageViews = events.filter((event) => event.eventType === 'page_view')
  const vehicleViews = events.filter((event) => event.eventType === 'vehicle_view')
  const vehicleClicks = events.filter((event) => event.eventType === 'vehicle_click')
  const formOpens = events.filter((event) => event.eventType === 'whatsapp_form_open')
  const formSubmits = events.filter((event) => event.eventType === 'whatsapp_form_submit')
  const whatsappOpens = events.filter((event) => event.eventType === 'whatsapp_open')
  const collectionViews = events.filter((event) => event.eventType === 'collection_view')
  const filterEvents = events.filter((event) => event.eventType === 'filter_used')

  const availableVehicles = vehicles.filter(
    (vehicle) => getInventoryStatus(vehicle) === 'available',
  ).length
  const soldVehicles = vehicles.filter((vehicle) => getInventoryStatus(vehicle) === 'sold').length
  const reservedVehicles = vehicles.filter(
    (vehicle) => getInventoryStatus(vehicle) === 'reserved',
  ).length
  const withoutImage = vehicles.filter((vehicle) => !vehicle.image && !vehicle.imageUrl).length
  const withoutAgency = vehicles.filter((vehicle) => !vehicle.dealership).length
  const drafts = vehicles.filter((vehicle) => vehicle.publishStatus === 'draft').length
  const needsReview = vehicles.filter((vehicle) => vehicle.publishStatus === 'needs_review').length

  const vehicleViewCounts = topEntries(groupCount(vehicleViews, formatVehicleName))
  const vehicleLeadCounts = topEntries(
    groupCount(leads, (lead) => lead.vehicleLabel || 'Vehiculo sin identificar'),
  )
  const agencyLeadCounts = topEntries(groupCount(leads, (lead) => agencyName(lead.agency)))
  const cityLeadCounts = topEntries(groupCount(leads, (lead) => lead.city || 'Sin ciudad'))
  const cityViewCounts = topEntries(groupCount(events, (event) => event.city || 'Sin ciudad'))
  const clickTargetCounts = topEntries(
    groupCount([...vehicleClicks, ...whatsappOpens], (event) => event.targetLabel || 'Clic'),
  )
  const collectionCounts = topEntries(
    groupCount(collectionViews, (event) => event.pageTitle || event.pagePath || 'Coleccion'),
  )
  const filterCounts = topEntries(
    groupCount(filterEvents, (event) => event.targetLabel || event.sourceSection || 'Filtro'),
  )

  const dailyLeads = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (6 - index))
    const key = date.toISOString().slice(0, 10)
    const views = pageViews.filter((event) => event.createdAt?.slice(0, 10) === key).length
    const leadsForDay = leads.filter((lead) => lead.createdAt?.slice(0, 10) === key).length
    const opens = whatsappOpens.filter((event) => event.createdAt?.slice(0, 10) === key).length
    return { key, views, leads: leadsForDay, opens }
  })
  const maxTrend = Math.max(...dailyLeads.flatMap((day) => [day.views, day.leads, day.opens]), 1)

  return (
    <section className="analytics-dashboard">
      <div className="analytics-dashboard__hero">
        <div>
          <p>Tablero principal</p>
          <h1>Ventas, trafico y WhatsApp</h1>
          <span>Ultimos 30 dias de demanda, leads e inventario accionable.</span>
        </div>
        <a href="/admin/collections/analytics-events">Ver eventos</a>
      </div>

      {hasUnavailableData ? (
        <p className="analytics-dashboard__empty">
          Algunos datos del tablero no estan disponibles temporalmente. El admin sigue operativo.
        </p>
      ) : null}

      <div className="analytics-dashboard__metrics">
        <Metric label="Vistas web" value={pageViews.length} detail="Paginas visitadas" />
        <Metric label="Vistas de autos" value={vehicleViews.length} detail="Fichas vistas" />
        <Metric label="Formularios abiertos" value={formOpens.length} detail="Intento WhatsApp" />
        <Metric
          label="Leads WhatsApp"
          value={leads.length || formSubmits.length}
          detail={`${formatPercent(leads.length || formSubmits.length, formOpens.length)} conversion`}
        />
        <Metric label="WhatsApp abiertos" value={whatsappOpens.length} detail="Click de salida" />
        <Metric
          label="Disponibles"
          value={availableVehicles}
          detail={`${reservedVehicles} apartados, ${soldVehicles} vendidos`}
        />
      </div>

      <div className="analytics-dashboard__grid">
        <article className="analytics-dashboard__panel analytics-dashboard__panel--wide">
          <div className="analytics-dashboard__panel-header">
            <h2>Tendencia de demanda</h2>
            <span>Vistas, leads y WhatsApp</span>
          </div>
          <div className="analytics-dashboard__bars analytics-dashboard__bars--multi">
            {dailyLeads.map((day) => (
              <div key={day.key}>
                <span style={{ height: `${Math.max((day.views / maxTrend) * 100, 6)}%` }} />
                <span style={{ height: `${Math.max((day.leads / maxTrend) * 100, 6)}%` }} />
                <span style={{ height: `${Math.max((day.opens / maxTrend) * 100, 6)}%` }} />
                <small>
                  {new Date(`${day.key}T12:00:00`).toLocaleDateString('es-MX', {
                    weekday: 'short',
                  })}
                </small>
              </div>
            ))}
          </div>
        </article>

        <article className="analytics-dashboard__panel">
          <div className="analytics-dashboard__panel-header">
            <h2>Salud de inventario</h2>
            <span>{formatNumber(vehicles.length)} unidades</span>
          </div>
          <div className="analytics-dashboard__inventory">
            <div>
              <strong>{formatNumber(withoutImage)}</strong>
              <span>Sin imagen</span>
            </div>
            <div>
              <strong>{formatNumber(withoutAgency)}</strong>
              <span>Sin agencia</span>
            </div>
            <div>
              <strong>{formatNumber(drafts + needsReview)}</strong>
              <span>Por revisar</span>
            </div>
          </div>
          <a className="analytics-dashboard__link" href="/admin/inventory?tab=missing_images">
            Atender inventario
          </a>
        </article>

        <Leaderboard
          title="Autos mas vistos"
          entries={vehicleViewCounts}
          empty="Aun no hay vistas de autos."
        />
        <Leaderboard
          title="Autos con mas leads"
          entries={vehicleLeadCounts}
          empty="Aun no hay leads por auto."
        />
        <Leaderboard
          title="Leads por agencia"
          entries={agencyLeadCounts}
          empty="Aun no hay leads por agencia."
        />
        <Leaderboard
          title="Leads por ciudad"
          entries={cityLeadCounts}
          empty="Aun no hay leads por ciudad."
        />
        <Leaderboard
          title="Vistas por ciudad"
          entries={cityViewCounts}
          empty="Aun no hay vistas con ciudad."
        />
        <Leaderboard
          title="Colecciones vistas"
          entries={collectionCounts}
          empty="Aun no hay vistas de colecciones."
        />
        <Leaderboard
          title="Filtros usados"
          entries={filterCounts}
          empty="Aun no hay filtros registrados."
        />
        <Leaderboard
          title="Clics e intencion"
          entries={clickTargetCounts}
          empty="Aun no hay clics registrados."
        />
      </div>
    </section>
  )
}

function Metric({ detail, label, value }: { detail: string; label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      <small>{detail}</small>
    </article>
  )
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
