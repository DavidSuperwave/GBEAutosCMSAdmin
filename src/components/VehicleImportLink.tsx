"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

type CSVRow = Record<string, string>
type ImportStatus = "idle" | "importing" | "done"
type VehicleDraft = Record<string, unknown>

const FIELD_OPTIONS = [
  { label: "Ignorar columna", value: "" },
  { label: "Campo personalizado", value: "__custom" },
  { label: "Marca", value: "brand", required: true },
  { label: "Modelo", value: "model", required: true },
  { label: "Año", value: "year", required: true },
  { label: "Precio", value: "price", required: true },
  { label: "Estatus", value: "inventoryStatus" },
  { label: "Descripción", value: "description" },
  { label: "Características", value: "features" },
  { label: "Motor", value: "specs.motor" },
  { label: "Potencia", value: "specs.potencia" },
  { label: "Transmisión", value: "specs.transmision" },
  { label: "Combustible", value: "specs.combustible" },
  { label: "Tracción", value: "specs.traccion" },
  { label: "Hero etiqueta", value: "landing.hero.eyebrow" },
  { label: "Hero título", value: "landing.hero.headline" },
  { label: "Hero texto", value: "landing.hero.subheadline" },
  { label: "CTA principal", value: "landing.hero.primaryCtaLabel" },
  { label: "CTA secundario", value: "landing.hero.secondaryCtaLabel" },
  { label: "Highlights", value: "landing.highlights" },
  { label: "Versiones", value: "landing.versions" },
  { label: "CTA final título", value: "landing.finalCta.heading" },
  { label: "CTA final texto", value: "landing.finalCta.body" },
  { label: "CTA final botón", value: "landing.finalCta.primaryLabel" },
]

const REQUIRED_FIELDS = FIELD_OPTIONS.filter((field) => field.required).map((field) => field.value)
const STATUS_VALUES = new Set(["available", "reserved", "sold"])
const DELIMITERS = [",", ";", "\t"]

function parseDelimitedRows(text: string, delimiter: string) {
  const rows: string[][] = []
  let cell = ""
  let row: string[] = []
  let quoted = false
  const normalizedText = text.replace(/^\uFEFF/, "")

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index]
    const next = normalizedText[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim())
      cell = ""
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }

  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)

  return rows
}

function scoreHeaderRow(row: string[]) {
  const knownHeaderScore = row.reduce((score, value) => {
    const normalized = normalizeHeader(value)
    if (
      [
        "ano",
        "brand",
        "caracteristicas",
        "combustible",
        "descripcion",
        "estatus",
        "features",
        "marca",
        "modelo",
        "model",
        "motor",
        "potencia",
        "precio",
        "price",
        "status",
        "traccion",
        "transmision",
        "year",
      ].some((token) => normalized.includes(token))
    ) {
      return score + 4
    }

    return score
  }, 0)
  const filledCells = row.filter(Boolean).length
  const textCells = row.filter((value) => Number.isNaN(Number(value.replace(/[^\d.-]/g, "")))).length

  return knownHeaderScore + filledCells + textCells
}

function uniqueHeaders(headers: string[]) {
  const counts = new Map<string, number>()

  return headers.map((header, index) => {
    const fallback = header.trim() || `Columna ${index + 1}`
    const count = counts.get(fallback) ?? 0
    counts.set(fallback, count + 1)
    return count ? `${fallback} (${count + 1})` : fallback
  })
}

function parseCSV(text: string) {
  const candidates = DELIMITERS.map((delimiter) => {
    const rows = parseDelimitedRows(text, delimiter)
    const width = Math.max(0, ...rows.slice(0, 10).map((row) => row.length))
    return { delimiter, rows, width }
  })
  const best = candidates.sort((a, b) => b.width - a.width)[0]
  const rows = best?.rows ?? []
  const headerRowIndex = rows
    .slice(0, 10)
    .map((row, index) => ({ index, score: scoreHeaderRow(row) }))
    .sort((a, b) => b.score - a.score)[0]?.index ?? 0
  const headers = uniqueHeaders(rows[headerRowIndex] ?? [])
  const data = rows.slice(headerRowIndex + 1).map((values) =>
    headers.reduce<CSVRow>((rowData, header, index) => {
      rowData[header] = values[index] ?? ""
      return rowData
    }, {}),
  )

  return { data, delimiter: best?.delimiter ?? ",", headerRowIndex, headers }
}

