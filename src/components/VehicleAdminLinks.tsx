"use client"

import React from "react"
import { useField } from "@payloadcms/ui"

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"

export default function VehicleAdminLinks() {
  const slug = useField<string>({ path: "slug" })
  const href = slug.value ? `${FRONTEND_URL}/cars/${slug.value}` : ""

  async function copyLink() {
    if (!href) return
    await navigator.clipboard.writeText(href)
  }

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        margin: "0 0 24px",
      }}
    >
      {href ? (
        <>
          <a href={href} rel="noreferrer" target="_blank">
            Abrir pagina publica
          </a>
          <button onClick={copyLink} type="button">
            Copiar enlace
          </button>
          <code>{href}</code>
        </>
      ) : (
        <p style={{ margin: 0 }}>Guarda el vehículo para generar su enlace público.</p>
      )}
    </div>
  )
}
