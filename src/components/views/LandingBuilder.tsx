'use client'

import React, { useCallback, useEffect, useState } from 'react'

import SectionBuilder, { type Section } from '../admin-ui/SectionBuilder'
import { SITE_SECTION_LIBRARY } from '../admin-ui/sectionLibraries'
import { ActionButton, StatusBadge } from '../admin-ui/kit'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'
const PROTECTED_SLUGS = ['api', 'cars', 'seminuevos', 'marcas', 'contacts', 'contact', 'contacto', 'admin']

type PageDoc = {
  id: string | number
  title?: string
  slug?: string
  status?: 'draft' | 'published' | 'archived'
  isVisible?: boolean
  showInNavigation?: boolean
  navLabel?: string
  navParent?: string
  seo?: { title?: string; description?: string } | null
  sections?: Section[]
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function LandingBuilder() {
  const [pages, setPages] = useState<PageDoc[]>([])
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [meta, setMeta] = useState<PageDoc | null>(null)
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'reserved' | 'empty'>('idle')
  const [savingMeta, setSavingMeta] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)

  const loadPages = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/pages?limit=200&depth=0&sort=title', { credentials: 'include' })
      if (!res.ok) throw new Error('No se pudo cargar la lista de páginas.')
      const data = (await res.json()) as { docs: PageDoc[] }
      setPages(data.docs || [])
      if (!selectedId && data.docs?.length) setSelectedId(data.docs[0].id)
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : 'Error al cargar páginas.')
    } finally {
      setLoadingList(false)
    }
  }, [selectedId])

  useEffect(() => {
    void loadPages()
  }, [loadPages])

  useEffect(() => {
    if (selectedId === null) {
      setMeta(null)
      return
    }
    let active = true
    void (async () => {
      const res = await fetch(`/api/pages/${selectedId}?depth=0`, { credentials: 'include' })
      if (!res.ok) return
      const data = (await res.json()) as PageDoc
      if (active) setMeta(data)
    })()
    return () => {
      active = false
    }
  }, [selectedId])

  const loadSections = useCallback(async () => {
    if (selectedId === null) return { sections: [] as Section[] }
    const res = await fetch(`/api/pages/${selectedId}?depth=0`, { credentials: 'include' })
    if (!res.ok) throw new Error('No se pudo cargar la página.')
    const data = (await res.json()) as PageDoc
    return { sections: data.sections || [] }
  }, [selectedId])

  const saveSections = useCallback(
    async (sections: Section[]) => {
      if (selectedId === null) throw new Error('Selecciona una página primero.')
      const res = await fetch(`/api/pages/${selectedId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudo guardar. ${detail.slice(0, 180)}`)
      }
    },
    [selectedId],
  )

  const checkSlug = useCallback(
    async (slug: string) => {
      if (!slug) {
        setSlugStatus('empty')
        return
      }
      if (PROTECTED_SLUGS.includes(slug)) {
        setSlugStatus('reserved')
        return
      }
      setSlugStatus('checking')
      const res = await fetch(
        `/api/pages?where[slug][equals]=${encodeURIComponent(slug)}&depth=0&limit=1`,
        { credentials: 'include' },
      )
      if (!res.ok) {
        setSlugStatus('idle')
        return
      }
      const data = (await res.json()) as { docs: PageDoc[] }
      const conflict = (data.docs || []).some((doc) => String(doc.id) !== String(selectedId))
      setSlugStatus(conflict ? 'taken' : 'ok')
    },
    [selectedId],
  )

  const createPage = useCallback(async () => {
    const title = window.prompt('Título de la nueva página landing:')
    if (!title) return
    const slug = slugify(title) || `pagina-${Date.now()}`
    const res = await fetch('/api/pages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, slug, status: 'draft', isVisible: false, sections: [] }),
    })
    if (!res.ok) {
      const detail = await res.text()
      setMetaError(`No se pudo crear la página. ${detail.slice(0, 180)}`)
      return
    }
    const data = (await res.json()) as { doc: PageDoc }
    await loadPages()
    if (data.doc?.id) setSelectedId(data.doc.id)
  }, [loadPages])

  const saveMeta = useCallback(async () => {
    if (!meta || selectedId === null) return
    setSavingMeta(true)
    setMetaError(null)
    try {
      const res = await fetch(`/api/pages/${selectedId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meta.title,
          slug: meta.slug,
          status: meta.status || (meta.isVisible ? 'published' : 'draft'),
          isVisible: meta.isVisible,
          showInNavigation: meta.showInNavigation,
          navLabel: meta.navLabel,
          navParent: meta.navParent,
          seo: meta.seo || {},
        }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(`No se pudo guardar la configuración. ${detail.slice(0, 180)}`)
      }
      await loadPages()
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSavingMeta(false)
    }
  }, [meta, selectedId, loadPages])

  const patchSelected = useCallback(
    async (patch: Partial<PageDoc>, success: string) => {
      if (selectedId === null) return
      setSavingMeta(true)
      setMetaError(null)
      try {
        const res = await fetch(`/api/pages/${selectedId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error((await res.text()).slice(0, 180))
        await loadPages()
        const fresh = await fetch(`/api/pages/${selectedId}?depth=0`, { credentials: 'include' })
        if (fresh.ok) setMeta((await fresh.json()) as PageDoc)
        setMetaError(success)
      } catch (err) {
        setMetaError(err instanceof Error ? err.message : 'No se pudo actualizar la pagina.')
      } finally {
        setSavingMeta(false)
      }
    },
    [selectedId, loadPages],
  )

  const duplicatePage = useCallback(async () => {
    if (!meta) return
    const title = `${meta.title || 'Pagina'} copia`
    const slug = `${slugify(meta.slug || meta.title || 'pagina')}-copia-${Date.now().toString().slice(-4)}`
    const res = await fetch('/api/pages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        slug,
        status: 'draft',
        isVisible: false,
        seo: meta.seo || {},
        sections: meta.sections || [],
      }),
    })
    if (!res.ok) {
      setMetaError(`No se pudo duplicar. ${(await res.text()).slice(0, 180)}`)
      return
    }
    const data = (await res.json()) as { doc?: PageDoc }
    await loadPages()
    if (data.doc?.id) setSelectedId(data.doc.id)
  }, [meta, loadPages])

  const deletePage = useCallback(async () => {
    if (selectedId === null) return
    if (!window.confirm('Eliminar esta pagina? Esta accion no se puede deshacer.')) return
    const res = await fetch(`/api/pages/${selectedId}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) {
      setMetaError(`No se pudo eliminar. ${(await res.text()).slice(0, 180)}`)
      return
    }
    setSelectedId(null)
    setMeta(null)
    await loadPages()
  }, [selectedId, loadPages])

  const previewUrl = meta?.slug ? `${FRONTEND_URL}/${meta.slug}` : FRONTEND_URL

  const seoPanel = (
    <div className="builder__panel">
      <div className="builder__col-head">
        <strong>Paginas</strong>
        <button className="admin-kit-btn admin-kit-btn--secondary" type="button" onClick={() => void createPage()}>
          + Nueva
        </button>
      </div>
      <select
        className="builder__select"
        value={selectedId === null ? '' : String(selectedId)}
        onChange={(e) => setSelectedId(e.target.value || null)}
      >
        {loadingList ? <option>Cargando…</option> : null}
        {pages.map((page) => (
          <option key={String(page.id)} value={String(page.id)}>
            {page.title || '(sin titulo)'} {page.status === 'published' || page.isVisible ? '' : ' - borrador'}
          </option>
        ))}
      </select>

      {meta ? (
        <div className="builder__seo">
          <label className="builder__field">
            <span>Título</span>
            <input
              type="text"
              value={meta.title || ''}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            />
          </label>
          <label className="builder__field">
            <span>Slug (URL)</span>
            <input
              type="text"
              value={meta.slug || ''}
              onChange={(e) => setMeta({ ...meta, slug: slugify(e.target.value) })}
              onBlur={(e) => void checkSlug(slugify(e.target.value))}
            />
          </label>
          <div className="builder__slug-status">
            {slugStatus === 'checking' && <StatusBadge tone="info">Verificando…</StatusBadge>}
            {slugStatus === 'ok' && <StatusBadge tone="success">Slug disponible</StatusBadge>}
            {slugStatus === 'taken' && <StatusBadge tone="danger">Slug en uso</StatusBadge>}
            {slugStatus === 'reserved' && <StatusBadge tone="danger">Ruta reservada</StatusBadge>}
            {slugStatus === 'empty' && <StatusBadge tone="warning">Slug requerido</StatusBadge>}
            <small className="builder__muted">/{meta.slug || ''}</small>
          </div>
          <label className="builder__field builder__field--check">
            <input
              type="checkbox"
              checked={Boolean(meta.isVisible)}
              onChange={(e) => setMeta({ ...meta, isVisible: e.target.checked })}
            />
            <span>Visible en el sitio (publicada)</span>
          </label>
          <label className="builder__field">
            <span>Estatus</span>
            <select
              value={meta.status || (meta.isVisible ? 'published' : 'draft')}
              onChange={(e) =>
                setMeta({
                  ...meta,
                  status: e.target.value as PageDoc['status'],
                  isVisible: e.target.value === 'published',
                })
              }
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </label>
          <label className="builder__field builder__field--check">
            <input
              type="checkbox"
              checked={Boolean(meta.showInNavigation)}
              onChange={(e) => setMeta({ ...meta, showInNavigation: e.target.checked })}
            />
            <span>Mostrar en navegacion</span>
          </label>
          <label className="builder__field">
            <span>Etiqueta nav</span>
            <input
              type="text"
              value={meta.navLabel || ''}
              onChange={(e) => setMeta({ ...meta, navLabel: e.target.value })}
              placeholder={meta.title || 'Etiqueta'}
            />
          </label>
          <label className="builder__field">
            <span>Grupo padre nav</span>
            <input
              type="text"
              value={meta.navParent || ''}
              onChange={(e) => setMeta({ ...meta, navParent: e.target.value })}
              placeholder="Opcional"
            />
          </label>
          <label className="builder__field">
            <span>SEO · Título</span>
            <input
              type="text"
              value={meta.seo?.title || ''}
              onChange={(e) => setMeta({ ...meta, seo: { ...meta.seo, title: e.target.value } })}
            />
          </label>
          <label className="builder__field">
            <span>SEO · Descripción</span>
            <textarea
              rows={3}
              value={meta.seo?.description || ''}
              onChange={(e) => setMeta({ ...meta, seo: { ...meta.seo, description: e.target.value } })}
            />
          </label>
          {metaError ? <div className="builder__error">{metaError}</div> : null}
          <ActionButton variant="primary" onClick={() => void saveMeta()} disabled={savingMeta}>
            {savingMeta ? 'Guardando…' : 'Guardar configuración y SEO'}
          </ActionButton>
          <div className="builder__quick-actions">
            <ActionButton
              variant="secondary"
              disabled={savingMeta}
              onClick={() => void patchSelected({ status: 'published', isVisible: true }, 'Pagina publicada.')}
            >
              Publicar
            </ActionButton>
            <ActionButton
              variant="secondary"
              disabled={savingMeta}
              onClick={() => void patchSelected({ status: 'draft', isVisible: false }, 'Pagina movida a borrador.')}
            >
              Borrador
            </ActionButton>
            <ActionButton
              variant="secondary"
              disabled={savingMeta}
              onClick={() => void patchSelected({ status: 'archived', isVisible: false }, 'Pagina archivada.')}
            >
              Archivar
            </ActionButton>
            <ActionButton variant="secondary" disabled={savingMeta} onClick={() => void duplicatePage()}>
              Duplicar
            </ActionButton>
            <ActionButton variant="danger" disabled={savingMeta} onClick={() => void deletePage()}>
              Eliminar
            </ActionButton>
          </div>
        </div>
      ) : (
        <p className="builder__muted">Selecciona o crea una página para editar su contenido.</p>
      )}
    </div>
  )

  if (selectedId === null) {
    return (
      <div className="admin-kit-shell builder">
        <div className="builder__grid builder__grid--single">{seoPanel}</div>
      </div>
    )
  }

  return (
    <SectionBuilder
      key={String(selectedId)}
      title="Paginas del sitio"
      subtitle="Crea, publica, previsualiza y enlaza paginas con el constructor visual."
      previewUrl={previewUrl}
      library={SITE_SECTION_LIBRARY}
      load={loadSections}
      save={saveSections}
      deepEditHref={`/admin/collections/pages/${selectedId}`}
      asideTop={seoPanel}
    />
  )
}
