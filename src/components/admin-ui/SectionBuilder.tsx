'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  ActionButton,
  AdminPageHeader,
  AdminPageShell,
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
  controls?: FieldControl[]
}

export type RelationshipOption = {
  id: string | number
  label: string
  slug?: string
  thumbnailURL?: string
  url?: string
}

export type BuilderPreviewContext = {
  hiddenIndexes: Set<number>
  mediaOptions: RelationshipOption[]
}

type SelectOption = {
  label: string
  value: string
}

type ScalarControl = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'media'
  options?: SelectOption[]
  defaultValue?: unknown
}

type ArrayControl = {
  key: string
  label: string
  type: 'array'
  itemLabel?: string
  addLabel?: string
  fields: ScalarControl[]
  advancedNote?: string
}

export type FieldControl = ScalarControl | ArrayControl

export type SectionBuilderProps = {
  title: string
  subtitle?: string
  previewUrl: string
  previewOrigin?: string
  library: LibraryEntry[]
  load: () => Promise<{ sections: Section[] }>
  save: (sections: Section[]) => Promise<void>
  deepEditHref?: string
  autoSave?: boolean
  saveLabel?: string
  savedLabel?: string
  /** Optional extra panel rendered above the section list (e.g. SEO, template controls). */
  asideTop?: React.ReactNode
  /** Optional settings panel rendered in a drawer from the builder toolbar. */
  settingsPanel?: React.ReactNode
  settingsLabel?: string
  /** Optional callback invoked after a successful save (e.g. reload preview). */
  onSaved?: () => void
  /** Optional actions rendered inside the preview toolbar. */
  previewActions?: React.ReactNode
  /** Optional payload sent to an iframe that supports Payload live preview messages. */
  previewPayload?: (sections: Section[], context: BuilderPreviewContext) => unknown
  previewCollectionSlug?: string
  /** Optional inline preview renderer for admin surfaces where iframe preview is not reliable. */
  renderPreview?: (sections: Section[], context: BuilderPreviewContext) => React.ReactNode
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
  ctaLabel: 'Texto de CTA',
  ctaHref: 'URL de CTA',
  href: 'URL',
  imageAlt: 'Texto alternativo',
  layout: 'Diseno',
  variant: 'Variante',
  theme: 'Tema',
}

const COMPLEX_KEYS_NOTE: Record<string, string> = {
  media: 'Imagen',
  image: 'Imagen',
  images: 'Galería de imágenes',
  items: 'Lista de elementos',
  vehicles: 'Vehículos seleccionados',
  collection: 'Coleccion de inventario',
  mobileImage: 'Imagen movil',
  thumbnail: 'Miniatura',
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
  const heading =
    typeof section.heading === 'string' && section.heading.trim() ? section.heading.trim() : null
  return heading ? `${base} · ${heading}` : base
}

function cloneSection(section: Section): Section {
  const copy = JSON.parse(JSON.stringify(section)) as Section
  delete copy.id
  return copy
}

function relationshipId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    return id === undefined ? '' : String(id)
  }
  return ''
}

function relationshipPayloadValue(value: string): string | number | null {
  if (!value) return null
  return /^\d+$/.test(value) ? Number(value) : value
}

function defaultControlValue(control: ScalarControl): unknown {
  if (control.defaultValue !== undefined) return control.defaultValue
  if (control.type === 'checkbox') return false
  if (control.type === 'number') return null
  return ''
}

function normalizeArrayItems(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
      )
    : []
}

function createArrayItem(control: ArrayControl): Record<string, unknown> {
  return control.fields.reduce<Record<string, unknown>>((item, field) => {
    item[field.key] = defaultControlValue(field)
    return item
  }, {})
}

