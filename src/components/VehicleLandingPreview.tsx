"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useAllFormFields, useField } from "@payloadcms/ui"
import { reduceFieldsToValues } from "payload/shared"

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"

type PreviewMessage = {
  collectionSlug: "vehicles"
  data: Record<string, unknown>
  type: "payload-live-preview"
}

export default function VehicleLandingPreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const retryTimerRef = useRef<number | null>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [iframeError, setIframeError] = useState(false)
  const [formEventCount, setFormEventCount] = useState(0)
  const [previewKey, setPreviewKey] = useState(0)
  const [fields] = useAllFormFields()
  const slug = useField<string>({ path: "slug" })

  const publicUrl = slug.value ? `${FRONTEND_URL}/cars/${slug.value}` : FRONTEND_URL
  const frontendOrigin = useMemo(() => new URL(FRONTEND_URL).origin, [])
  const canPreview = Boolean(slug.value)
  const data = useMemo(() => {
    const payloadData = reduceFieldsToValues(fields, true)
    return mergeDeep(payloadData, getVisibleFormValues())
  }, [fields, formEventCount])

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(".collection-edit__form")
    if (!form) return undefined

    let frame = 0
    const handleFormChange = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => setFormEventCount((count) => count + 1))
    }

    form.addEventListener("input", handleFormChange)
    form.addEventListener("change", handleFormChange)

    return () => {
      window.cancelAnimationFrame(frame)
      form.removeEventListener("input", handleFormChange)
      form.removeEventListener("change", handleFormChange)
    }
  }, [])

  useEffect(() => {
    if (!canPreview) return undefined

    const message: PreviewMessage = {
      collectionSlug: "vehicles",
      data,
      type: "payload-live-preview",
    }

    const sendPreviewData = () => {
      iframeRef.current?.contentWindow?.postMessage(message, frontendOrigin)
    }

    sendPreviewData()
    if (retryTimerRef.current) window.clearInterval(retryTimerRef.current)

    let attempts = 0
    retryTimerRef.current = window.setInterval(() => {
      attempts += 1
      sendPreviewData()

      if (attempts >= 8 && retryTimerRef.current) {
        window.clearInterval(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }, 350)

    return () => {
      if (retryTimerRef.current) {
        window.clearInterval(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [canPreview, data, frontendOrigin, iframeReady])

  useEffect(() => {
    setIframeLoading(canPreview)
    setIframeError(false)
  }, [canPreview, publicUrl, previewKey])

  return (
    <section className="vehicle-live-preview">
      <div className="vehicle-live-preview__header">
        <div>
          <h3>Vista previa de landing</h3>
          <p>Se actualiza con los cambios del formulario antes de publicar.</p>
        </div>
        <div className="vehicle-live-preview__actions">
          <button disabled={!canPreview} onClick={() => setPreviewKey((key) => key + 1)} type="button">
            Recargar
          </button>
          {canPreview ? (
            <a href={publicUrl} rel="noreferrer" target="_blank">
              Abrir pagina publica
            </a>
          ) : null}
        </div>
      </div>

      <div className="vehicle-live-preview__frame-wrap">
        {!canPreview ? (
          <div className="vehicle-live-preview__empty">Guarda el vehiculo para generar su landing.</div>
        ) : (
          <>
            {iframeLoading ? <div className="vehicle-live-preview__status">Cargando vista previa...</div> : null}
            {iframeError ? (
              <div className="vehicle-live-preview__status vehicle-live-preview__status--error">
                No se pudo cargar la landing. Revisa que el frontend este corriendo en {FRONTEND_URL}.
              </div>
            ) : null}
            <iframe
              className="vehicle-live-preview__frame"
              key={`${publicUrl}-${previewKey}`}
              onError={() => {
                setIframeError(true)
                setIframeLoading(false)
              }}
              onLoad={() => {
                setIframeError(false)
                setIframeLoading(false)
                setIframeReady((ready) => !ready)
              }}
              ref={iframeRef}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              src={publicUrl}
              title="Vista previa de landing del vehiculo"
            />
          </>
        )}
      </div>
    </section>
  )
}

function getVisibleFormValues() {
  if (typeof document === "undefined") return {}

  const form = document.querySelector<HTMLFormElement>(".collection-edit__form")
  if (!form) return {}

  const data: Record<string, unknown> = {}
  const fields = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input[name], textarea[name], select[name]",
  )

  fields.forEach((field) => {
    const name = field.name
    if (!name || name.startsWith("_")) return

    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      setValueAtPath(data, name, field.checked)
      return
    }

    if (field instanceof HTMLInputElement && field.type === "radio" && !field.checked) return

    setValueAtPath(data, name, field.value)
  })

  return data
}

function setValueAtPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".")
  let current: Record<string, unknown> | unknown[] = target

  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1
    const nextPart = parts[index + 1]
    const key = Number.isInteger(Number(part)) ? Number(part) : part

    if (isLast) {
      if (Array.isArray(current) && typeof key === "number") current[key] = value
      else if (!Array.isArray(current) && typeof key === "string") current[key] = value
      return
    }

    const nextValueShouldBeArray = Number.isInteger(Number(nextPart))

    if (Array.isArray(current) && typeof key === "number") {
      current[key] ||= nextValueShouldBeArray ? [] : {}
      current = current[key] as Record<string, unknown> | unknown[]
      return
    }

    if (!Array.isArray(current) && typeof key === "string") {
      current[key] ||= nextValueShouldBeArray ? [] : {}
      current = current[key] as Record<string, unknown> | unknown[]
    }
  })
}

function mergeDeep(base: Record<string, unknown>, override: Record<string, unknown>) {
  const output = { ...base }

  Object.entries(override).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      output[key] = value
      return
    }

    if (isRecord(value) && isRecord(output[key])) {
      output[key] = mergeDeep(output[key], value)
      return
    }

    output[key] = value
  })

  return output
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
