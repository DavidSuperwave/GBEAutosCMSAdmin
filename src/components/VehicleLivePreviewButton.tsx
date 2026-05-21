"use client"

import React, { useEffect, useState } from "react"

export default function VehicleLivePreviewButton() {
  const [href, setHref] = useState("")

  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/$/, "")
    if (!pathname || pathname.endsWith("/preview")) return
    setHref(`${pathname}/preview`)
  }, [])

  if (!href) return null

  return (
    <a className="btn btn--style-secondary btn--size-medium" href={href}>
      Vista previa en vivo
    </a>
  )
}
