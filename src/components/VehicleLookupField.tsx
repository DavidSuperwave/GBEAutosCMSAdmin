"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useField } from "@payloadcms/ui"

type Option = {
  id: string | number
  name?: string
  label?: string
  bodyType?: string
  series?: string
  trim?: string
  yearFrom?: number
  yearTo?: number
}

type SpecsResponse = {
  specs?: {
    tipo?: string
    motor?: string
    potencia?: string
    transmision?: string
    combustible?: string
    traccion?: string
    cylinders?: string
    seats?: string
    doors?: string
    lengthMm?: string
    widthMm?: string
    heightMm?: string
    wheelbaseMm?: string
    maxTrunkCapacityL?: string
    torqueNm?: string
    fuelTankCapacityL?: string
  }
  raw?: {
    id?: string | number
    make?: string
    model?: string
    generation?: string
    transmission?: string
    engineType?: string
    trim?: string
    series?: string
    bodyType?: string
  }
  source?: "catalog" | "rapidapi" | "none"
  external?: {
    makeId?: string
    modelId?: string
    generationId?: string
    trimId?: string
  }
  lastSpecSyncAt?: string
}

const API_BASE = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"

export default function VehicleLookupField() {
  const brand = useField<string>({ path: "brand" })
  const model = useField<string>({ path: "model" })
  const year = useField<number>({ path: "year" })
  const bodyType = useField<string>({ path: "bodyType" })
  const commercialTransmission = useField<string>({ path: "transmission" })
  const fuel = useField<string>({ path: "fuel" })
  const tipo = useField<string>({ path: "specs.tipo" })
  const motor = useField<string>({ path: "specs.motor" })
  const potencia = useField<string>({ path: "specs.potencia" })
  const transmision = useField<string>({ path: "specs.transmision" })
  const combustible = useField<string>({ path: "specs.combustible" })
  const traccion = useField<string>({ path: "specs.traccion" })
  const cylinders = useField<string>({ path: "specs.cylinders" })
  const seats = useField<string>({ path: "specs.seats" })
  const doors = useField<string>({ path: "specs.doors" })
  const lengthMm = useField<string>({ path: "specs.lengthMm" })
  const widthMm = useField<string>({ path: "specs.widthMm" })
  const heightMm = useField<string>({ path: "specs.heightMm" })
  const wheelbaseMm = useField<string>({ path: "specs.wheelbaseMm" })
  const maxTrunkCapacityL = useField<string>({ path: "specs.maxTrunkCapacityL" })
  const torqueNm = useField<string>({ path: "specs.torqueNm" })
  const fuelTankCapacityL = useField<string>({ path: "specs.fuelTankCapacityL" })
  const specSource = useField<string>({ path: "sourceMeta.specSource" })
  const externalMakeId = useField<string>({ path: "sourceMeta.externalMakeId" })
  const externalModelId = useField<string>({ path: "sourceMeta.externalModelId" })
  const externalGenerationId = useField<string>({ path: "sourceMeta.externalGenerationId" })
  const externalTrimId = useField<string>({ path: "sourceMeta.externalTrimId" })
  const lastSpecSyncAt = useField<string>({ path: "sourceMeta.lastSpecSyncAt" })

  const [query, setQuery] = useState("")
  const [allMakes, setAllMakes] = useState<Option[]>([])
  const [makes, setMakes] = useState<Option[]>([])
  const [models, setModels] = useState<Option[]>([])
  const [generations, setGenerations] = useState<Option[]>([])
  const [trims, setTrims] = useState<Option[]>([])
  const [selectedMake, setSelectedMake] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [selectedGeneration, setSelectedGeneration] = useState("")
  const [selectedTrim, setSelectedTrim] = useState("")
  const [preview, setPreview] = useState<SpecsResponse | null>(null)
  const [status, setStatus] = useState("Cargando marcas...")

  const selectedMakeName = useMemo(
    () => makes.find((make) => String(make.id) === selectedMake)?.name || "",
    [makes, selectedMake],
  )

  const selectedModelName = useMemo(
    () => models.find((item) => String(item.id) === selectedModel)?.name || "",
    [models, selectedModel],
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadMakes() {
      try {
        setStatus("Cargando marcas...")
        const data = await getJSON<{ makes?: Option[] }>(
          "/api/cms/vehicle-specs?action=makes",
          controller.signal,
        )
        const nextMakes = data.makes || []
        setAllMakes(nextMakes)
        setMakes(nextMakes)
        setStatus(nextMakes.length ? "Busca o selecciona una marca." : "No se encontraron marcas.")
      } catch (error) {
        if (!controller.signal.aborted) setStatus(getErrorMessage(error))
      }
    }

    loadMakes()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const normalizedQuery = normalize(query)
    setMakes(
      normalizedQuery
        ? allMakes.filter((make) => normalize(getOptionLabel(make)).includes(normalizedQuery))
        : allMakes,
    )
  }, [allMakes, query])

  async function loadModels(makeId: string) {
    setSelectedMake(makeId)
    setSelectedModel("")
    setSelectedGeneration("")
    setSelectedTrim("")
    setPreview(null)
    setModels([])
    setGenerations([])
    setTrims([])

    const makeName = makes.find((make) => String(make.id) === makeId)?.name
    if (makeName) brand.setValue(makeName)

    try {
      setStatus("Cargando modelos...")
      const data = await getJSON<{ models?: Option[] }>(
        `/api/cms/vehicle-specs?action=models&makeId=${encodeURIComponent(makeId)}`,
      )
      setModels(data.models || [])
      setStatus(data.models?.length ? "Selecciona un modelo." : "No se encontraron modelos para esta marca.")
    } catch (error) {
      setStatus(getErrorMessage(error))
    }
  }

  async function loadGenerations(modelId: string) {
    setSelectedModel(modelId)
    setSelectedGeneration("")
    setSelectedTrim("")
    setPreview(null)
    setGenerations([])
    setTrims([])

    const modelName = models.find((item) => String(item.id) === modelId)?.name
    if (modelName) model.setValue(`${selectedMakeName} ${modelName}`.trim())

    try {
      setStatus("Cargando generaciones...")
      const data = await getJSON<{ generations?: Option[] }>(
        `/api/cms/vehicle-specs?action=generations&modelId=${encodeURIComponent(modelId)}`,
      )
      setGenerations(data.generations || [])
      setStatus(data.generations?.length ? "Selecciona una generacion o rango de anos." : "No se encontraron generaciones.")
    } catch (error) {
      setStatus(getErrorMessage(error))
    }
  }

  async function loadTrims(generationId: string) {
    setSelectedGeneration(generationId)
    setSelectedTrim("")
    setPreview(null)
    setTrims([])

    const generation = generations.find((item) => String(item.id) === generationId)
    if (generation?.yearTo || generation?.yearFrom) {
      year.setValue(generation.yearTo || generation.yearFrom)
    }

    try {
      setStatus("Cargando versiones...")
      const data = await getJSON<{ trims?: Option[] }>(
        `/api/cms/vehicle-specs?action=trims&generationId=${encodeURIComponent(generationId)}`,
      )
      setTrims(data.trims || [])
      setStatus(data.trims?.length ? "Selecciona una version para autocompletar especificaciones." : "No se encontraron versiones.")
    } catch (error) {
      setStatus(getErrorMessage(error))
    }
  }

  async function applyTrim(trimId: string) {
    setSelectedTrim(trimId)

    try {
      setStatus("Consultando especificaciones...")
      const data = await getJSON<SpecsResponse>(
        `/api/cms/vehicle-specs?action=trimSpecs&trimId=${encodeURIComponent(trimId)}`,
      )
      setPreview({
        ...data,
        source: data.source || "rapidapi",
        external: {
          makeId: selectedMake,
          modelId: selectedModel,
          generationId: selectedGeneration,
          trimId,
          ...data.external,
        },
        lastSpecSyncAt: data.lastSpecSyncAt || new Date().toISOString(),
      })
      setStatus("Revisa la vista previa y aplica los datos si coinciden con la unidad.")
    } catch (error) {
      setStatus(getErrorMessage(error))
    }
  }

  function applyPreview() {
    if (!preview) return

    const specs = preview.specs || {}
    const raw = preview.raw || {}
    const trimLabel = raw.trim || raw.series

    if (raw.make || selectedMakeName) brand.setValue(raw.make || selectedMakeName)
    if (selectedModelName || raw.model) {
      model.setValue([raw.make || selectedMakeName, raw.model || selectedModelName, trimLabel].filter(Boolean).join(" "))
    }
    if (specs.tipo) tipo.setValue(specs.tipo)
    if (specs.motor) motor.setValue(specs.motor)
    if (specs.potencia) potencia.setValue(specs.potencia)
    if (specs.transmision) transmision.setValue(specs.transmision)
    if (specs.combustible) combustible.setValue(specs.combustible)
    if (specs.traccion) traccion.setValue(specs.traccion)
    if (specs.cylinders) cylinders.setValue(specs.cylinders)
    if (specs.seats) seats.setValue(specs.seats)
    if (specs.doors) doors.setValue(specs.doors)
    if (specs.lengthMm) lengthMm.setValue(specs.lengthMm)
    if (specs.widthMm) widthMm.setValue(specs.widthMm)
    if (specs.heightMm) heightMm.setValue(specs.heightMm)
    if (specs.wheelbaseMm) wheelbaseMm.setValue(specs.wheelbaseMm)
    if (specs.maxTrunkCapacityL) maxTrunkCapacityL.setValue(specs.maxTrunkCapacityL)
    if (specs.torqueNm) torqueNm.setValue(specs.torqueNm)
    if (specs.fuelTankCapacityL) fuelTankCapacityL.setValue(specs.fuelTankCapacityL)

    const normalizedBody = normalizeBodyType(raw.bodyType || specs.tipo)
    const normalizedTransmission = normalizeTransmission(raw.transmission || specs.transmision)
    const normalizedFuel = normalizeFuel(raw.engineType || specs.combustible)
    if (normalizedBody) bodyType.setValue(normalizedBody)
    if (normalizedTransmission) commercialTransmission.setValue(normalizedTransmission)
    if (normalizedFuel) fuel.setValue(normalizedFuel)

    specSource.setValue(preview.source || "rapidapi")
    externalMakeId.setValue(preview.external?.makeId || selectedMake)
    externalModelId.setValue(preview.external?.modelId || selectedModel)
    externalGenerationId.setValue(preview.external?.generationId || selectedGeneration)
    externalTrimId.setValue(preview.external?.trimId || selectedTrim || String(raw.id || ""))
    lastSpecSyncAt.setValue(preview.lastSpecSyncAt || new Date().toISOString())
    setStatus("Especificaciones aplicadas. Revisa precio, ubicacion, kilometraje, imagenes y descripcion antes de guardar.")
  }

  return (
    <div style={wrapperStyle}>
      <h3 style={{ marginTop: 0 }}>Busqueda de vehiculo</h3>
      <p style={{ color: "var(--theme-elevation-600)", marginTop: 0 }}>
        Busca una marca, elige modelo, generacion y version. Primero veras una vista previa; al aplicar
        solo se actualizan datos tecnicos y metadatos de origen.
      </p>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <label>
          <span>Buscar marca</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ford, Mazda, Nissan..."
            style={inputStyle}
            type="search"
            value={query}
          />
        </label>

        <label>
          <span>Marca</span>
          <select
            onChange={(event) => loadModels(event.target.value)}
            style={inputStyle}
            value={selectedMake}
          >
            <option value="">Seleccionar marca</option>
            {makes.map((make) => (
              <option key={make.id} value={make.id}>
                {getOptionLabel(make)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Modelo</span>
          <select
            disabled={!models.length}
            onChange={(event) => loadGenerations(event.target.value)}
            style={inputStyle}
            value={selectedModel}
          >
            <option value="">Seleccionar modelo</option>
            {models.map((item) => (
              <option key={item.id} value={item.id}>
                {getOptionLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Generacion</span>
          <select
            disabled={!generations.length}
            onChange={(event) => loadTrims(event.target.value)}
            style={inputStyle}
            value={selectedGeneration}
          >
            <option value="">Seleccionar generacion</option>
            {generations.map((item) => (
              <option key={item.id} value={item.id}>
                {getOptionLabel(item)} {formatYears(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Version</span>
          <select
            disabled={!trims.length}
            onChange={(event) => applyTrim(event.target.value)}
            style={inputStyle}
            value={selectedTrim}
          >
            <option value="">Seleccionar version</option>
            {trims.map((item) => (
              <option key={item.id} value={item.id}>
                {getOptionLabel(item)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {preview?.specs ? (
        <div style={previewStyle}>
          <strong>Vista previa tecnica</strong>
          <dl style={previewGridStyle}>
            {Object.entries(preview.specs)
              .filter(([, value]) => Boolean(value))
              .map(([key, value]) => (
                <React.Fragment key={key}>
                  <dt>{labelForSpec(key)}</dt>
                  <dd>{value}</dd>
                </React.Fragment>
              ))}
          </dl>
          <button type="button" onClick={applyPreview} style={buttonStyle}>
            Aplicar especificaciones
          </button>
        </div>
      ) : null}

      <p style={{ marginBottom: 0 }}>{status}</p>
    </div>
  )
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { signal })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`)
  }
  return data
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function formatYears(item: Option) {
  if (!item.yearFrom && !item.yearTo) return ""
  if (item.yearFrom === item.yearTo) return `(${item.yearFrom})`
  return `(${item.yearFrom || "?"}-${item.yearTo || "present"})`
}

function getOptionLabel(item: Option) {
  return item.name || item.label || item.trim || item.series || item.bodyType || String(item.id)
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo consultar el vehiculo."
}

function labelForSpec(key: string) {
  const labels: Record<string, string> = {
    tipo: "Tipo",
    motor: "Motor",
    potencia: "Potencia",
    transmision: "Transmision",
    combustible: "Combustible",
    traccion: "Traccion",
    cylinders: "Cilindros",
    seats: "Asientos",
    doors: "Puertas",
    lengthMm: "Largo",
    widthMm: "Ancho",
    heightMm: "Alto",
    wheelbaseMm: "Entre ejes",
    maxTrunkCapacityL: "Cajuela",
    torqueNm: "Torque",
    fuelTankCapacityL: "Tanque",
  }
  return labels[key] || key
}

function normalizeBodyType(value?: string) {
  const text = normalize(value || "")
  if (text.includes("suv")) return "suv"
  if (text.includes("pickup") || text.includes("truck")) return "pickup"
  if (text.includes("coupe")) return "coupe"
  if (text.includes("hatch")) return "hatchback"
  if (text.includes("van")) return "van"
  if (text.includes("sedan") || text.includes("saloon")) return "sedan"
  return text ? "other" : ""
}

function normalizeTransmission(value?: string) {
  const text = normalize(value || "")
  if (text.includes("cvt")) return "cvt"
  if (text.includes("manual")) return "manual"
  if (text.includes("automatic") || text.includes("automatica") || text.includes("auto")) return "automatic"
  return ""
}

function normalizeFuel(value?: string) {
  const text = normalize(value || "")
  if (text.includes("diesel")) return "diesel"
  if (text.includes("hybrid") || text.includes("hibrido")) return "hybrid"
  if (text.includes("electric")) return "electric"
  if (text.includes("gas") || text.includes("petrol")) return "gasoline"
  return ""
}

const wrapperStyle: React.CSSProperties = {
  border: "1px solid var(--theme-elevation-150)",
  borderRadius: 6,
  marginBottom: 24,
  padding: 16,
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 6,
  minHeight: 40,
  padding: "8px 10px",
  width: "100%",
}

const previewStyle: React.CSSProperties = {
  background: "var(--theme-elevation-50)",
  border: "1px solid var(--theme-elevation-150)",
  borderRadius: 6,
  marginTop: 16,
  padding: 14,
}

const previewGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px 14px",
  gridTemplateColumns: "max-content minmax(0, 1fr)",
  margin: "12px 0",
}

const buttonStyle: React.CSSProperties = {
  background: "#1f6f43",
  border: 0,
  borderRadius: 4,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  minHeight: 40,
  padding: "0 14px",
}