function normalizeHeader(header: string) {
  return header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

function guessField(header: string) {
  const normalized = normalizeHeader(header)
  const matches: Record<string, string> = {
    ano: "year",
    brand: "brand",
    caracteristicas: "features",
    combustible: "specs.combustible",
    descripcion: "description",
    description: "description",
    estatus: "inventoryStatus",
    features: "features",
    marca: "brand",
    modelo: "model",
    model: "model",
    motor: "specs.motor",
    potencia: "specs.potencia",
    precio: "price",
    price: "price",
    status: "inventoryStatus",
    traccion: "specs.traccion",
    transmision: "specs.transmision",
    year: "year",
  }

  if (matches[normalized]) return matches[normalized]
  if (normalized.includes("marca") || normalized.includes("brand")) return "brand"
  if (normalized.includes("modelo") || normalized.includes("model")) return "model"
  if (normalized.includes("precio") || normalized.includes("price")) return "price"
  if (normalized.includes("ano") || normalized.includes("year")) return "year"
  if (normalized.includes("estatus") || normalized.includes("status")) return "inventoryStatus"
  if (normalized.includes("descripcion") || normalized.includes("description")) return "description"
  if (normalized.includes("motor")) return "specs.motor"
  if (normalized.includes("transmision")) return "specs.transmision"
  if (normalized.includes("combustible")) return "specs.combustible"
  if (normalized.includes("traccion")) return "specs.traccion"
  if (normalized.includes("potencia")) return "specs.potencia"
  if (normalized.includes("caracteristica") || normalized.includes("feature")) return "features"

  return ""
}

function splitList(value: string) {
  return value
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getObject(target: VehicleDraft, key: string) {
  const current = target[key]
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    target[key] = {}
  }

  return target[key] as VehicleDraft
}

function setPath(target: VehicleDraft, path: string, value: unknown) {
  const parts = path.split(".")
  const last = parts.pop()
  if (!last) return

  let cursor: VehicleDraft = target
  for (const part of parts) {
    const current = cursor[part]
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      cursor[part] = {}
    }
    cursor = cursor[part] as VehicleDraft
  }

  cursor[last] = value
}

function normalizeStatus(value: string) {
  const normalized = normalizeHeader(value)
  if (normalized === "disponible") return "available"
  if (normalized === "apartado" || normalized === "reservado") return "reserved"
  if (normalized === "vendido") return "sold"
  return STATUS_VALUES.has(value) ? value : "available"
}

function buildVehicle(
  row: CSVRow,
  mapping: Record<string, string>,
  customFieldNames: Record<string, string>,
  options: { includeDefaults?: boolean } = {},
) {
  const vehicle: VehicleDraft = {}
  const customFields: Array<{ name: string; value: string }> = []

  for (const [header, field] of Object.entries(mapping)) {
    const rawValue = row[header]?.trim()
    if (!field || !rawValue) continue

    if (field === "__custom") {
      const name = customFieldNames[header]?.trim() || header
      customFields.push({ name, value: rawValue })
      continue
    }

    if (field === "year") {
      const year = Number(rawValue.replace(/[^\d]/g, ""))
      if (Number.isFinite(year)) vehicle.year = year
      continue
    }

    if (field === "inventoryStatus") {
      vehicle.inventoryStatus = normalizeStatus(rawValue)
      continue
    }

    if (field === "features") {
      vehicle.features = splitList(rawValue).map((feature) => ({ feature }))
      continue
    }

    if (field === "landing.highlights") {
      const landing = getObject(vehicle, "landing")
      landing.highlights = splitList(rawValue).map((item) => ({
        description: item,
        icon: "technology",
        label: item,
      }))
      continue
    }

    if (field === "landing.versions") {
      const landing = getObject(vehicle, "landing")
      landing.versions = splitList(rawValue).map((name) => ({ name }))
      continue
    }

    setPath(vehicle, field, rawValue)
  }

  if (options.includeDefaults) {
    vehicle.inventoryStatus = vehicle.inventoryStatus ?? "available"
  }

  if (customFields.length) {
    vehicle.customFields = customFields
  }

  return vehicle
}

