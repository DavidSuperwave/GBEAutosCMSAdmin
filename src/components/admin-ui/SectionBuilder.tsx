'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
  ActionButton,
  AdminPageHeader,
  EmptyState,
  InspectorPanel,
  PreviewFrame,
  SectionLibraryCard,
  StatusBadge,
} from './kit'

/**
 * Shared visual Section Builder (Phase 5).
 *
 * A generic 3-column editor (section list | live preview | inspector) used by
 * the Homepage, Landing Page and Vehicle Listing builders. It operates on a
 * Payload `blocks` array (the underlying block data is preserved) and persists
 * the whole array back through the REST API supplied by the parent via `save`.
 *
 * The raw Payload block UX is hidden behind this UI; complex fields (uploads,
 * relationships, nested arrays) keep their data and can be edited in detail via
 * the `deepEditHref` link, while scalar fields are editable inline.
 */

export type Section = {
  id?: string
  blockType: string
  blockName?: string
  [key: string]: unknown
}

export type LibraryEntry = {
  blockType: string
  label: string
  description: string
  defaults?: Record<string, unknown>
}

export type SectionBuilderProps = {
  title: string
  subtitle?: string
  previewUrl: string
  library: LibraryEntry[]
  load: () => Promise<{ sections: Section[] }>
  save: (sections: Section[]) => Promise<void>
  deepEditHref?: string
  /** Optional extra panel rendered above the section list (e.g. SEO, template controls). */
  asideTop?: React.ReactNode
  /** Optional callback invoked after a successful save (e.g. reload preview). */
  onSaved?: () => void
}

const FRIENDLY_FIELD_LABELS: Record<string, string> = {
  eyebrow: 'Etiqueta',
  heading: 'Título',
  body: 'Texto',
  limit: 'Máximo de resultados',
  city: 'Ciudad',
  brand: 'Marca',
  videoUrl: 'Video URL',
  showMap: 'Mostrar mapa',
  buttonLabel: 'Texto del botón',
  alt: 'Texto alternativo',
}

const COMPLEX_KEYS_NOTE: Record<string, string> = {
  media: 'Imagen',
  image: 'Imagen',
  images: 'Galería de imágenes',
  items: 'Lista de elementos',
  vehicles: 'Vehículos seleccionados',
  primaryLink: 'Botón principal',
  secondaryLink: 'Botón secundario',
  link: 'Enlace',
  display: 'Datos visibles',
  gallery: 'Galería',
}

function fieldLabel(key: string): string {
  return FRIENDLY_FIELD_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1)
}

function sectionTitle(section: Section, library: LibraryEntry[]): string {
  const entry = library.find((item) => item.blockType === section.blockType)
  const base = entry?.label || section.blockType
  const heading = typeof section.heading === 'string' && section.heading.trim() ? section.heading.trim() : null
  return heading ? `${base} · ${heading}` : base
}

function cloneSection(section: Section): Section {
  const copy = JSON.parse(JSON.stringify(section)) as Section
  delete copy.id
  return copy
}