export function SectionBuilder({
  title,
  subtitle,
  previewUrl,
  previewOrigin,
  library,
  load,
  save,
  deepEditHref,
  autoSave = false,
  saveLabel = 'Guardar cambios',
  savedLabel = 'Guardado',
  asideTop,
  settingsPanel,
  settingsLabel = 'Plantilla',
  onSaved,
  previewActions,
  previewPayload,
  previewCollectionSlug = 'pages',
  renderPreview,
}: SectionBuilderProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'editing' | 'saving' | 'saved' | 'error'>('idle')
  const [showLibrary, setShowLibrary] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [collectionOptions, setCollectionOptions] = useState<RelationshipOption[]>([])
  const [mediaOptions, setMediaOptions] = useState<RelationshipOption[]>([])
  const revisionRef = useRef(0)
  const failedSaveSignatureRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await load()
      setSections(result.sections || [])
      setDirty(false)
      setSaveState('saved')
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
    revisionRef.current += 1
    failedSaveSignatureRef.current = null
    setSections(next)
    setDirty(true)
    setSaveState('editing')
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
      const updated = sections.map((section, i) =>
        i === index ? { ...section, [key]: value } : section,
      )
      mutate(updated)
    },
    [sections, mutate],
  )

  const handleSave = useCallback(async (options?: { force?: boolean }) => {
    const saveRevision = revisionRef.current
    const signature = JSON.stringify(sections)
    if (!options?.force && failedSaveSignatureRef.current === signature) return

    setSaving(true)
    setSaveState('saving')
    setError(null)
    try {
      await save(sections)
      failedSaveSignatureRef.current = null
      if (revisionRef.current === saveRevision) {
        setDirty(false)
        setSaveState('saved')
      } else {
        setDirty(true)
        setSaveState('editing')
      }
      if (!renderPreview && !previewPayload) setPreviewKey((key) => key + 1)
      onSaved?.()
    } catch (err) {
      failedSaveSignatureRef.current = signature
      setSaveState('error')
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }, [sections, save, onSaved, previewPayload, renderPreview])

  useEffect(() => {
    if (!autoSave || loading || !dirty || saving) return
    const timer = window.setTimeout(() => {
      void handleSave()
    }, 850)
    return () => window.clearTimeout(timer)
  }, [autoSave, dirty, handleSave, loading, saving])

  const selectedSection = selected !== null ? sections[selected] : null

  useEffect(() => {
    if (selectedSection?.blockType !== 'inventoryCollection' || collectionOptions.length > 0) return

    let cancelled = false
    async function loadCollections() {
      try {
        const response = await fetch('/api/vehicle-collections?limit=100&depth=0&sort=name', {
          credentials: 'include',
        })
        if (!response.ok) return
        const data = (await response.json()) as {
          docs?: Array<{ id: string | number; name?: string; slug?: string }>
        }
        if (cancelled) return
        setCollectionOptions(
          (data.docs || []).map((item) => ({
            id: item.id,
            label: item.name || item.slug || String(item.id),
            slug: item.slug,
          })),
        )
      } catch {
        // The visual builder remains usable; detailed Payload edit can still set the relationship.
      }
    }

    void loadCollections()
    return () => {
      cancelled = true
    }
  }, [collectionOptions.length, selectedSection?.blockType])

  const editableEntries = useMemo(() => {
    if (!selectedSection) return [] as Array<[string, unknown]>
    const entry = library.find((item) => item.blockType === selectedSection.blockType)
    const keys = new Set<string>(Object.keys(entry?.defaults || {}))
    Object.keys(selectedSection).forEach((key) => {
      if (key !== 'id' && key !== 'blockType') keys.add(key)
    })
    return Array.from(keys).map((key) => [key, selectedSection[key]] as [string, unknown])
  }, [selectedSection, library])

  const selectedLibraryEntry = selectedSection
    ? library.find((item) => item.blockType === selectedSection.blockType)
    : null
  const controlledKeys = new Set(
    (selectedLibraryEntry?.controls || []).map((control) => control.key),
  )
  const selectedUsesMedia = Boolean(
    selectedLibraryEntry?.controls?.some((control) =>
      control.type === 'media' ||
      (control.type === 'array' && control.fields.some((field) => field.type === 'media')),
    ),
  )
  const libraryUsesMedia = useMemo(
    () =>
      library.some((entry) =>
        entry.controls?.some(
          (control) =>
            control.type === 'media' ||
            (control.type === 'array' && control.fields.some((field) => field.type === 'media')),
        ),
      ),
    [library],
  )
  const shouldLoadMediaOptions =
    selectedUsesMedia || Boolean((renderPreview || previewPayload) && libraryUsesMedia)

  const previewContext = useMemo<BuilderPreviewContext>(
    () => ({ hiddenIndexes: hidden, mediaOptions }),
    [hidden, mediaOptions],
  )
  const livePreviewPayload = useMemo(
    () => (previewPayload ? previewPayload(sections, previewContext) : null),
    [previewContext, previewPayload, sections],
  )

  useEffect(() => {
    if (!shouldLoadMediaOptions || mediaOptions.length > 0) return
    let cancelled = false
    async function loadMedia() {
      try {
        const response = await fetch('/api/media?limit=100&depth=0&sort=-updatedAt', {
          credentials: 'include',
        })
        if (!response.ok) return
        const data = (await response.json()) as {
          docs?: Array<{
            id: string | number
            alt?: string
            filename?: string
            thumbnailURL?: string
            url?: string
          }>
        }
        if (cancelled) return
        setMediaOptions(
          (data.docs || []).map((item) => ({
            id: item.id,
            label: item.alt || item.filename || item.url || String(item.id),
            thumbnailURL: item.thumbnailURL,
            url: item.url,
          })),
        )
      } catch {
        // Detailed Payload edit remains available for older media edge cases.
      }
    }
    void loadMedia()
    return () => {
      cancelled = true
    }
  }, [mediaOptions.length, shouldLoadMediaOptions])

  return (
    <AdminPageShell className="builder">
      <AdminPageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="builder__toolbar">
            <span className={`builder__save-status builder__save-status--${saveState}`}>
              {saveState === 'saving'
                ? 'Guardando borrador...'
                : saveState === 'editing'
                  ? 'Editando'
                  : saveState === 'error'
                    ? 'Error al guardar'
                    : 'Borrador guardado'}
            </span>
            {settingsPanel ? (
              <ActionButton onClick={() => setSettingsOpen(true)} variant="secondary">
                {settingsLabel}
              </ActionButton>
            ) : null}
            {deepEditHref ? (
              <ActionButton href={deepEditHref} variant="secondary">
                Edicion a detalle
              </ActionButton>
            ) : null}
            <ActionButton
              onClick={() => void handleSave({ force: true })}
              variant="primary"
              disabled={!dirty || saving}
            >
              {saving ? 'Guardando...' : dirty ? saveLabel : savedLabel}
            </ActionButton>
          </div>
        }
      />

      {error ? <div className="builder__error">{error}</div> : null}
      {settingsOpen && settingsPanel ? (
        <div className="builder-settings-drawer" role="dialog" aria-modal="true" aria-label={settingsLabel}>
          <button className="builder-settings-drawer__backdrop" type="button" onClick={() => setSettingsOpen(false)} />
          <aside className="builder-settings-drawer__panel">
            <div className="builder-settings-drawer__head">
              <div>
                <p>Configuracion de plantilla</p>
                <h3>{settingsLabel}</h3>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Cerrar">
                x
              </button>
            </div>
            <div className="builder-settings-drawer__body">{settingsPanel}</div>
          </aside>
        </div>
      ) : null}

      <div className="builder__grid">
        {/* Column 1: section list and library */}
        <div className="builder__col builder__col--list">
          {asideTop}
          <div className="builder__col-head">
            <strong>Secciones</strong>
            <ActionButton onClick={() => setShowLibrary((v) => !v)} variant="primary">
              + Agregar seccion
            </ActionButton>
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
            <p className="builder__muted">Cargando...</p>
          ) : sections.length === 0 ? (
            <EmptyState
              title="Sin secciones"
              message="Agrega la primera seccion desde la biblioteca."
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
                  <button
                    className="builder__section-main"
                    type="button"
                    onClick={() => setSelected(index)}
                  >
                    <span className="builder__section-name">{sectionTitle(section, library)}</span>
                    {hidden.has(index) ? <StatusBadge tone="neutral">Oculta</StatusBadge> : null}
                  </button>
                  <div className="builder__section-tools">
                    <button
                      type="button"
                      title="Subir"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
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
                    <button
                      type="button"
                      title="Mostrar / ocultar"
                      onClick={() => toggleHidden(index)}
                    >
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

        {/* Column 2: live preview */}
        <div className="builder__col builder__col--preview">
          {renderPreview ? (
            <div className={`admin-kit-preview admin-kit-preview--${device}`}>
              <div className="admin-kit-preview__bar">
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
                  Movil
                </button>
                <span className="builder__preview-hint">
                  {saveState === 'saving'
                    ? 'Actualizando vista previa...'
                    : saveState === 'editing'
                      ? 'Guardando borrador automaticamente'
                      : 'Vista previa del sitio publico'}
                </span>
                {previewActions ? <span className="builder__preview-actions">{previewActions}</span> : null}
              </div>
              <div className="admin-kit-preview__viewport">
                <div
                  className="admin-kit-preview__inline"
                  style={{
                    margin: device === 'mobile' ? '0 auto' : undefined,
                    width: device === 'mobile' ? 390 : '100%',
                  }}
                >
                  {renderPreview(sections, previewContext)}
                </div>
              </div>
            </div>
          ) : previewPayload ? (
            <BuilderLivePreviewFrame
              collectionSlug={previewCollectionSlug}
              device={device}
              height={720}
              payload={livePreviewPayload}
              targetOrigin={previewOrigin}
              url={previewUrl}
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
                    Movil
                  </button>
                  <span className="builder__preview-hint">
                    {saveState === 'saving'
                      ? 'Guardando borrador...'
                      : saveState === 'editing'
                        ? 'Vista previa en vivo'
                        : 'Vista previa del sitio publico'}
                  </span>
                  {previewActions ? <span className="builder__preview-actions">{previewActions}</span> : null}
                </>
              }
            />
          ) : (
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
                  Movil
                </button>
                <span className="builder__preview-hint">
                  {saveState === 'saving'
                    ? 'Actualizando vista previa...'
                    : saveState === 'editing'
                      ? 'Guardando borrador automaticamente'
                      : 'Vista previa del sitio publico'}
                </span>
                {previewActions ? <span className="builder__preview-actions">{previewActions}</span> : null}
              </>
            }
          />
          )}
        </div>

        {/* Column 3: inspector */}
        <div className="builder__col builder__col--inspector">
          {selectedSection ? (
            <InspectorPanel title={sectionTitle(selectedSection, library)}>
              <p className="builder__muted">
                Bloque: <code>{selectedSection.blockType}</code>
              </p>

              {selectedSection.blockType === 'inventoryCollection' ? (
                <InventoryCollectionInspector
                  section={selectedSection}
                  index={selected as number}
                  collectionOptions={collectionOptions}
                  updateField={updateField}
                />
              ) : null}

              <label className="builder__field">
                <span>Nombre interno</span>
                <input
                  type="text"
                  value={
                    typeof selectedSection.blockName === 'string' ? selectedSection.blockName : ''
                  }
                  onChange={(e) => updateField(selected as number, 'blockName', e.target.value)}
                  placeholder="Etiqueta para identificar esta seccion"
                />
              </label>

              {selectedLibraryEntry?.controls?.map((control) => (
                <ConfiguredFieldControl
                  key={control.key}
                  control={control}
                  section={selectedSection}
                  index={selected as number}
                  mediaOptions={mediaOptions}
                  updateField={updateField}
                />
              ))}

              {editableEntries.map(([key, value]) => {
                if (key === 'blockName' || key === 'blockType' || key === 'id') return null
                if (controlledKeys.has(key)) return null
                if (
                  selectedSection.blockType === 'inventoryCollection' &&
                  (key === 'collection' || key === 'layout' || key === 'display')
                ) {
                  return null
                }
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
                        onChange={(e) =>
                          updateField(
                            idx,
                            key,
                            e.target.value === '' ? null : Number(e.target.value),
                          )
                        }
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
                        <textarea
                          rows={3}
                          value={str}
                          onChange={(e) => updateField(idx, key, e.target.value)}
                        />
                      ) : (
                        <input
                          type="text"
                          value={str}
                          onChange={(e) => updateField(idx, key, e.target.value)}
                        />
                      )}
                    </label>
                  )
                }
                // Complex field — keep data, point to detail edit.
                return (
                  <div key={key} className="builder__field builder__field--complex">
                    <span>{COMPLEX_KEYS_NOTE[key] || fieldLabel(key)}</span>
                    <small>
                      {Array.isArray(value) ? `${value.length} elemento(s)` : 'Contenido avanzado'}{' '}
                      — edítalo en detalle.
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
              <p className="builder__muted">Selecciona una seccion para editar sus campos.</p>
            </InspectorPanel>
          )}
        </div>
      </div>
    </AdminPageShell>
  )
}