export default function VehicleImportLink() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [target, setTarget] = useState<Element | null>(null)
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [parseDetails, setParseDetails] = useState<{ delimiter: string; headerRowIndex: number } | null>(null)
  const [rows, setRows] = useState<CSVRow[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [customFieldNames, setCustomFieldNames] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<ImportStatus>("idle")
  const [results, setResults] = useState<string[]>([])

  useEffect(() => {
    const findTarget = () => {
      const titleActions = document.querySelector(".collection-list--vehicles .list-header__title-actions")
      setTarget(titleActions)
    }

    findTarget()
    const observer = new MutationObserver(findTarget)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.body.classList.toggle("vehicle-import-modal-is-open", open)
    return () => document.body.classList.remove("vehicle-import-modal-is-open")
  }, [open])

  const mappedRequired = useMemo(
    () => REQUIRED_FIELDS.every((field) => Object.values(mapping).includes(field)),
    [mapping],
  )

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const parsed = parseCSV(await file.text())
    setFileName(file.name)
    setHeaders(parsed.headers)
    setParseDetails({ delimiter: parsed.delimiter, headerRowIndex: parsed.headerRowIndex })
    setRows(parsed.data)
    setMapping(
      parsed.headers.reduce<Record<string, string>>((nextMapping, header) => {
        nextMapping[header] = guessField(header)
        return nextMapping
      }, {}),
    )
    setCustomFieldNames(
      parsed.headers.reduce<Record<string, string>>((nextNames, header) => {
        nextNames[header] = header
        return nextNames
      }, {}),
    )
    setResults([])
    setStatus("idle")
  }

  function resetImport() {
    setFileName("")
    setHeaders([])
    setParseDetails(null)
    setRows([])
    setMapping({})
    setCustomFieldNames({})
    setResults([])
    setStatus("idle")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function importRows() {
    setStatus("importing")
    setResults([])

    const nextResults: string[] = []
    for (const [index, row] of rows.entries()) {
      const vehicleWithDefaults = buildVehicle(row, mapping, customFieldNames, { includeDefaults: true })

      try {
        const response = await fetch("/api/vehicles", {
          body: JSON.stringify(vehicleWithDefaults),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })

        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.message || `HTTP ${response.status}`)
        }

        const created = await response.json()
        nextResults.push(
          `Fila ${index + 2}: creado ${created?.doc?.brand ?? vehicleWithDefaults.brand} ${created?.doc?.model ?? vehicleWithDefaults.model}`,
        )
      } catch (error) {
        nextResults.push(
          `Fila ${index + 2}: error - ${error instanceof Error ? error.message : "No se pudo importar"}`,
        )
      }

      setResults([...nextResults])
    }

    setStatus("done")
  }

  const trigger = (
    <button className="vehicle-import-trigger" onClick={() => setOpen(true)} type="button">
      Importar CSV
    </button>
  )

  return (
    <>
      {target ? createPortal(trigger, target) : <div className="vehicle-import-fallback">{trigger}</div>}
      {open
        ? createPortal(
            <div className="vehicle-import-modal" role="dialog" aria-modal="true" aria-label="Importar CSV">
              <button className="vehicle-import-modal__backdrop" onClick={() => setOpen(false)} type="button" />
              <div className="vehicle-import-modal__panel">
                <header className="vehicle-import-modal__header">
                  <div>
                    <p>Importación</p>
                    <h2>Importar vehículos por CSV</h2>
                  </div>
                  <button aria-label="Cerrar importación" onClick={() => setOpen(false)} type="button">
                    ×
                  </button>
                </header>

                <div className="vehicle-import-modal__body">
                  <section className="vehicle-import-upload">
                    <input
                      accept=".csv,text/csv"
                      className="vehicle-import-upload__input"
                      onChange={handleFile}
                      ref={fileInputRef}
                      type="file"
                    />
                    <button onClick={() => fileInputRef.current?.click()} type="button">
                      {fileName ? "Cambiar archivo" : "Subir CSV"}
                    </button>
                    <div>
                      <strong>{fileName || "Ningún archivo seleccionado"}</strong>
                      <span>
                        {headers.length
                          ? `${headers.length} columnas detectadas, ${rows.length} filas listas para revisar. Encabezados en fila ${(parseDetails?.headerRowIndex ?? 0) + 1}.`
                          : "El sistema detecta los encabezados y sugiere el mapeo inicial."}
                      </span>
                    </div>
                  </section>

                  {headers.length ? (
                    <div className="vehicle-import-grid vehicle-import-grid--mapping-only">
                      <section>
                        <div className="vehicle-import-section-title">
                          <h3>Mapeo de columnas</h3>
                          <span>
                            Marca, Modelo, Año y Precio son obligatorios
                            {parseDetails ? ` · Separador: ${parseDetails.delimiter === "\t" ? "tab" : parseDetails.delimiter}` : ""}
                          </span>
                        </div>
                        <div className="vehicle-import-fields">
                          {headers.map((header) => (
                            <label key={header}>
                              <span className="vehicle-import-field-name" title={header}>
                                {header}
                              </span>
                              <small>
                                {rows
                                  .slice(0, 3)
                                  .map((row) => row[header])
                                  .filter(Boolean)
                                  .join(" · ") || "Sin datos de muestra"}
                              </small>
                              <select
                                onChange={(event) =>
                                  setMapping((current) => ({ ...current, [header]: event.target.value }))
                                }
                                value={mapping[header] ?? ""}
                              >
                                {FIELD_OPTIONS.map((field) => (
                                  <option key={field.value || "ignore"} value={field.value}>
                                    {field.label}
                                  </option>
                                ))}
                              </select>
                              {mapping[header] === "__custom" ? (
                                <input
                                  aria-label={`Nombre del campo personalizado para ${header}`}
                                  onChange={(event) =>
                                    setCustomFieldNames((current) => ({
                                      ...current,
                                      [header]: event.target.value,
                                    }))
                                  }
                                  placeholder="Nombre del campo"
                                  type="text"
                                  value={customFieldNames[header] ?? header}
                                />
                              ) : null}
                            </label>
                          ))}
                        </div>
                      </section>

                    </div>
                  ) : null}

                  {results.length ? (
                    <section className="vehicle-import-results">
                      <h3>Resultado</h3>
                      <ol>
                        {results.map((result) => (
                          <li key={result}>{result}</li>
                        ))}
                      </ol>
                    </section>
                  ) : null}
                </div>

                <footer className="vehicle-import-modal__footer">
                  <button disabled={!headers.length || status === "importing"} onClick={resetImport} type="button">
                    Limpiar
                  </button>
                  <button onClick={() => setOpen(false)} type="button">
                    Cancelar
                  </button>
                  <button disabled={!mappedRequired || status === "importing"} onClick={importRows} type="button">
                    {status === "importing" ? "Importando..." : `Importar ${rows.length || 0} vehículos`}
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