export function SectionBuilder({
  title,
  subtitle,
  previewUrl,
  library,
  load,
  save,
  deepEditHref,
  asideTop,
  onSaved,
}: SectionBuilderProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [hidden, setHidden] = useState<Set<number>>(new Set())

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await load()
      setSections(result.sections || [])
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el contenido.')
    } finally {
      setLoading(false)
    }
  }, [load])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mutate = useCallback((next: Section[]) => {
    setSections(next)
    setDirty(true)
  }, [])

  const addSection = useCallback(
    (entry: LibraryEntry) => {
      const next: Section = { blockType: entry.blockType, ...(entry.defaults || {}) }
      const updated = [...sections, next]
      mutate(updated)
      setSelected(updated.length - 1)
      setShowLibrary(false)
    },
    [sections, mutate],
  )

  const move = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction
      if (target < 0 || target >= sections.length) return
      const updated = [...sections]
      const [item] = updated.splice(index, 1)
      updated.splice(target, 0, item)
      mutate(updated)
      setSelected(target)
    },
    [sections, mutate],
  )

  const duplicate = useCallback(
    (index: number) => {
      const updated = [...sections]
      updated.splice(index + 1, 0, cloneSection(sections[index]))
      mutate(updated)
      setSelected(index + 1)
    },
    [sections, mutate],
  )

  const remove = useCallback(
    (index: number) => {
      const updated = sections.filter((_, i) => i !== index)
      mutate(updated)
      setSelected(null)
    },
    [sections, mutate],
  )

  const toggleHidden = useCallback((index: number) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const updateField = useCallback(
    (index: number, key: string, value: unknown) => {
      const updated = sections.map((section, i) => (i === index ? { ...section, [key]: value } : section))
      mutate(updated)
    },
    [sections, mutate],
  )

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await save(sections)
      setDirty(false)
      setPreviewKey((key) => key + 1)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }, [sections, save, onSaved])

  const selectedSection = selected !== null ? sections[selected] : null

  const editableEntries = useMemo(() => {
    if (!selectedSection) return [] as Array<[string, unknown]>
    const entry = library.find((item) => item.blockType === selectedSection.blockType)
    const keys = new Set<string>(Object.keys(entry?.defaults || {}))
    Object.keys(selectedSection).forEach((key) => {
      if (key !== 'id' && key !== 'blockType') keys.add(key)
    })
    return Array.from(keys).map((key) => [key, selectedSection[key]] as [string, unknown])
  }, [selectedSection, library])

  return (
    <div className="admin-kit-shell builder">
      <AdminPageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {deepEditHref ? (
              <ActionButton href={deepEditHref} variant="secondary">
                Edición a detalle
              </ActionButton>
            ) : null}
            <ActionButton onClick={() => void refresh()} variant="secondary" disabled={loading || saving}>
              Recargar
            </ActionButton>
            <ActionButton onClick={() => void handleSave()} variant="primary" disabled={!dirty || saving}>
              {saving ? 'Guardando…' : dirty ? 'Guardar y publicar' : 'Guardado'}
            </ActionButton>
          </>
        }
      />

      {error ? <div className="builder__error">{error}</div> : null}

      <div className="builder__grid">
        {/* Column 1 — section list + library */}
        <div className="builder__col builder__col--list">
          {asideTop}
          <div className="builder__col-head">
            <strong>Secciones</strong>
            <button className="admin-kit-btn admin-kit-btn--primary" type="button" onClick={() => setShowLibrary((v) => !v)}>
              + Agregar sección
            </button>
          </div>

          {showLibrary ? (
            <div className="builder__library">
              {library.map((entry) => (
                <SectionLibraryCard
                  key={entry.blockType}
                  name={entry.label}
                  description={entry.description}
                  onSelect={() => addSection(entry)}
                />
              ))}
            </div>
          ) : null}

          {loading ? (
            <p className="builder__muted">Cargando…</p>
          ) : sections.length === 0 ? (
            <EmptyState
              title="Sin secciones"
              message="Agrega la primera sección desde la biblioteca."
              action={
                <ActionButton variant="primary" onClick={() => setShowLibrary(true)}>
                  Abrir biblioteca
                </ActionButton>
              }
            />
          ) : (
            <ul className="builder__sections">
              {sections.map((section, index) => (
                <li
                  key={section.id ? String(section.id) : `new-${index}`}
                  className={`builder__section${selected === index ? ' builder__section--active' : ''}${
                    hidden.has(index) ? ' builder__section--hidden' : ''
                  }`}
                >
                  <button className="builder__section-main" type="button" onClick={() => setSelected(index)}>
                    <span className="builder__section-name">{sectionTitle(section, library)}</span>
                    {hidden.has(index) ? <StatusBadge tone="neutral">Oculta</StatusBadge> : null}
                  </button>
                  <div className="builder__section-tools">
                    <button type="button" title="Subir" onClick={() => move(index, -1)} disabled={index === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      title="Bajar"
                      onClick={() => move(index, 1)}
                      disabled={index === sections.length - 1}
                    >
                      ↓
                    </button>
                    <button type="button" title="Mostrar / ocultar" onClick={() => toggleHidden(index)}>
                      {hidden.has(index) ? '◌' : '◉'}
                    </button>
                    <button type="button" title="Duplicar" onClick={() => duplicate(index)}>
                      ⧉
                    </button>
                    <button type="button" title="Eliminar" onClick={() => remove(index)}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Column 2 — live preview */}
        <div className="builder__col builder__col--preview">
          <PreviewFrame
            key={previewKey}
            url={previewUrl}
            device={device}
            height={680}
            toolbar={
              <>
                <button
                  type="button"
                  className={device === 'desktop' ? 'is-active' : ''}
                  onClick={() => setDevice('desktop')}
                >
                  Escritorio
                </button>
                <button
                  type="button"
                  className={device === 'mobile' ? 'is-active' : ''}
                  onClick={() => setDevice('mobile')}
                >
                  Móvil
                </button>
                <span className="builder__preview-hint">
                  {dirty ? 'Guarda para ver los cambios en la vista previa' : 'Vista previa del sitio público'}
                </span>
              </>
            }
          />
        </div>

        {/* Column 3 — inspector */}
        <div className="builder__col builder__col--inspector">
          {selectedSection ? (
            <InspectorPanel title={sectionTitle(selectedSection, library)}>
              <p className="builder__muted">
                Bloque: <code>{selectedSection.blockType}</code>
              </p>
              <label className="builder__field">
                <span>Nombre interno</span>
                <input
                  type="text"
                  value={typeof selectedSection.blockName === 'string' ? selectedSection.blockName : ''}
                  onChange={(e) => updateField(selected as number, 'blockName', e.target.value)}
                  placeholder="Etiqueta para identificar esta sección"
                />
              </label>

              {editableEntries.map(([key, value]) => {
                if (key === 'blockName' || key === 'blockType' || key === 'id') return null
                const idx = selected as number

                if (typeof value === 'boolean') {
                  return (
                    <label key={key} className="builder__field builder__field--check">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => updateField(idx, key, e.target.checked)}
                      />
                      <span>{fieldLabel(key)}</span>
                    </label>
                  )
                }
                if (typeof value === 'number') {
                  return (
                    <label key={key} className="builder__field">
                      <span>{fieldLabel(key)}</span>
                      <input
                        type="number"
                        value={Number.isFinite(value) ? value : ''}
                        onChange={(e) => updateField(idx, key, e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </label>
                  )
                }
                if (typeof value === 'string' || value === null || value === undefined) {
                  const str = typeof value === 'string' ? value : ''
                  const isLong = key === 'body' || key === 'description' || str.length > 60
                  return (
                    <label key={key} className="builder__field">
                      <span>{fieldLabel(key)}</span>
                      {isLong ? (
                        <textarea rows={3} value={str} onChange={(e) => updateField(idx, key, e.target.value)} />
                      ) : (
                        <input type="text" value={str} onChange={(e) => updateField(idx, key, e.target.value)} />
                      )}
                    </label>
                  )
                }
                // Complex field — keep data, point to detail edit.
                return (
                  <div key={key} className="builder__field builder__field--complex">
                    <span>{COMPLEX_KEYS_NOTE[key] || fieldLabel(key)}</span>
                    <small>
                      {Array.isArray(value) ? `${value.length} elemento(s)` : 'Contenido avanzado'} — edítalo en detalle.
                    </small>
                  </div>
                )
              })}

              {deepEditHref ? (
                <ActionButton href={deepEditHref} variant="secondary">
                  Editar campos avanzados
                </ActionButton>
              ) : null}
            </InspectorPanel>
          ) : (
            <InspectorPanel title="Inspector">
              <p className="builder__muted">Selecciona una sección para editar sus campos.</p>
            </InspectorPanel>
          )}
        </div>
      </div>
    </div>
  )
}

export default SectionBuilder
