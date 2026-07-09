'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
  ActionButton,
  AdminPageHeader,
  AdminPageShell,
  AdminTable,
  AdminTabs,
  EmptyState,
  StatusBadge,
} from '../admin-ui/kit'
import VehicleImportModal from '../admin-ui/VehicleImportModal'
import {
  IMAGE_STATUS_LABELS,
  PUBLISH_STATUS_LABELS,
  type ImageStatus,
  type PublishStatus,
} from '../../services/vehicleWorkflow'

type Vehicle = {
  id: string | number
  brand?: string
  model?: string
  year?: number
  price?: string
  condition?: string
  publishStatus?: PublishStatus
  imageStatus?: ImageStatus
  completenessScore?: number
  inventoryStatus?: string
  city?: string
  exteriorColor?: string
  dealership?: { name?: string; displayName?: string; city?: string } | string | number | null
  image?: { url?: string; thumbnailURL?: string } | string | null
  imageUrl?: string | null
  imagePath?: string | null
  imageFilename?: string | null
}

type TabKey =
  | 'all'
  | 'published'
  | 'drafts'
  | 'needs_review'
  | 'missing_images'
  | 'missing_agency'
  | 'nuevos'
  | 'seminuevos'
  | 'reserved'
  | 'sold'
  | 'archived'

type TabDefinition = {
  key: TabKey
  label: string
  where: (scope: string) => string[]
}

const equalsFilter = (scope: string, field: string, value: string) =>
  `${scope}[${field}][equals]=${encodeURIComponent(value)}`

const TABS: TabDefinition[] = [
  { key: 'all', label: 'Todos', where: () => [] },
  {
    key: 'published',
    label: 'Publicados',
    where: (scope) => [equalsFilter(scope, 'publishStatus', 'published')],
  },
  {
    key: 'drafts',
    label: 'Borradores',
    where: (scope) => [equalsFilter(scope, 'publishStatus', 'draft')],
  },
  {
    key: 'needs_review',
    label: 'En revisión',
    where: (scope) => [equalsFilter(scope, 'publishStatus', 'needs_review')],
  },
  {
    key: 'missing_images',
    label: 'Sin imagen',
    where: (scope) => [equalsFilter(scope, 'imageStatus', 'missing')],
  },
  {
    key: 'missing_agency',
    label: 'Sin agencia',
    where: (scope) => [`${scope}[dealership][exists]=false`],
  },
  { key: 'nuevos', label: 'Nuevos', where: (scope) => [equalsFilter(scope, 'condition', 'new')] },
  {
    key: 'seminuevos',
    label: 'Seminuevos',
    where: (scope) => [equalsFilter(scope, 'condition', 'used')],
  },
  {
    key: 'reserved',
    label: 'Apartados',
    where: (scope) => [equalsFilter(scope, 'inventoryStatus', 'reserved')],
  },
  {
    key: 'sold',
    label: 'Vendidos',
    where: (scope) => [equalsFilter(scope, 'inventoryStatus', 'sold')],
  },
  {
    key: 'archived',
    label: 'Archivados',
    where: (scope) => [equalsFilter(scope, 'publishStatus', 'archived')],
  },
]

const PAGE_SIZE = 20

const PUBLISH_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  published: 'success',
  needs_review: 'warning',
  draft: 'neutral',
  archived: 'danger',
}

const INVENTORY_STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  reserved: 'Apartado',
  sold: 'Vendido',
}

const INVENTORY_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  available: 'success',
  reserved: 'warning',
  sold: 'neutral',
}

function tabDefinition(tab: TabKey): TabDefinition {
  return TABS.find((t) => t.key === tab) || TABS[0]
}

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((t) => t.key === value)
}

