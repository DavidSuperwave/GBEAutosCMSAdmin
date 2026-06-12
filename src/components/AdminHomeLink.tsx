'use client'

import { usePathname } from 'next/navigation'

export default function AdminHomeLink() {
  const pathname = usePathname()

  return (
    <div className="prisma-admin-home-link">
      <div className="admin-sidebar-brand">
        <span className="admin-sidebar-brand__mark">GBE</span>
        <span className="admin-sidebar-brand__greeting">
          <small>Buen día</small>
          <strong>Admin</strong>
        </span>
      </div>
      <span className="admin-builder-nav__label">Overview</span>
      <a aria-current={pathname === '/admin' ? 'page' : undefined} data-icon="dashboard" href="/admin">
        Dashboard
      </a>
    </div>
  )
}
