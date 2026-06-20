import type { PayloadRequest, Where } from 'payload'

type Props = {
  req: PayloadRequest
}

const numberFormatter = new Intl.NumberFormat('es-MX')

function fmt(value: number) {
  return numberFormatter.format(value)
}

async function countVehicles(req: PayloadRequest, where: Where = {}) {
  try {
    const result = await req.payload.find({
      collection: 'vehicles',
      depth: 0,
      limit: 1,
      where,
    })
    return result.totalDocs
  } catch {
    return null
  }
}

function fmtMetric(value: number | null) {
  return value === null ? '—' : fmt(value)
}

function metricDescription(value: number | null, suffix: string) {
  return value === null ? 'No disponible temporalmente.' : `${fmt(value)} ${suffix}`
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

export default async function OperationsDashboard({ req }: Props) {
  const [total, published, drafts, needsReview, missingImages, missingSpecs, seminuevos, nuevos] =
    await runLimited(
      [
        () => countVehicles(req),
        () => countVehicles(req, { publishStatus: { equals: 'published' } }),
        () => countVehicles(req, { publishStatus: { equals: 'draft' } }),
        () => countVehicles(req, { publishStatus: { equals: 'needs_review' } }),
        () => countVehicles(req, { imageStatus: { equals: 'missing' } }),
        () => countVehicles(req, { specStatus: { equals: 'missing' } }),
        () => countVehicles(req, { condition: { equals: 'used' } }),
        () => countVehicles(req, { condition: { equals: 'new' } }),
      ],
      readPositiveInt('ADMIN_DASHBOARD_QUERY_CONCURRENCY', 2),
    )

  const recentImports = await req.payload
    .find({ collection: 'import-jobs', depth: 0, limit: 3, sort: '-createdAt' })
    .catch(() => ({ docs: [] as Array<Record<string, unknown>> }))

  const shortcuts: Array<{ href: string; title: string; desc: string; accent: string }> = [
    {
      href: '/admin/collections/vehicles/create',
      title: 'Agregar vehículo',
      desc: 'Crea una unidad nueva paso a paso.',
      accent: '#2f7d64',
    },
    {
      href: '/admin/inventory',
      title: 'Importar inventario',
      desc: 'Gestiona y sube un archivo XLSX o CSV.',
      accent: '#2563eb',
    },
    {
      href: '/admin/inventory?tab=missing_images',
      title: 'Faltan imágenes',
      desc: metricDescription(missingImages, 'vehículos sin imagen.'),
      accent: '#d97706',
    },
    {
      href: '/admin/inventory?tab=needs_review',
      title: 'Pendientes de revisión',
      desc: metricDescription(needsReview, 'esperando publicación.'),
      accent: '#7c3aed',
    },
    {
      href: '/admin/inventory',
      title: 'Taller de imágenes',
      desc: 'Sube o genera imágenes desde cada vehículo.',
      accent: '#db2777',
    },
  ]

  const metrics: Array<{ label: string; value: number | null; hint?: string }> = [
    { label: 'Total de vehículos', value: total },
    { label: 'Publicados', value: published },
    { label: 'Borradores', value: drafts },
    { label: 'En revisión', value: needsReview },
    { label: 'Sin imagen', value: missingImages },
    { label: 'Sin especificaciones', value: missingSpecs },
    { label: 'Seminuevos', value: seminuevos },
    { label: 'Nuevos', value: nuevos },
  ]

  const imports = (recentImports.docs || []) as Array<{
    id: number | string
    fileName?: string
    status?: string
    createdCount?: number
    createdAt?: string
  }>

  return (
    <section className="ops-dashboard">
      <div className="ops-dashboard__hero">
        <div>
          <p>Centro de operaciones</p>
          <h1>Inventario primero</h1>
          <span>Importa, completa, agrega imágenes y publica. Todo desde un mismo flujo.</span>
        </div>
        <a href="/admin/inventory">Ver inventario</a>
      </div>

      <div className="ops-dashboard__shortcuts">
        {shortcuts.map((shortcut) => (
          <a key={shortcut.title} href={shortcut.href} className="ops-dashboard__shortcut">
            <span className="ops-dashboard__shortcut-dot" style={{ background: shortcut.accent }} />
            <strong>{shortcut.title}</strong>
            <small>{shortcut.desc}</small>
          </a>
        ))}
      </div>

      <div className="ops-dashboard__metrics">
        {metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{fmtMetric(metric.value)}</strong>
            {metric.hint ? <small>{metric.hint}</small> : null}
          </article>
        ))}
      </div>

      {imports.length ? (
        <div className="ops-dashboard__imports">
          <div className="ops-dashboard__panel-header">
            <h2>Importaciones recientes</h2>
            <a href="/admin/inventory">Ir a inventario</a>
          </div>
          <ul>
            {imports.map((job) => (
              <li key={job.id}>
                <a href="/admin/inventory">
                  <strong>{job.fileName || 'Importación'}</strong>
                  <span>
                    {job.status || 'pendiente'} · {fmt(job.createdCount || 0)} creados
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