function buildQuery(tab: TabKey, search: string, page: number, sort: string): string {
  const parts: string[] = [`limit=${PAGE_SIZE}`, `page=${page}`, `depth=1`, `sort=${sort}`]
  const trimmed = search.trim()
  const base = tabDefinition(tab).where(trimmed ? 'where[and][0]' : 'where')
  if (base.length > 0 && trimmed) {
    parts.push(...base)
    const q = encodeURIComponent(trimmed)
    parts.push(`where[and][1][or][0][brand][like]=${q}`)
    parts.push(`where[and][1][or][1][model][like]=${q}`)
    parts.push(`where[and][1][or][2][city][like]=${q}`)
    parts.push(`where[and][1][or][3][exteriorColor][like]=${q}`)
  } else if (base.length > 0) {
    parts.push(...base)
  } else if (trimmed) {
    const q = encodeURIComponent(trimmed)
    parts.push(`where[or][0][brand][like]=${q}`)
    parts.push(`where[or][1][model][like]=${q}`)
    parts.push(`where[or][2][city][like]=${q}`)
    parts.push(`where[or][3][exteriorColor][like]=${q}`)
  }
  return parts.join('&')
}

function mediaImageUrl(image: Vehicle['image']): string | undefined {
  if (!image || typeof image === 'string') return undefined
  return image.thumbnailURL || image.url
}

function vehicleImageUrl(vehicle: Vehicle): string | undefined {
  return mediaImageUrl(vehicle.image) || undefined
}

function displayedImageStatus(vehicle: Vehicle): ImageStatus {
  return (vehicle.imageStatus as ImageStatus) || 'missing'
}

function dealershipLabel(vehicle: Vehicle): string {
  if (vehicle.dealership && typeof vehicle.dealership === 'object') {
    return vehicle.dealership.displayName || vehicle.dealership.name || 'Agencia asignada'
  }
  return vehicle.dealership ? 'Agencia asignada' : 'Sin agencia'
}

function conditionLabel(condition?: string) {
  if (condition === 'used') return 'Seminuevo'
  if (condition === 'new') return 'Nuevo'
  return '—'
}

