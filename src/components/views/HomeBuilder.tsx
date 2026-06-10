'use client'

import React, { useCallback } from 'react'

import SectionBuilder, { type Section } from '../admin-ui/SectionBuilder'
import { SITE_SECTION_LIBRARY } from '../admin-ui/sectionLibraries'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

type GlobalHome = {
  home?: { sections?: Section[] } | null
}

export default function HomeBuilder() {
  const load = useCallback(async () => {
    const res = await fetch('/api/globals/site-config?depth=0', { credentials: 'include' })
    if (!res.ok) throw new Error('No se pudo cargar la configuración del sitio.')
    const data = (await res.json()) as GlobalHome
    return { sections: data.home?.sections || [] }
  }, [])

  const save = useCallback(async (sections: Section[]) => {
    const res = await fetch('/api/globals/site-config', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ home: { sections } }),
    })
    if (!res.ok) {
      const detail = await res.text()
      throw new Error(`No se pudo guardar la portada. ${detail.slice(0, 180)}`)
    }
  }, [])

  return (
    <SectionBuilder
      title="Constructor de portada"
      subtitle="Arma la página principal con secciones visuales. Los cambios se publican al guardar."
      previewUrl={FRONTEND_URL}
      library={SITE_SECTION_LIBRARY}
      load={load}
      save={save}
      deepEditHref="/admin/globals/site-config"
    />
  )
}
