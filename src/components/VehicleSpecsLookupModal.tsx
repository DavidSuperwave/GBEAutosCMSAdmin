'use client'

import { useEffect, useMemo, useState } from 'react'

import { ActionButton, AdminModalFrame, StatusBadge } from './admin-ui/kit'

export type VehicleSpecOption = {
  id?: string | number
  name?: string
  label?: string
  yearFrom?: number
  yearTo?: number
  trim?: string
  series?: string
  bodyType?: string
}

export type VehicleSpecsResponse = {
  specs?: Record<string, string>
  raw?: Record<string, unknown>
  source?: string
  external?: Record<string, string>
  lastSpecSyncAt?: string
}

export type AppliedVehicleSpecs = {
  brand?: string
  model?: string
  year?: string
  trim?: string
  bodyType?: string
  transmission?: string
  fuel?: string
  specs: Record<string, string>
  sourceMeta: {
    specSource: 'rapidapi'
    externalMakeId?: string
    externalModelId?: string
    externalGenerationId?: string
    externalTrimId?: string
    lastSpecSyncAt: string
  }
}

type Props = {
  defaultMake?: string
  defaultModel?: string
  defaultYear?: string
  isOpen: boolean
  onApply: (data: AppliedVehicleSpecs) => void
  onClose: () => void
}

const SPEC_PREVIEW_LIMIT = 8