function originFromUrl(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return '*'
  }
}

function BuilderLivePreviewFrame({
  collectionSlug,
  device,
  height,
  payload,
  targetOrigin,
  toolbar,
  url,
}: {
  collectionSlug: string
  device: 'desktop' | 'mobile'
  height: number
  payload: unknown
  targetOrigin?: string
  toolbar?: React.ReactNode
  url: string
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [connected, setConnected] = useState(false)
  const origin = targetOrigin || originFromUrl(url)
  const width = device === 'mobile' ? 390 : '100%'

  const postPreview = useCallback(() => {
    const target = iframeRef.current?.contentWindow
    if (!target || !payload) return
    target.postMessage(
      {
        collectionSlug,
        data: payload,
        type: 'payload-live-preview',
      },
      origin,
    )
  }, [collectionSlug, origin, payload])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (origin !== '*' && event.origin !== origin) return
      const message = event.data as { ready?: boolean; type?: string } | null
      if (message?.type !== 'payload-live-preview' || !message.ready) return
      setConnected(true)
      window.setTimeout(postPreview, 0)
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [origin, postPreview])

  useEffect(() => {
    const timers = [0, 175, 500, 950].map((delay) => window.setTimeout(postPreview, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [postPreview, reloadKey])

  return (
    <div className={`admin-kit-preview admin-kit-preview--${device}`}>
      <div className="admin-kit-preview__bar">
        {toolbar}
        <span
          className={`builder__preview-live${connected ? ' builder__preview-live--connected' : ''}`}
        >
          {connected ? 'Vista conectada' : 'Esperando frontend'}
        </span>
        <button
          className="builder__preview-reload"
          type="button"
          onClick={() => {
            setConnected(false)
            setReloadKey((key) => key + 1)
          }}
        >
          Recargar
        </button>
      </div>
      <div className="admin-kit-preview__viewport">
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={url}
          style={{ height, width, margin: device === 'mobile' ? '0 auto' : undefined }}
          title="Vista previa"
          onLoad={() => {
            setConnected(false)
            window.setTimeout(postPreview, 250)
          }}
        />
      </div>
    </div>
  )
}

export default SectionBuilder

function ConfiguredFieldControl({
  control,
  section,
  index,
  mediaOptions,
  updateField,
}: {
  control: FieldControl
  section: Section
  index: number
  mediaOptions: RelationshipOption[]
  updateField: (index: number, key: string, value: unknown) => void
}) {
  if (control.type === 'array') {
    return (
      <ArrayFieldControl
        control={control}
        items={normalizeArrayItems(section[control.key])}
        mediaOptions={mediaOptions}
        onChange={(items) => updateField(index, control.key, items)}
      />
    )
  }

  return (
    <ScalarFieldControl
      control={control}
      mediaOptions={mediaOptions}
      value={section[control.key]}
      onChange={(value) => updateField(index, control.key, value)}
    />
  )
}

function ScalarFieldControl({
  control,
  mediaOptions = [],
  value,
  onChange,
}: {
  control: ScalarControl
  mediaOptions?: RelationshipOption[]
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (control.type === 'checkbox') {
    return (
      <label className="builder__field builder__field--check">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{control.label}</span>
      </label>
    )
  }

  if (control.type === 'select') {
    const str = typeof value === 'string' ? value : String(control.defaultValue ?? '')
    return (
      <label className="builder__field">
        <span>{control.label}</span>
        <select value={str} onChange={(event) => onChange(event.target.value)}>
          {(control.options || []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (control.type === 'number') {
    const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : ''
    return (
      <label className="builder__field">
        <span>{control.label}</span>
        <input
          type="number"
          value={numberValue}
          onChange={(event) =>
            onChange(event.target.value === '' ? null : Number(event.target.value))
          }
        />
      </label>
    )
  }

  if (control.type === 'media') {
    return (
      <label className="builder__field">
        <span>{control.label}</span>
        <select
          value={relationshipId(value)}
          onChange={(event) => onChange(relationshipPayloadValue(event.target.value))}
        >
          <option value="">Sin imagen</option>
          {mediaOptions.map((option) => (
            <option key={option.id} value={String(option.id)}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  const str = typeof value === 'string' ? value : ''
  return (
    <label className="builder__field">
      <span>{control.label}</span>
      {control.type === 'textarea' ? (
        <textarea rows={3} value={str} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input type="text" value={str} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  )
}

function ArrayFieldControl({
  control,
  items,
  mediaOptions,
  onChange,
}: {
  control: ArrayControl
  items: Record<string, unknown>[]
  mediaOptions: RelationshipOption[]
  onChange: (items: Record<string, unknown>[]) => void
}) {
  function updateItem(itemIndex: number, key: string, value: unknown) {
    onChange(items.map((item, index) => (index === itemIndex ? { ...item, [key]: value } : item)))
  }

  return (
    <div className="builder__field builder__field--complex">
      <span>{control.label}</span>
      {items.length === 0 ? <small>Sin elementos todavia.</small> : null}
      <div className="builder__array-list">
        {items.map((item, itemIndex) => (
          <div key={String(item.id || itemIndex)} className="builder__array-item">
            <div className="builder__array-head">
              <strong>
                {control.itemLabel || 'Elemento'} {itemIndex + 1}
              </strong>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, index) => index !== itemIndex))}
              >
                Eliminar
              </button>
            </div>
            {control.fields.map((field) => (
              <ScalarFieldControl
                key={field.key}
                control={field}
                mediaOptions={mediaOptions}
                value={item[field.key]}
                onChange={(value) => updateItem(itemIndex, field.key, value)}
              />
            ))}
          </div>
        ))}
      </div>
      {control.advancedNote ? <small>{control.advancedNote}</small> : null}
      <ActionButton
        onClick={() => onChange([...items, createArrayItem(control)])}
        variant="secondary"
      >
        {control.addLabel || 'Agregar'}
      </ActionButton>
    </div>
  )
}

function InventoryCollectionInspector({
  section,
  index,
  collectionOptions,
  updateField,
}: {
  section: Section
  index: number
  collectionOptions: RelationshipOption[]
  updateField: (index: number, key: string, value: unknown) => void
}) {
  const display =
    section.display && typeof section.display === 'object'
      ? (section.display as Record<string, boolean | undefined>)
      : {}

  function updateDisplay(key: string, value: boolean) {
    updateField(index, 'display', { ...display, [key]: value })
  }

  return (
    <div className="builder__inspector-group">
      <label className="builder__field">
        <span>Coleccion de inventario</span>
        <select
          value={relationshipId(section.collection)}
          onChange={(event) => updateField(index, 'collection', event.target.value || null)}
        >
          <option value="">Selecciona una coleccion</option>
          {collectionOptions.map((option) => (
            <option key={option.id} value={String(option.id)}>
              {option.label}
              {option.slug ? ` (${option.slug})` : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="builder__field">
        <span>Diseno</span>
        <select
          value={typeof section.layout === 'string' ? section.layout : 'grid'}
          onChange={(event) => updateField(index, 'layout', event.target.value)}
        >
          <option value="grid">Cuadricula</option>
          <option value="carousel">Carrusel</option>
          <option value="featuredSplit">Destacado dividido</option>
        </select>
      </label>

      <div className="builder__field builder__field--complex">
        <span>Datos visibles</span>
        {[
          ['showPrice', 'Precio'],
          ['showMileage', 'Kilometraje'],
          ['showCity', 'Ciudad'],
          ['showTags', 'Tags'],
        ].map(([key, label]) => (
          <label key={key} className="builder__field builder__field--check">
            <input
              type="checkbox"
              checked={display[key] ?? true}
              onChange={(event) => updateDisplay(key, event.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
