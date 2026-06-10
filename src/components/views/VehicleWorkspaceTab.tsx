'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

import SectionBuilder, { type Section } from '../admin-ui/SectionBuilder'
import VehicleImageStudio from './VehicleImageStudio'
import { VEHICLE_SECTION_LIBRARY } from '../admin-ui/sectionLibraries'
import {
  ActionButton,
  CompletionChecklist,
  EmptyState,
  StatusBadge,
  VehicleSummaryCard,
  type ChecklistItem,
} from '../admin-ui/kit'
import {
  IMAGE_STATUS_LABELS,
  PUBLISH_STATUS_LABELS,
  SPEC_STATUS_LABELS,
  SPEC_KEYS,
  calculateVehicleCompleteness,
  getVehiclePublishIssues,
  type ImageStatus,
  type PublishStatus,
  type SpecStatus,
  type VehicleLike,
} from '../../services/vehicleWorkflow'

type MediaRef = { url?: string; thumbnailURL?: string; alt?: string } | string | null

type Vehicle = Omit<VehicleLike, 'gallery' | 'dealership'> & {
  id: string | number
  image?: MediaRef
  gallery?: Array<{ image?: MediaRef; alt?: string }> | null
  dealership?: { name?: string } | string | null
  createdAt?: string
  updatedAt?: string
  publishedAt?: string | null
  lastReviewedAt?: string | null
  sourceImportId?: string | null
  sourceDealerName?: string | null
  interiorColor?: string | null
  trim?: string | null
  bodyType?: string | null
  transmission?: string | null
  fuel?: string | null
  badges?: Array<{ label?: string | null }> | null
  specs?: Record<string, unknown> | null
}

type SpecDraft = {
  exteriorColor: string
  interiorColor: string
  bodyType: string
  transmission: string
  fuel: string
  specs: Record<string, string>
}

const SPEC_LABELS: Record<string, string> = {
  tipo: 'Tipo / carrocería',
  motor: 'Motor',
  potencia: 'Potencia',
  transmision: 'Transmisión',
  combustible: 'Combustible',
  traccion: 'Tracción',
  cylinders: 'Cilindros',
  seats: 'Asientos',
  doors: 'Puertas',
  lengthMm: 'Largo (mm)',
  widthMm: 'Ancho (mm)',
  heightMm: 'Alto (mm)',
  wheelbaseMm: 'Distancia entre ejes (mm)',
  maxTrunkCapacityL: 'Capacidad cajuela (L)',
  torqueNm: 'Torque (Nm)',
  fuelTankCapacityL: 'Tanque combustible (L)',
}

const TABS = [
  { key: 'overview', label: 'Resumen' },
  { key: 'specs', label: 'Especificaciones' },
  { key: 'images', label: 'Imágenes' },
  { key: 'listing', label: 'Página' },
  { key: 'review', label: 'Revisar y publicar' },
  { key: 'activity', label: 'Actividad' },
] as const

type TabKey = (typeof TABS)[number]['key']

function mediaUrl(media: MediaRef): string | undefined {
  if (!media || typeof media === 'string') return undefined
  return media.thumbnailURL || media.url
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return value
  }
}

