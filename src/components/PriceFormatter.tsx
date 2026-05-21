"use client"

import React from "react"
import { useField } from "@payloadcms/ui"

export default function PriceFormatter() {
  const price = useField<string>({ path: "price" })

  function formatPrice() {
    price.setValue(formatMXN(price.value || ""))
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={formatPrice} type="button">
        Formatear como MXN
      </button>
      <span style={{ color: "var(--theme-elevation-600)", marginLeft: 10 }}>
        Ejemplo: 398900 se convierte en $398,900 MXN.
      </span>
    </div>
  )
}

function formatMXN(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const isRange = /[-–]/.test(trimmed)
  const parts = trimmed.split(/\s*[-–]\s*/)
  const formatted = parts
    .map((part) => {
      const numeric = Number(part.replace(/[^\d.]/g, ""))
      if (!Number.isFinite(numeric) || numeric <= 0) return part
      return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric)}`
    })
    .join(" - ")

  return `${isRange ? formatted : formatted} MXN`
}
