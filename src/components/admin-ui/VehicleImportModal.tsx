"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import * as XLSX from "xlsx"

import { suggestFieldForHeader } from "../../services/importNormalize"

/**
 * Controlled CSV/XLSX import modal used by the custom Inventory manager.
 * Import is intentionally API-free: it creates draft vehicles from the file
 * only. Spec enrichment via RapidAPI is a separate, on-demand action when
 * creating a single vehicle.
 */

type CSVRow = Record<string, string>
type ImportStatus = "idle" | "importing" | "done"
type FieldOption = { label: string; value: string; required?: boolean }

const FIELD_OPTIONS: FieldOption[] = [
  { label: "Ignorar columna", value: "" },
  { label: "Condición (TIPO)", value: "condition" },
  { label: "ID de origen (IDV)", value: "sourceId" },
  { label: "Agencia de origen (NOM_CONCESIONARIO)", value: "sourceDealerName" },
  { label: "Marca (DES_MARCA)", value: "brand", required: true },
  { label: "Modelo (DES_MODELO)", value: "model", required: true },
  { label: "Versión / Trim", value: "trim" },
  { label: "Familia de modelo (DES_FAMILIA)", value: "modelFamily" },
  { label: "Año (ANIO_VEHI)", value: "year" },
  { label: "Color exterior (DES_COLOR)", value: "exteriorColor" },
  { label: "Color interior (DES_COLOR_INTERIOR)", value: "interiorColor" },
  { label: "Kilometraje (KM)", value: "mileage" },
  { label: "Segmento (DES_SEGMENTO)", value: "segment" },
  { label: "Tipo de motor (DES_TIPO_MOTOR)", value: "motorType" },
  { label: "Tipo de vehículo (DES_TIPO_VEHICULO)", value: "vehicleType" },
  { label: "Precio", value: "price" },
  { label: "Descripción", value: "description" },
]

const VALID_FIELDS = new Set(FIELD_OPTIONS.map((option) => option.value).filter(Boolean))
const REQUIRED_FIELDS = FIELD_OPTIONS.filter((field) => field.required).map((field) => field.value)
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

function uniqueHeaders(headers: string[]) {
  const counts = new Map<string, number>()
  return headers.map((header, index) => {
    const fallback = String(header).trim() || `Columna ${index + 1}`
    const count = counts.get(fallback) ?? 0
    counts.set(fallback, count + 1)
    return count ? `${fallback} (${count + 1})` : fallback
  })
}

function rowsToObjects(matrix: string[][]) {
  const headerRow = matrix[0] ?? []
  const headers = uniqueHeaders(headerRow.map((value) => String(value ?? "")))
  const data = matrix.slice(1).map((values) =>
    headers.reduce<CSVRow>((rowData, header, index) => {
      rowData[header] = values[index] !== undefined && values[index] !== null ? String(values[index]) : ""
      return rowData
    }, {}),
  )
  return { headers, data }
}

function parseCSV(text: string) {
  const candidates = DELIMITERS.map((delimiter) => {
    const rows = parseDelimitedRows(text, delimiter)
    const width = Math.max(0, ...rows.slice(0, 10).map((row) => row.length))
    return { delimiter, rows, width }
  })
  const best = candidates.sort((a, b) => b.width - a.width)[0]
  return rowsToObjects(best?.rows ?? [])
}

async function parseXLSX(file: File) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, blankrows: false, defval: "" }) as string[][]
  return rowsToObjects(matrix.map((row) => row.map((value) => String(value ?? ""))))
}