export default function VehicleWorkspaceTab() {
  const { id } = useDocumentInfo()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [specSaving, setSpecSaving] = useState(false)
  const [specEditorOpen, setSpecEditorOpen] = useState(false)
  const [activeSpecField, setActiveSpecField] = useState<string | null>(null)
  const [specDraft, setSpecDraft] = useState<SpecDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/vehicles/${id}?depth=1`, { credentials: 'include' })
      if (!res.ok) throw new Error('No se pudo cargar el vehículo.')
      setVehicle((await res.json()) as Vehicle)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const completeness = useMemo(() => (vehicle ? calculateVehicleCompleteness(vehicle) : 0), [vehicle])
  const issues = useMemo(
    () => (vehicle ? getVehiclePublishIssues(vehicle) : { critical: [], warnings: [] }),
    [vehicle],
  )

  const checklist = useMemo<ChecklistItem[]>(() => {
    if (!vehicle) return []
    const items: ChecklistItem[] = []
    const need = (label: string, ok: boolean) => items.push({ label, status: ok ? 'ok' : 'bad' })
    need('Marca, modelo y año', Boolean(vehicle.brand && vehicle.model && vehicle.year))
    need('Agencia asignada', Boolean(vehicle.dealership))
    need('Condición e inventario', Boolean(vehicle.condition && vehicle.inventoryStatus))
    need('Imagen principal', Boolean(mediaUrl(vehicle.image ?? null)))
    items.push({
      label: 'Imagen aprobada',
      status: vehicle.imageStatus === 'approved' ? 'ok' : vehicle.image ? 'warn' : 'bad',
    })
    items.push({ label: 'Precio', status: vehicle.price ? 'ok' : 'warn' })
    items.push({
      label: 'Descripción',
      status: vehicle.description && String(vehicle.description).length >= 40 ? 'ok' : 'warn',
    })
    return items
  }, [vehicle])

  const setStatus = useCallback(
    async (publishStatus: PublishStatus, opts?: { guard?: boolean }) => {
      if (!id || !vehicle) return
      if (opts?.guard && issues.critical.length > 0) {
        setError('No se puede publicar: resuelve los problemas críticos primero.')
        setTab('review')
        return
      }
      setBusy(true)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch(`/api/vehicles/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publishStatus }),
        })
        if (!res.ok) {
          const detail = await res.text()
          throw new Error(`No se pudo actualizar el estado. ${detail.slice(0, 160)}`)
        }
        setNotice(`Estado actualizado a "${PUBLISH_STATUS_LABELS[publishStatus]}".`)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al actualizar.')
      } finally {
        setBusy(false)
      }
    },
    [id, vehicle, issues.critical.length, load],
  )

  const openSpecEditor = useCallback(() => {
    if (!vehicle) return
    setSpecDraft({
      exteriorColor: vehicle.exteriorColor || '',
      interiorColor: vehicle.interiorColor || '',
      bodyType: vehicle.bodyType || '',
      transmission: vehicle.transmission || '',
      fuel: vehicle.fuel || '',
      specs: SPEC_KEYS.reduce<Record<string, string>>((draft, key) => {
        draft[key] = vehicle.specs?.[key] ? String(vehicle.specs[key]) : ''
        return draft
      }, {}),
    })
    setSpecEditorOpen(true)
  }, [vehicle])

  useEffect(() => {
    if (vehicle && !specDraft) openSpecEditor()
  }, [vehicle, specDraft, openSpecEditor])

  const editSpecField = useCallback(
    (field: string) => {
      openSpecEditor()
      setActiveSpecField(field)
    },
    [openSpecEditor],
  )

  const setSpecDraftValue = useCallback((field: string, value: string) => {
    setSpecDraft((draft) => {
      if (!draft) return draft
      if (field === 'exteriorColor' || field === 'interiorColor') {
        return { ...draft, [field]: value }
      }
      return { ...draft, specs: { ...draft.specs, [field]: value } }
    })
  }, [])

  const saveSpecEdits = useCallback(async () => {
    if (!id || !specDraft) return
    setSpecSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exteriorColor: specDraft.exteriorColor,
          interiorColor: specDraft.interiorColor,
          bodyType: specDraft.bodyType || null,
          transmission: specDraft.transmission || null,
          fuel: specDraft.fuel || null,
          specs: specDraft.specs,
          specStatus: 'manual',
        }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudieron guardar especificaciones. ${detail.slice(0, 160)}`)
      }
      setNotice('Especificaciones actualizadas.')
      setActiveSpecField(null)
      setSpecEditorOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar especificaciones.')
    } finally {
      setSpecSaving(false)
    }
  }, [id, specDraft, load])

  const generateInternalTags = useCallback(async () => {
    if (!id || !vehicle) return
    const specs = specDraft?.specs || vehicle.specs || {}
    const candidates = [
      vehicle.condition === 'used' ? 'Seminuevo' : vehicle.condition === 'new' ? 'Nuevo' : '',
      vehicle.brand,
      vehicle.year ? String(vehicle.year) : '',
      specDraft?.exteriorColor || vehicle.exteriorColor,
      specs.tipo,
      specs.combustible,
      specs.transmision,
      specs.traccion,
      vehicle.bodyType,
      vehicle.transmission,
      vehicle.fuel,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean)

    const seen = new Set<string>()
    const existing = (vehicle.badges || [])
      .map((badge) => String(badge.label || '').trim())
      .filter(Boolean)
    const labels = [...existing, ...candidates].filter((label) => {
      const key = label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    setSpecSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badges: labels.map((label) => ({ label })) }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudieron generar tags. ${detail.slice(0, 160)}`)
      }
      setNotice(`${labels.length} tags internos listos para filtros.`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar tags.')
    } finally {
      setSpecSaving(false)
    }
  }, [id, vehicle, specDraft, load])

  const loadSections = useCallback(async () => {
    if (!id) return { sections: [] as Section[] }
    const res = await fetch(`/api/vehicles/${id}?depth=0`, { credentials: 'include' })
    if (!res.ok) throw new Error('No se pudo cargar el contenido.')
    const data = (await res.json()) as { landing?: Section[] }
    return { sections: data.landing || [] }
  }, [id])

  const saveSections = useCallback(
    async (sections: Section[]) => {
      if (!id) return
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landing: sections }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudo guardar. ${detail.slice(0, 160)}`)
      }
    },
    [id],
  )

  if (!id) {
    return (
      <div className="admin-kit-shell workspace">
        <EmptyState
          title="Guarda el vehículo primero"
          message="El Espacio de trabajo está disponible después de crear el vehículo. Usa la pestaña principal para capturar los datos iniciales y guardar."
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-kit-shell workspace">
        <p className="builder__muted">Cargando espacio de trabajo…</p>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="admin-kit-shell workspace">
        <div className="builder__error">{error || 'No se encontró el vehículo.'}</div>
      </div>
    )
  }

  const title = `${vehicle.brand || 'Vehículo'} ${vehicle.model || ''} ${vehicle.year || ''}`.trim()
  const publishStatus = (vehicle.publishStatus as PublishStatus) || 'draft'

  const specCardValue = (field: string): string => {
    if (field === 'exteriorColor') return specDraft?.exteriorColor ?? vehicle.exteriorColor ?? ''
    if (field === 'interiorColor') return specDraft?.interiorColor ?? vehicle.interiorColor ?? ''
    return specDraft?.specs[field] ?? (vehicle.specs?.[field] ? String(vehicle.specs[field]) : '')
  }

  const renderSpecCard = (field: string, label: string) => {
    const isActive = activeSpecField === field
    const value = specCardValue(field)
    return (
      <div
        key={field}
        className={`workspace__spec workspace__spec-button${value ? '' : ' workspace__spec--empty'}${isActive ? ' workspace__spec--editing' : ''}`}
        onClick={() => editSpecField(field)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') editSpecField(field)
        }}
        role="button"
        tabIndex={0}
      >
        <span>{label}</span>
        {isActive ? (
          <input
            autoFocus
            value={value}
            onChange={(event) => setSpecDraftValue(field, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void saveSpecEdits()
              if (event.key === 'Escape') setActiveSpecField(null)
            }}
          />
        ) : (
          <strong>{value || '—'}</strong>
        )}
      </div>
    )
  }

  return (
    <div className="admin-kit-shell workspace">
      {/* Sticky action bar */}
      <div className="workspace__actionbar">
        <div className="workspace__actionbar-info">
          <strong>{title}</strong>
          <StatusBadge
            tone={publishStatus === 'published' ? 'success' : publishStatus === 'needs_review' ? 'warning' : 'neutral'}
          >
            {PUBLISH_STATUS_LABELS[publishStatus]}
          </StatusBadge>
          <span className="workspace__completeness">
            <span className="workspace__completeness-bar">
              <span style={{ width: `${completeness}%` }} />
            </span>
            {completeness}% completo
          </span>
        </div>
        <div className="workspace__actionbar-buttons">
          <ActionButton href={`/admin/collections/vehicles/${id}`} variant="secondary">
            Editar campos
          </ActionButton>
          <ActionButton variant="secondary" disabled={busy} onClick={() => void setStatus('draft')}>
            Guardar borrador
          </ActionButton>
          <ActionButton variant="secondary" disabled={busy} onClick={() => void setStatus('needs_review')}>
            Enviar a revisión
          </ActionButton>
          <ActionButton
            variant="primary"
            disabled={busy || issues.critical.length > 0}
            onClick={() => void setStatus('published', { guard: true })}
          >
            Publicar
          </ActionButton>
        </div>
      </div>

      {error ? <div className="builder__error">{error}</div> : null}
      {notice ? <div className="workspace__notice">{notice}</div> : null}

      {/* Tabs */}
      <div className="workspace__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`workspace__tab${tab === t.key ? ' workspace__tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'review' && issues.critical.length > 0 ? (
              <span className="workspace__tab-badge">{issues.critical.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="workspace__body">
        {tab === 'overview' ? (
          <div className="workspace__grid">
            <div>
              <VehicleSummaryCard
                imageUrl={mediaUrl(vehicle.image ?? null)}
                title={title}
                subtitle={`${vehicle.condition === 'used' ? 'Seminuevo' : vehicle.condition === 'new' ? 'Nuevo' : '—'} · ${
                  vehicle.city || 'Sin ciudad'
                }`}
                badge={<StatusBadge tone="info">{vehicle.price || 'Precio a consultar'}</StatusBadge>}
              />
              <dl className="workspace__facts">
                <div>
                  <dt>Agencia</dt>
                  <dd>
                    {typeof vehicle.dealership === 'object' && vehicle.dealership
                      ? vehicle.dealership.name || '—'
                      : vehicle.sourceDealerName || '—'}
                  </dd>
                </div>
                <div>
                  <dt>Kilometraje</dt>
                  <dd>{vehicle.mileage ? `${vehicle.mileage} km` : '—'}</dd>
                </div>
                <div>
                  <dt>Slug</dt>
                  <dd>{vehicle.slug || '—'}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3>Lista de completitud</h3>
              <CompletionChecklist items={checklist} />
              <p className="builder__muted">{vehicle.description || 'Sin descripción.'}</p>
            </div>
          </div>
        ) : null}

        {tab === 'specs' ? (
          <div>
            <div className="workspace__section-head">
              <h3>Especificaciones</h3>
              <StatusBadge tone="info">{SPEC_STATUS_LABELS[(vehicle.specStatus as SpecStatus) || 'missing']}</StatusBadge>
            </div>
            <div className="workspace__specs workspace__specs--inline">
              {renderSpecCard('exteriorColor', 'Color exterior')}
              {renderSpecCard('interiorColor', 'Color interior')}
              {SPEC_KEYS.map((key) => renderSpecCard(key, SPEC_LABELS[key] || key))}
            </div>
            <div className="workspace__spec-editor-actions workspace__spec-editor-actions--inline">
              <button
                type="button"
                className="admin-kit-btn admin-kit-btn--primary"
                disabled={specSaving || !specDraft}
                onClick={() => void saveSpecEdits()}
              >
                {specSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="admin-kit-btn admin-kit-btn--secondary"
                disabled={specSaving}
                onClick={() => void generateInternalTags()}
              >
                Generar tags internos
              </button>
              <ActionButton href={`/admin/collections/vehicles/${id}`} variant="secondary">
                Editar campos completos
              </ActionButton>
            </div>
            <div className="workspace__specs workspace__specs--legacy">
              <button
                type="button"
                className={`workspace__spec workspace__spec-button${vehicle.exteriorColor ? '' : ' workspace__spec--empty'}`}
                onClick={openSpecEditor}
              >
                <span>Color exterior</span>
                <strong>{vehicle.exteriorColor || '—'}</strong>
              </button>
              <button
                type="button"
                className={`workspace__spec workspace__spec-button${vehicle.interiorColor ? '' : ' workspace__spec--empty'}`}
                onClick={openSpecEditor}
              >
                <span>Color interior</span>
                <strong>{vehicle.interiorColor || '—'}</strong>
              </button>
              {SPEC_KEYS.map((key) => {
                const value = vehicle.specs?.[key]
                return (
                  <button
                    key={key}
                    type="button"
                    className={`workspace__spec workspace__spec-button${value ? '' : ' workspace__spec--empty'}`}
                    onClick={openSpecEditor}
                  >
                    <span>{SPEC_LABELS[key] || key}</span>
                    <strong>{value ? String(value) : '—'}</strong>
                  </button>
                )
              })}
            </div>
            {specEditorOpen && specDraft ? (
              <div className="workspace__spec-editor">
                <div className="workspace__section-head">
                  <h3>Editar especificaciones</h3>
                  <button type="button" className="admin-kit-btn admin-kit-btn--secondary" onClick={() => setSpecEditorOpen(false)}>
                    Cerrar
                  </button>
                </div>
                <div className="workspace__spec-editor-grid">
                  <label className="builder__field">
                    <span>Color exterior</span>
                    <input
                      value={specDraft.exteriorColor}
                      onChange={(event) => setSpecDraft((draft) => draft && { ...draft, exteriorColor: event.target.value })}
                    />
                  </label>
                  <label className="builder__field">
                    <span>Color interior</span>
                    <input
                      value={specDraft.interiorColor}
                      onChange={(event) => setSpecDraft((draft) => draft && { ...draft, interiorColor: event.target.value })}
                    />
                  </label>
                  <label className="builder__field">
                    <span>Tipo de carrocería</span>
                    <select
                      className="builder__select"
                      value={specDraft.bodyType}
                      onChange={(event) => setSpecDraft((draft) => draft && { ...draft, bodyType: event.target.value })}
                    >
                      <option value="">Sin definir</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="pickup">Pickup</option>
                      <option value="coupe">Coupe</option>
                      <option value="hatchback">Hatchback</option>
                      <option value="van">Van</option>
                      <option value="other">Otro</option>
                    </select>
                  </label>
                  <label className="builder__field">
                    <span>Transmisión comercial</span>
                    <select
                      className="builder__select"
                      value={specDraft.transmission}
                      onChange={(event) => setSpecDraft((draft) => draft && { ...draft, transmission: event.target.value })}
                    >
                      <option value="">Sin definir</option>
                      <option value="automatic">Automática</option>
                      <option value="manual">Manual</option>
                      <option value="cvt">CVT</option>
                    </select>
                  </label>
                  <label className="builder__field">
                    <span>Combustible comercial</span>
                    <select
                      className="builder__select"
                      value={specDraft.fuel}
                      onChange={(event) => setSpecDraft((draft) => draft && { ...draft, fuel: event.target.value })}
                    >
                      <option value="">Sin definir</option>
                      <option value="gasoline">Gasolina</option>
                      <option value="diesel">Diesel</option>
                      <option value="hybrid">Híbrido</option>
                      <option value="electric">Eléctrico</option>
                    </select>
                  </label>
                  {SPEC_KEYS.map((key) => (
                    <label key={key} className="builder__field">
                      <span>{SPEC_LABELS[key] || key}</span>
                      <input
                        value={specDraft.specs[key] || ''}
                        onChange={(event) =>
                          setSpecDraft((draft) =>
                            draft ? { ...draft, specs: { ...draft.specs, [key]: event.target.value } } : draft,
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="workspace__spec-editor-actions">
                  <button
                    type="button"
                    className="admin-kit-btn admin-kit-btn--primary"
                    disabled={specSaving}
                    onClick={() => void saveSpecEdits()}
                  >
                    {specSaving ? 'Guardando...' : 'Guardar especificaciones'}
                  </button>
                  <ActionButton href={`/admin/collections/vehicles/${id}`} variant="secondary">
                    Editar campos completos
                  </ActionButton>
                </div>
              </div>
            ) : (
              <ActionButton onClick={openSpecEditor} variant="secondary">
                Editar especificaciones
              </ActionButton>
            )}
          </div>
        ) : null}

        {tab === 'images' ? (
          <div>
            <div className="workspace__section-head">
              <h3>Imágenes</h3>
              <StatusBadge tone={vehicle.imageStatus === 'approved' ? 'success' : vehicle.imageStatus === 'missing' ? 'danger' : 'warning'}>
                {IMAGE_STATUS_LABELS[(vehicle.imageStatus as ImageStatus) || 'missing']}
              </StatusBadge>
            </div>
            <VehicleImageStudio vehicle={vehicle} onChanged={() => void load()} />
          </div>
        ) : null}

        {tab === 'listing' ? (
          <SectionBuilder
            title="Página del vehículo"
            subtitle="Agrega secciones de contenido bajo la ficha del vehículo."
            previewUrl={`${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}${vehicle.slug ? `/cars/${vehicle.slug}` : ''}`}
            library={VEHICLE_SECTION_LIBRARY}
            load={loadSections}
            save={saveSections}
            deepEditHref={`/admin/collections/vehicles/${id}`}
          />
        ) : null}

        {tab === 'review' ? (
          <div className="workspace__review">
            <div>
              <h3>Problemas críticos</h3>
              {issues.critical.length === 0 ? (
                <p className="workspace__ok">✓ Sin bloqueos. Este vehículo se puede publicar.</p>
              ) : (
                <ul className="workspace__issues workspace__issues--critical">
                  {issues.critical.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Advertencias</h3>
              {issues.warnings.length === 0 ? (
                <p className="builder__muted">Sin advertencias.</p>
              ) : (
                <ul className="workspace__issues workspace__issues--warning">
                  {issues.warnings.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
            <ActionButton
              variant="primary"
              disabled={busy || issues.critical.length > 0}
              onClick={() => void setStatus('published', { guard: true })}
            >
              Publicar vehículo
            </ActionButton>
          </div>
        ) : null}

        {tab === 'activity' ? (
          <ul className="workspace__timeline">
            <li>
              <strong>Creado</strong>
              <span>{formatDate(vehicle.createdAt)}</span>
            </li>
            <li>
              <strong>Última actualización</strong>
              <span>{formatDate(vehicle.updatedAt)}</span>
            </li>
            <li>
              <strong>Última revisión</strong>
              <span>{formatDate(vehicle.lastReviewedAt)}</span>
            </li>
            <li>
              <strong>Publicado</strong>
              <span>{formatDate(vehicle.publishedAt)}</span>
            </li>
            {vehicle.sourceImportId ? (
              <li>
                <strong>Importado en lote</strong>
                <span>Trabajo #{vehicle.sourceImportId}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
