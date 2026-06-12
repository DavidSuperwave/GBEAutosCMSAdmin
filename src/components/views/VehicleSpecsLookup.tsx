'use client'

import React, { useMemo, useState } from 'react'

import { ActionButton, StatusBadge } from '../admin-ui/kit'

type Option = {
  id?: string | number
  name?: string
  label?: string
  yearFrom?: number
  yearTo?: number
  trim?: string
  series?: string
  bodyType?: string
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

type SpecsResponse = {
  specs?: Record<string, string>
  raw?: Record<string, unknown>
  source?: string
  external?: Record<string, string>
  lastSpecSyncAt?: string
}

type Props = {
  defaultMake?: string
  defaultModel?: string
  defaultYear?: string
  onApply: (data: AppliedVehicleSpecs) => void
}

function label(option: Option): string {
  return String(option.name || option.label || option.id || '').trim()
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizedBodyType(value: unknown): string {
  const text = normalize(String(value || ''))
  if (text.includes('sedan')) return 'sedan'
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
  if (text.includes('gas')) return 'gasoline'
  return ''
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`)
  return data as T
}

export default function VehicleSpecsLookup({ defaultMake, defaultModel, defaultYear, onApply }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(defaultMake || '')
  const [makes, setMakes] = useState<Option[]>([])
  const [models, setModels] = useState<Option[]>([])
  const [generations, setGenerations] = useState<Option[]>([])
  const [trims, setTrims] = useState<Option[]>([])
  const [selectedMake, setSelectedMake] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedGeneration, setSelectedGeneration] = useState('')
  const [selectedTrim, setSelectedTrim] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<SpecsResponse | null>(null)

  const filteredMakes = useMemo(() => {
    const needle = normalize(query)
    if (!needle) return makes
    return makes.filter((make) => normalize(label(make)).includes(needle))
  }, [makes, query])

  async function loadMakes() {
    setBusy(true)
    setStatus('Cargando marcas...')
    try {
      const data = await getJSON<{ makes?: Option[] }>('/api/cms/vehicle-specs?action=makes')
      setMakes(data.makes || [])
      setStatus(data.makes?.length ? 'Selecciona una marca.' : 'No se encontraron marcas.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudieron cargar las marcas.')
    } finally {
      setBusy(false)
    }
  }

  async function handleOpen() {
    setOpen((current) => !current)
    if (!open && makes.length === 0) await loadMakes()
  }

  async function loadModels(makeId: string) {
    setSelectedMake(makeId)
    setSelectedModel('')
    setSelectedGeneration('')
    setSelectedTrim('')
    setPreview(null)
    setModels([])
    setGenerations([])
    setTrims([])
    setBusy(true)
    try {
      const data = await getJSON<{ models?: Option[] }>(
        `/api/cms/vehicle-specs?action=models&makeId=${encodeURIComponent(makeId)}`,
      )
      setModels(data.models || [])
      setStatus(data.models?.length ? 'Selecciona un modelo.' : 'Sin modelos para esta marca.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudieron cargar modelos.')
    } finally {
      setBusy(false)
    }
  }

  async function loadGenerations(modelId: string) {
    setSelectedModel(modelId)
    setSelectedGeneration('')
    setSelectedTrim('')
    setPreview(null)
    setGenerations([])
    setTrims([])
    setBusy(true)
    try {
      const data = await getJSON<{ generations?: Option[] }>(
        `/api/cms/vehicle-specs?action=generations&modelId=${encodeURIComponent(modelId)}`,
      )
      setGenerations(data.generations || [])
      setStatus(data.generations?.length ? 'Selecciona generación / año.' : 'Sin generaciones.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudieron cargar generaciones.')
    } finally {
      setBusy(false)
    }
  }

  async function loadTrims(generationId: string) {
    setSelectedGeneration(generationId)
    setSelectedTrim('')
    setPreview(null)
    setTrims([])
    setBusy(true)
    try {
      const data = await getJSON<{ trims?: Option[] }>(
        `/api/cms/vehicle-specs?action=trims&generationId=${encodeURIComponent(generationId)}`,
      )
      setTrims(data.trims || [])
      setStatus(data.trims?.length ? 'Selecciona versión para aplicar specs.' : 'Sin versiones.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudieron cargar versiones.')
    } finally {
      setBusy(false)
    }
  }

  async function loadTrimSpecs(trimId: string) {
    setSelectedTrim(trimId)
    setBusy(true)
    try {
      const data = await getJSON<SpecsResponse>(
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
    const selectedModelName = label(models.find((model) => String(model.id) === selectedModel) || {})
    const generation = generations.find((item) => String(item.id) === selectedGeneration)
    const raw = preview.raw || {}
    const specs = preview.specs || {}
    const trimText = String(raw.trim || raw.series || label(trims.find((item) => String(item.id) === selectedTrim) || {}) || '').trim()

    onApply({
      brand: String(raw.make || selectedMakeName || defaultMake || '').trim(),
      model: [raw.model || selectedModelName || defaultModel, trimText].filter(Boolean).join(' ').trim(),
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
    setStatus('Especificaciones aplicadas al formulario.')
  }

  return (
    <section className="vehicle-specs-lookup">
      <div className="vehicle-specs-lookup__head">
        <div>
          <h3>Autocompletar specs</h3>
          <p>Opcional. Completa datos técnicos desde el catálogo cuando quieras acelerar la captura.</p>
        </div>
        <ActionButton onClick={() => void handleOpen()} variant="secondary" disabled={busy}>
          {open ? 'Ocultar' : 'Buscar specs'}
        </ActionButton>
      </div>

      {open ? (
        <div className="vehicle-specs-lookup__grid">
          <label className="builder__field">
            <span>Buscar marca</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Audi, Mazda..." />
          </label>
          <label className="builder__field">
            <span>Marca</span>
            <select value={selectedMake} onChange={(event) => void loadModels(event.target.value)} disabled={busy}>
              <option value="">Selecciona</option>
              {filteredMakes.map((make) => (
                <option key={String(make.id)} value={String(make.id)}>
                  {label(make)}
                </option>
              ))}
            </select>
          </label>
          <label className="builder__field">
            <span>Modelo</span>
            <select value={selectedModel} onChange={(event) => void loadGenerations(event.target.value)} disabled={busy || !selectedMake}>
              <option value="">Selecciona</option>
              {models.map((model) => (
                <option key={String(model.id)} value={String(model.id)}>
                  {label(model)}
                </option>
              ))}
            </select>
          </label>
          <label className="builder__field">
            <span>Generación / año</span>
            <select value={selectedGeneration} onChange={(event) => void loadTrims(event.target.value)} disabled={busy || !selectedModel}>
              <option value="">Selecciona</option>
              {generations.map((generation) => (
                <option key={String(generation.id)} value={String(generation.id)}>
                  {[label(generation), generation.yearFrom, generation.yearTo].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </label>
          <label className="builder__field">
            <span>Versión</span>
            <select value={selectedTrim} onChange={(event) => void loadTrimSpecs(event.target.value)} disabled={busy || !selectedGeneration}>
              <option value="">Selecciona</option>
              {trims.map((trim) => (
                <option key={String(trim.id)} value={String(trim.id)}>
                  {label(trim)}
                </option>
              ))}
            </select>
          </label>
          <div className="vehicle-specs-lookup__status">
            <StatusBadge tone={preview ? 'success' : busy ? 'info' : 'neutral'}>{busy ? 'Consultando' : preview ? 'Listo' : 'Opcional'}</StatusBadge>
            {status ? <span>{status}</span> : null}
          </div>
          {preview?.specs ? (
            <div className="vehicle-specs-lookup__preview">
              {Object.entries(preview.specs)
                .filter(([, value]) => value)
                .slice(0, 8)
                .map(([key, value]) => (
                  <span key={key}>
                    <strong>{key}</strong> {value}
                  </span>
                ))}
              <ActionButton onClick={apply} variant="primary">
                Aplicar specs
              </ActionButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
