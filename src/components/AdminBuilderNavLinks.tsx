'use client'

import { usePathname } from 'next/navigation'

/**
 * Curated admin sidebar links. Raw Payload collection routes remain reachable
 * directly, but the visible nav focuses on the daily CMS workflows.
 */
export default function AdminBuilderNavLinks() {
  const pathname = usePathname()
  const isActive = (href: string) => {
    if (href === '/admin/inventory') {
      return pathname.startsWith('/admin/inventory') || pathname.startsWith('/admin/collections/vehicles')
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const link = (href: string, label: string, icon: string) => (
    <a aria-current={isActive(href) ? 'page' : undefined} data-icon={icon} href={href}>
      {label}
    </a>
  )

  return (
    <div className="admin-builder-nav">
      <div className="admin-builder-nav__group">
        <span className="admin-builder-nav__label">Operación</span>
        {link('/admin/inventory', 'Inventario', 'dashboard')}
        {link('/admin/collections/leads', 'Leads', 'users')}
      </div>

      <div className="admin-builder-nav__group">
        <span className="admin-builder-nav__label">Sitio</span>
        {link('/admin/builder/home', 'Constructor de portada', 'home')}
        {link('/admin/pages-builder', 'Páginas', 'page')}
        {link('/admin/collections/vehicle-collections', 'Colecciones', 'layers')}
        {link('/admin/builder/vehicle-template', 'Plantilla de vehículos', 'car')}
      </div>

      <div className="admin-builder-nav__group">
        <span className="admin-builder-nav__label">Configuración</span>
        {link('/admin/collections/dealerships', 'Agencias', 'building')}
        {link('/admin/collections/users', 'Usuarios', 'profile')}
        {link('/admin/collections/vehicle-tags', 'Tags de vehículos', 'tag')}
      </div>
    </div>
  )
}