export default function VehicleImportModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean
  onClose: () => void
  onComplete?: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")
  const [fileType, setFileType] = useState<"csv" | "xlsx">("csv")
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<CSVRow[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<ImportStatus>("idle")
  const [updateExisting, setUpdateExisting] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    document.body.classList.toggle("vehicle-import-modal-is-open", open)
    return () => document.body.classList.remove("vehicle-import-modal-is-open")
  }, [open])

  const mappedRequired = useMemo(
    () => REQUIRED_FIELDS.every((field) => Object.values(mapping).includes(field)),
    [mapping],
  )

  function applyParsed(parsed: { headers: string[]; data: CSVRow[] }) {
    setHeaders(parsed.headers)
    setRows(parsed.data)
    setMapping(
      parsed.headers.reduce<Record<string, string>>((next, header) => {
        const guess = suggestFieldForHeader(header)
        next[header] = VALID_FIELDS.has(guess) ? guess : ""
        return next
      }, {}),
    )
    setResults([])
    setStatus("idle")
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError("")
    setFileName(file.name)
    const isXlsx = /\.xlsx$/i.test(file.name)
    setFileType(isXlsx ? "xlsx" : "csv")
    try {
      const parsed = isXlsx ? await parseXLSX(file) : parseCSV(await file.text())
      applyParsed(parsed)
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "No se pudo leer el archivo.")
    }
  }

  function resetImport() {
    setFileName("")
    setHeaders([])
    setRows([])
    setMapping({})
    setResults([])
    setError("")
    setStatus("idle")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function importRows() {
    setStatus("importing")
    setResults([])
    setError("")

    try {
      const response = await fetch("/api/cms/import/run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          fileType,
          mapping,
          rows,
          options: { createAsDrafts: true, updateExisting },
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`)

      const summaryLines = [
        `${data.createdCount} creados`,
        `${data.updatedCount} actualizados`,
        `${data.skippedCount} duplicados omitidos`,
        `${data.reviewCount} requieren revisión`,
        `${data.warningCount || 0} con advertencias`,
        `${data.errorCount} con error`,
      ]
      const warningLines = (data.warnings || [])
        .slice(0, 20)
        .map((item: { row: number; message: string }) => `Fila ${item.row}: ${item.message}`)
      const errorLines = (data.errors || [])
        .slice(0, 20)
        .map((item: { row: number; message: string }) => `Fila ${item.row}: ${item.message}`)
      setResults([...summaryLines, ...warningLines, ...errorLines])
      onComplete?.()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "No se pudo importar.")
    } finally {
      setStatus("done")
    }
  }

  if (!open) return null

  return createPortal(
    <div className="vehicle-import-modal" role="dialog" aria-modal="true" aria-label="Importar inventario">
      <button className="vehicle-import-modal__backdrop" onClick={onClose} type="button" />
      <div className="vehicle-import-modal__panel">
        <header className="vehicle-import-modal__header">
          <div>
            <p>Centro de importación</p>
            <h2>Importar inventario (XLSX / CSV)</h2>
          </div>
          <button aria-label="Cerrar importación" onClick={onClose} type="button">
            ×
          </button>
        </header>

        <div className="vehicle-import-modal__body">
          <section className="vehicle-import-upload">
            <input
              accept=".csv,.xlsx,text/csv"
              className="vehicle-import-upload__input"
              onChange={handleFile}
              ref={fileInputRef}
              type="file"
            />
            <button onClick={() => fileInputRef.current?.click()} type="button">
              {fileName ? "Cambiar archivo" : "Subir archivo"}
            </button>
            <div>
              <strong>{fileName || "Ningún archivo seleccionado"}</strong>
              <span>
                {headers.length
                  ? `${headers.length} columnas, ${rows.length} filas. Formato detectado: ${fileType.toUpperCase()}.`
                  : "Soporta .xlsx y .csv. Se autocompletará el mapeo TIPO / IDV / DES_*."}
              </span>
            </div>
          </section>

          {error ? <p className="user-invite-result user-invite-result--error">{error}</p> : null}

          {headers.length ? (
            <div className="vehicle-import-grid vehicle-import-grid--mapping-only">
              <section>
                <div className="vehicle-import-section-title">
                  <h3>Mapeo de columnas</h3>
                  <span>Marca y Modelo son obligatorios. Los vehículos se crean como borradores.</span>
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
          <label style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(event) => setUpdateExisting(event.target.checked)}
            />
            Actualizar duplicados existentes
          </label>
          <button disabled={!headers.length || status === "importing"} onClick={resetImport} type="button">
            Limpiar
          </button>
          <button onClick={onClose} type="button">
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
}