function label(option: VehicleSpecOption): string {
  return String(
    option.name ||
      option.label ||
      option.trim ||
      option.series ||
      option.bodyType ||
      option.id ||
      '',
  ).trim()
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function filterOptions(options: VehicleSpecOption[], query: string): VehicleSpecOption[] {
  const needle = normalize(query)
  if (!needle) return options
  return options.filter((option) => normalize(label(option)).includes(needle))
}

function formatYears(option: VehicleSpecOption): string {
  if (!option.yearFrom && !option.yearTo) return ''
  if (option.yearFrom === option.yearTo) return String(option.yearFrom)
  return [option.yearFrom || '?', option.yearTo || 'presente'].join('-')
}

function normalizedBodyType(value: unknown): string {
  const text = normalize(String(value || ''))
  if (text.includes('sedan') || text.includes('saloon')) return 'sedan'
  if (text.includes('suv') || text.includes('crossover')) return 'suv'
  if (text.includes('pickup') || text.includes('truck')) return 'pickup'
  if (text.includes('coupe')) return 'coupe'
  if (text.includes('hatch')) return 'hatchback'
  if (text.includes('van')) return 'van'
  return ''
}

function normalizedTransmission(value: unknown): string {
  const text = normalize(String(value || ''))
  if (text.includes('cvt')) return 'cvt'
  if (text.includes('manual')) return 'manual'
  if (text.includes('auto')) return 'automatic'
  return ''
}

function normalizedFuel(value: unknown): string {
  const text = normalize(String(value || ''))
  if (text.includes('diesel')) return 'diesel'
  if (text.includes('hybrid') || text.includes('hibrid')) return 'hybrid'
  if (text.includes('electric')) return 'electric'
  if (text.includes('gas') || text.includes('petrol')) return 'gasoline'
  return ''
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`)
  return data as T
}

function SpecsOptionList({
  emptyLabel,
  items,
  onSelect,
  selectedId,
}: {
  emptyLabel: string
  items: VehicleSpecOption[]
  onSelect: (item: VehicleSpecOption) => void
  selectedId?: string
}) {
  if (!items.length) return <p className="vehicle-specs-modal__empty">{emptyLabel}</p>

  return (
    <div className="vehicle-specs-modal__results">
      {items.map((item) => {
        const itemId = String(item.id || '')
        return (
          <button
            className={selectedId === itemId ? 'is-selected' : undefined}
            disabled={!itemId}
            key={itemId || label(item)}
            onClick={() => onSelect(item)}
            type="button"
          >
            <span>{label(item)}</span>
            {formatYears(item) ? <small>{formatYears(item)}</small> : null}
          </button>
        )
      })}
    </div>
  )
}

export default function VehicleSpecsLookupModal({
  defaultMake,
  defaultModel,
  defaultYear,
  isOpen,
  onApply,
  onClose,
}: Props) {
  const [makeQuery, setMakeQuery] = useState(defaultMake || '')
  const [modelQuery, setModelQuery] = useState(defaultModel || '')
  const [generationQuery, setGenerationQuery] = useState(defaultYear || '')
  const [trimQuery, setTrimQuery] = useState('')
  const [makes, setMakes] = useState<VehicleSpecOption[]>([])
  const [models, setModels] = useState<VehicleSpecOption[]>([])
  const [generations, setGenerations] = useState<VehicleSpecOption[]>([])
  const [trims, setTrims] = useState<VehicleSpecOption[]>([])
  const [selectedMake, setSelectedMake] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedGeneration, setSelectedGeneration] = useState('')
  const [selectedTrim, setSelectedTrim] = useState('')
  const [preview, setPreview] = useState<VehicleSpecsResponse | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const filteredMakes = useMemo(() => filterOptions(makes, makeQuery), [makes, makeQuery])
  const filteredModels = useMemo(() => filterOptions(models, modelQuery), [models, modelQuery])
  const filteredGenerations = useMemo(
    () => filterOptions(generations, generationQuery),
    [generations, generationQuery],
  )
  const filteredTrims = useMemo(() => filterOptions(trims, trimQuery), [trims, trimQuery])

  async function loadMakes() {
    setBusy(true)
    setStatus('Cargando marcas...')
    try {
      const data = await getJSON<{ makes?: VehicleSpecOption[] }>(
        '/api/cms/vehicle-specs?action=makes',
      )
      setMakes(data.makes || [])
      setStatus(data.makes?.length ? 'Selecciona una marca.' : 'No se encontraron marcas.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudieron cargar las marcas.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setMakeQuery(defaultMake || '')
    setModelQuery(defaultModel || '')
    setGenerationQuery(defaultYear || '')
    if (!makes.length) void loadMakes()
  }, [defaultMake, defaultModel, defaultYear, isOpen])

  async function selectMake(item: VehicleSpecOption) {
    const makeId = String(item.id || '')
    if (!makeId) return
    setSelectedMake(makeId)
    setSelectedModel('')
    setSelectedGeneration('')
    setSelectedTrim('')
    setModels([])
    setGenerations([])
    setTrims([])
    setPreview(null)
    setMakeQuery(label(item))
    setModelQuery('')
    setGenerationQuery('')
    setTrimQuery('')
    setBusy(true)
    setStatus('Cargando modelos...')
    try {
      const data = await getJSON<{ models?: VehicleSpecOption[] }>(
        `/api/cms/vehicle-specs?action=models&makeId=${encodeURIComponent(makeId)}`,
      )
      setModels(data.models || [])
      setStatus(
        data.models?.length
          ? 'Selecciona un modelo.'
          : 'No se encontraron modelos para esta marca.',
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudieron cargar modelos.')
    } finally {
      setBusy(false)
    }
  }

  async function selectModel(item: VehicleSpecOption) {
    const modelId = String(item.id || '')
    if (!modelId) return
    setSelectedModel(modelId)
    setSelectedGeneration('')
    setSelectedTrim('')
    setGenerations([])
    setTrims([])
    setPreview(null)
    setModelQuery(label(item))
    setGenerationQuery('')
    setTrimQuery('')
    setBusy(true)
    setStatus('Cargando generaciones...')
    try {
      const data = await getJSON<{ generations?: VehicleSpecOption[] }>(
        `/api/cms/vehicle-specs?action=generations&modelId=${encodeURIComponent(modelId)}`,
      )
      setGenerations(data.generations || [])
      setStatus(
        data.generations?.length
          ? 'Selecciona generacion / ano.'
          : 'No se encontraron generaciones.',
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudieron cargar generaciones.')
    } finally {
      setBusy(false)
    }
  }

  async function selectGeneration(item: VehicleSpecOption) {
    const generationId = String(item.id || '')
    if (!generationId) return
    setSelectedGeneration(generationId)
    setSelectedTrim('')
    setTrims([])
    setPreview(null)
    setGenerationQuery([label(item), formatYears(item)].filter(Boolean).join(' '))
    setTrimQuery('')
    setBusy(true)
    setStatus('Cargando versiones...')
    try {
      const data = await getJSON<{ trims?: VehicleSpecOption[] }>(
        `/api/cms/vehicle-specs?action=trims&generationId=${encodeURIComponent(generationId)}`,
      )
      setTrims(data.trims || [])
      setStatus(
        data.trims?.length
          ? 'Selecciona version para aplicar specs.'
          : 'No se encontraron versiones.',
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudieron cargar versiones.')
    } finally {
      setBusy(false)
    }
  }

  async function selectTrim(item: VehicleSpecOption) {
    const trimId = String(item.id || '')
    if (!trimId) return
    setSelectedTrim(trimId)
    setPreview(null)
    setTrimQuery(label(item))
    setBusy(true)
    setStatus('Consultando especificaciones...')
    try {
      const data = await getJSON<VehicleSpecsResponse>(
        `/api/cms/vehicle-specs?action=trimSpecs&trimId=${encodeURIComponent(trimId)}`,
      )
      setPreview(data)
      setStatus('Specs listas. Revisa y aplica si coinciden con la unidad.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudieron consultar specs.')
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    if (!preview) return
    const selectedMakeName = label(makes.find((make) => String(make.id) === selectedMake) || {})
    const selectedModelName = label(
      models.find((model) => String(model.id) === selectedModel) || {},
    )
    const generation = generations.find((item) => String(item.id) === selectedGeneration)
    const raw = preview.raw || {}
    const specs = preview.specs || {}
    const trimText = String(
      raw.trim ||
        raw.series ||
        label(trims.find((item) => String(item.id) === selectedTrim) || {}) ||
        '',
    ).trim()

    onApply({
      brand: String(raw.make || selectedMakeName || defaultMake || '').trim(),
      model: [raw.model || selectedModelName || defaultModel, trimText]
        .filter(Boolean)
        .join(' ')
        .trim(),
      year: String(generation?.yearTo || generation?.yearFrom || defaultYear || '').trim(),
      trim: trimText,
      bodyType: normalizedBodyType(raw.bodyType || specs.tipo),
      transmission: normalizedTransmission(raw.transmission || specs.transmision),
      fuel: normalizedFuel(raw.engineType || specs.combustible),
      specs,
      sourceMeta: {
        specSource: 'rapidapi',
        externalMakeId: selectedMake,
        externalModelId: selectedModel,
        externalGenerationId: selectedGeneration,
        externalTrimId: selectedTrim,
        lastSpecSyncAt: preview.lastSpecSyncAt || new Date().toISOString(),
      },
    })
    onClose()
  }

  if (!isOpen) return null

  const previewSpecs = Object.entries(preview?.specs || {}).filter(([, value]) => value)

  return (
    <AdminModalFrame
      actions={
        <>
          <ActionButton onClick={onClose} variant="secondary">
            Cancelar
          </ActionButton>
          <ActionButton disabled={!preview || busy} onClick={apply} variant="primary">
            Aplicar specs
          </ActionButton>
        </>
      }
      eyebrow="Catalogo Car Specs"
      onClose={onClose}
      title="Buscar especificaciones"
    >
      <div className="vehicle-specs-modal">
        <div className="vehicle-specs-modal__status">
          <StatusBadge tone={preview ? 'success' : busy ? 'info' : 'neutral'}>
            {busy ? 'Consultando' : preview ? 'Listo' : 'Opcional'}
          </StatusBadge>
          {status ? <span>{status}</span> : null}
        </div>

        <div className="vehicle-specs-modal__steps">
          <section>
            <label className="builder__field">
              <span>Marca</span>
              <input
                onChange={(event) => setMakeQuery(event.target.value)}
                placeholder="Audi, Mazda, Nissan..."
                type="search"
                value={makeQuery}
              />
            </label>
            <SpecsOptionList
              emptyLabel={busy ? 'Cargando marcas...' : 'No hay marcas para mostrar.'}
              items={filteredMakes}
              onSelect={(item) => void selectMake(item)}
              selectedId={selectedMake}
            />
          </section>

          <section>
            <label className="builder__field">
              <span>Modelo</span>
              <input
                disabled={!selectedMake}
                onChange={(event) => setModelQuery(event.target.value)}
                placeholder="Selecciona una marca primero"
                type="search"
                value={modelQuery}
              />
            </label>
            <SpecsOptionList
              emptyLabel={selectedMake ? 'No hay modelos para mostrar.' : 'Selecciona una marca.'}
              items={selectedMake ? filteredModels : []}
              onSelect={(item) => void selectModel(item)}
              selectedId={selectedModel}
            />
          </section>

          <section>
            <label className="builder__field">
              <span>Generacion / ano</span>
              <input
                disabled={!selectedModel}
                onChange={(event) => setGenerationQuery(event.target.value)}
                placeholder="Selecciona un modelo primero"
                type="search"
                value={generationQuery}
              />
            </label>
            <SpecsOptionList
              emptyLabel={
                selectedModel ? 'No hay generaciones para mostrar.' : 'Selecciona un modelo.'
              }
              items={selectedModel ? filteredGenerations : []}
              onSelect={(item) => void selectGeneration(item)}
              selectedId={selectedGeneration}
            />
          </section>

          <section>
            <label className="builder__field">
              <span>Version</span>
              <input
                disabled={!selectedGeneration}
                onChange={(event) => setTrimQuery(event.target.value)}
                placeholder="Selecciona generacion primero"
                type="search"
                value={trimQuery}
              />
            </label>
            <SpecsOptionList
              emptyLabel={
                selectedGeneration ? 'No hay versiones para mostrar.' : 'Selecciona una generacion.'
              }
              items={selectedGeneration ? filteredTrims : []}
              onSelect={(item) => void selectTrim(item)}
              selectedId={selectedTrim}
            />
          </section>
        </div>

        {previewSpecs.length ? (
          <div className="vehicle-specs-modal__preview">
            <strong>Vista previa tecnica</strong>
            <div>
              {previewSpecs.slice(0, SPEC_PREVIEW_LIMIT).map(([key, value]) => (
                <span key={key}>
                  <strong>{key}</strong>
                  {value}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AdminModalFrame>
  )
}