export default function InventoryManager() {
  const [tab, setTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sort, setSort] = useState('-updatedAt')
  const [page, setPage] = useState(1)
  const [docs, setDocs] = useState<Vehicle[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    if (window.location.pathname.endsWith('/admin/collections/vehicles/create')) {
      window.location.replace('/admin/inventory/new')
    }
  }, [])

  // Deep links: /admin/inventory?tab=missing_images preselects a filter tab
  // (used by the dashboard shortcuts). Applied after mount to avoid SSR
  // hydration mismatches.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab')
    if (isTabKey(requested)) {
      setTab(requested)
      setPage(1)
    }
  }, [])

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = buildQuery(tab, appliedSearch, page, sort)
      const res = await fetch(`/api/vehicles?${query}`, { credentials: 'include' })
      if (!res.ok) throw new Error('No se pudo cargar el inventario.')
      const data = (await res.json()) as {
        docs: Vehicle[]
        totalDocs: number
        totalPages: number
      }
      setDocs(data.docs || [])
      setTotalDocs(data.totalDocs || 0)
      setTotalPages(data.totalPages || 1)
      setSelected(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar.')
    } finally {
      setLoading(false)
    }
  }, [tab, appliedSearch, page, sort])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  const fetchCounts = useCallback(async () => {
    const entries: Array<readonly [TabKey, number]> = []
    for (const t of TABS) {
      const q = [`limit=1`, `depth=0`, ...t.where('where')].join('&')
      try {
        const res = await fetch(`/api/vehicles?${q}`, { credentials: 'include' })
        if (!res.ok) {
          entries.push([t.key, 0] as const)
          continue
        }
        const data = (await res.json()) as { totalDocs: number }
        entries.push([t.key, data.totalDocs || 0] as const)
      } catch {
        entries.push([t.key, 0] as const)
      }
    }
    setCounts(Object.fromEntries(entries))
  }, [])

  useEffect(() => {
    void fetchCounts()
  }, [fetchCounts])

  // Keep the page in range when filters/search shrink the result set.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [totalPages, page])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === docs.length) return new Set()
      return new Set(docs.map((d) => String(d.id)))
    })
  }, [docs])

  const runBulk = useCallback(
    async (patch: Record<string, unknown>, confirmMessage?: string) => {
      if (selected.size === 0) return
      if (confirmMessage && !window.confirm(confirmMessage)) return
      setBulkBusy(true)
      setError(null)
      try {
        const responses = await Promise.all(
          Array.from(selected).map((id) =>
            fetch(`/api/vehicles/${id}`, {
              method: 'PATCH',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch),
            }),
          ),
        )
        const failed = responses.filter((res) => !res.ok)
        if (failed.length > 0) {
          const firstError = await failed[0].text().catch(() => '')
          throw new Error(
            `${failed.length} de ${responses.length} vehiculo(s) no se pudieron actualizar. ${firstError}`.trim(),
          )
        }
        await Promise.all([fetchList(), fetchCounts()])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error en la acción masiva.')
      } finally {
        setBulkBusy(false)
      }
    },
    [selected, fetchList, fetchCounts],
  )

  const deleteBulk = useCallback(async () => {
    if (selected.size === 0) return
    if (
      !window.confirm(`¿Eliminar ${selected.size} vehículo(s)? Esta acción no se puede deshacer.`)
    )
      return
    setBulkBusy(true)
    setError(null)
    try {
      const responses = await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/vehicles/${id}`, { method: 'DELETE', credentials: 'include' }),
        ),
      )
      const failed = responses.filter((res) => !res.ok)
      if (failed.length > 0) {
        const firstError = await failed[0].text().catch(() => '')
        throw new Error(
          `${failed.length} de ${responses.length} vehiculo(s) no se pudieron eliminar. ${firstError}`.trim(),
        )
      }
      await Promise.all([fetchList(), fetchCounts()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.')
    } finally {
      setBulkBusy(false)
    }
  }, [selected, fetchList, fetchCounts])

  const allSelected = selected.size > 0 && selected.size === docs.length

  const header = useMemo(
    () => (
      <AdminPageHeader
        title="Inventario"
        subtitle="Gestiona, filtra y publica vehículos en lote."
        actions={
          <>
            <ActionButton onClick={() => setImportOpen(true)} variant="primary">
              Importar CSV/XLSX
            </ActionButton>
            <ActionButton href="/admin/inventory/new" variant="secondary">
              + Nuevo vehículo
            </ActionButton>
            <ActionButton onClick={() => void fetchList()} variant="secondary" disabled={loading}>
              Recargar
            </ActionButton>
          </>
        }
      />
    ),
    [fetchList, loading],
  )

  return (
    <AdminPageShell className="inventory">
      {header}

      <VehicleImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => {
          void fetchList()
          void fetchCounts()
        }}
      />

      <AdminTabs
        active={tab}
        ariaLabel="Filtros de inventario"
        className="inventory__tabs"
        items={TABS.map((t) => ({
          key: t.key,
          label: t.label,
          badge: typeof counts[t.key] === 'number' ? counts[t.key] : undefined,
        }))}
        onChange={(key) => {
          setTab(key)
          setPage(1)
        }}
      />

      <div className="inventory__toolbar">
        <form
          className="inventory__search"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setAppliedSearch(search)
          }}
        >
          <input
            type="search"
            placeholder="Buscar por marca, modelo o ciudad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="admin-kit-btn admin-kit-btn--secondary" type="submit">
            Buscar
          </button>
        </form>
        <select className="inventory__sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="-updatedAt">Recientes primero</option>
          <option value="updatedAt">Antiguos primero</option>
          <option value="brand">Marca (A-Z)</option>
          <option value="-completenessScore">Más completos</option>
          <option value="completenessScore">Menos completos</option>
        </select>
      </div>

      {selected.size > 0 ? (
        <div className="inventory__bulkbar">
          <span>{selected.size} seleccionado(s)</span>
          <ActionButton
            variant="primary"
            disabled={bulkBusy}
            onClick={() =>
              void runBulk({ publishStatus: 'published' }, '¿Publicar los vehículos seleccionados?')
            }
          >
            Publicar
          </ActionButton>
          <ActionButton
            variant="secondary"
            disabled={bulkBusy}
            onClick={() => void runBulk({ publishStatus: 'needs_review' })}
          >
            Enviar a revisión
          </ActionButton>
          <ActionButton
            variant="secondary"
            disabled={bulkBusy}
            onClick={() => void runBulk({ publishStatus: 'draft' })}
          >
            Mover a borrador
          </ActionButton>
          <ActionButton
            variant="secondary"
            disabled={bulkBusy}
            onClick={() => void runBulk({ publishStatus: 'archived' })}
          >
            Archivar
          </ActionButton>
          <ActionButton
            variant="secondary"
            disabled={bulkBusy}
            onClick={() => void runBulk({ inventoryStatus: 'available' })}
          >
            Disponible
          </ActionButton>
          <ActionButton
            variant="secondary"
            disabled={bulkBusy}
            onClick={() => void runBulk({ inventoryStatus: 'reserved' })}
          >
            Apartar
          </ActionButton>
          <ActionButton
            variant="secondary"
            disabled={bulkBusy}
            onClick={() => void runBulk({ inventoryStatus: 'sold' })}
          >
            Vendido
          </ActionButton>
          <ActionButton variant="danger" disabled={bulkBusy} onClick={() => void deleteBulk()}>
            Eliminar
          </ActionButton>
        </div>
      ) : null}

      {error ? <div className="builder__error">{error}</div> : null}

      {loading ? (
        <p className="builder__muted">Cargando inventario…</p>
      ) : docs.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          message="No hay vehículos que coincidan con este filtro."
        />
      ) : (
        <>
          <AdminTable tableClassName="inventory__table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th>Vehículo</th>
                <th>Precio</th>
                <th>Condición</th>
                <th>Inventario</th>
                <th>Publicación</th>
                <th>Imagen</th>
                <th>Completitud</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((vehicle) => {
                const id = String(vehicle.id)
                const url = vehicleImageUrl(vehicle)
                const imageStatus = displayedImageStatus(vehicle)
                return (
                  <tr key={id} className={selected.has(id) ? 'is-selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggleSelect(id)}
                      />
                    </td>
                    <td>
                      <div className="inventory__vehicle">
                        {url ? (
                          <img src={url} alt="" />
                        ) : (
                          <div className="inventory__thumb-empty">—</div>
                        )}
                        <div>
                          <strong>
                            {vehicle.brand || '—'} {vehicle.model || ''}
                          </strong>
                          {vehicle.exteriorColor ? (
                            <small>Color: {vehicle.exteriorColor}</small>
                          ) : null}
                          {vehicle.imageFilename ? <small>Imagen: {vehicle.imageFilename}</small> : null}
                          <small>
                            {vehicle.year || 's/año'} · {vehicle.city || 'sin ciudad'}
                          </small>
                          <small>{dealershipLabel(vehicle)}</small>
                        </div>
                      </div>
                    </td>
                    <td>{vehicle.price || '—'}</td>
                    <td>{conditionLabel(vehicle.condition)}</td>
                    <td>
                      <StatusBadge
                        tone={INVENTORY_TONE[vehicle.inventoryStatus || ''] || 'neutral'}
                      >
                        {INVENTORY_STATUS_LABELS[vehicle.inventoryStatus || ''] || 'Sin estatus'}
                      </StatusBadge>
                    </td>
                    <td>
                      <StatusBadge
                        tone={PUBLISH_TONE[vehicle.publishStatus || 'draft'] || 'neutral'}
                      >
                        {PUBLISH_STATUS_LABELS[(vehicle.publishStatus as PublishStatus) || 'draft']}
                      </StatusBadge>
                    </td>
                    <td>
                      <StatusBadge tone={imageStatus === 'missing' ? 'danger' : 'info'}>
                        {IMAGE_STATUS_LABELS[imageStatus]}
                      </StatusBadge>
                    </td>
                    <td>
                      <div
                        className="inventory__progress"
                        title={`${vehicle.completenessScore ?? 0}%`}
                      >
                        <span style={{ width: `${vehicle.completenessScore ?? 0}%` }} />
                      </div>
                    </td>
                    <td className="inventory__row-actions">
                      <ActionButton
                        href={`/admin/collections/vehicles/${id}/workspace`}
                        size="sm"
                        variant="secondary"
                      >
                        Abrir
                      </ActionButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </AdminTable>

          <div className="inventory__cards" aria-label="Inventario en tarjetas">
            {docs.map((vehicle) => {
              const id = String(vehicle.id)
              const url = vehicleImageUrl(vehicle)
              const imageStatus = displayedImageStatus(vehicle)
              return (
                <article
                  key={id}
                  className={`inventory-card${selected.has(id) ? ' is-selected' : ''}`}
                >
                  <div className="inventory-card__top">
                    <label className="inventory-card__select">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggleSelect(id)}
                      />
                      <span>Seleccionar</span>
                    </label>
                    <ActionButton
                      href={`/admin/collections/vehicles/${id}/workspace`}
                      size="sm"
                      variant="secondary"
                    >
                      Abrir
                    </ActionButton>
                  </div>
                  <div className="inventory-card__vehicle">
                    {url ? (
                      <img src={url} alt="" />
                    ) : (
                      <div className="inventory__thumb-empty">—</div>
                    )}
                    <div>
                      <strong>
                        {vehicle.brand || '—'} {vehicle.model || ''}
                      </strong>
                      <small>
                        {vehicle.year || 's/año'} · {vehicle.city || 'sin ciudad'}
                      </small>
                      {vehicle.imageFilename ? <small>Imagen: {vehicle.imageFilename}</small> : null}
                      <small>{dealershipLabel(vehicle)}</small>
                    </div>
                  </div>
                  <dl className="inventory-card__facts">
                    <div>
                      <dt>Precio</dt>
                      <dd>{vehicle.price || '—'}</dd>
                    </div>
                    <div>
                      <dt>Condición</dt>
                      <dd>{conditionLabel(vehicle.condition)}</dd>
                    </div>
                    {vehicle.exteriorColor ? (
                      <div>
                        <dt>Color</dt>
                        <dd>{vehicle.exteriorColor}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="inventory-card__badges">
                    <StatusBadge tone={INVENTORY_TONE[vehicle.inventoryStatus || ''] || 'neutral'}>
                      {INVENTORY_STATUS_LABELS[vehicle.inventoryStatus || ''] || 'Sin estatus'}
                    </StatusBadge>
                    <StatusBadge tone={PUBLISH_TONE[vehicle.publishStatus || 'draft'] || 'neutral'}>
                      {PUBLISH_STATUS_LABELS[(vehicle.publishStatus as PublishStatus) || 'draft']}
                    </StatusBadge>
                    <StatusBadge tone={imageStatus === 'missing' ? 'danger' : 'info'}>
                      {IMAGE_STATUS_LABELS[imageStatus]}
                    </StatusBadge>
                  </div>
                  <div className="inventory-card__completeness">
                    <span>Completitud {vehicle.completenessScore ?? 0}%</span>
                    <div className="inventory__progress">
                      <span style={{ width: `${vehicle.completenessScore ?? 0}%` }} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}

      <div className="inventory__pagination">
        <span>
          {totalDocs} vehículo(s) · página {page} de {totalPages}
        </span>
        <div>
          <ActionButton
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            size="sm"
            variant="secondary"
          >
            ← Anterior
          </ActionButton>
          <ActionButton
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            size="sm"
            variant="secondary"
          >
            Siguiente →
          </ActionButton>
        </div>
      </div>
    </AdminPageShell>
  )
}
