'use client'

import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import type { User } from '../payload-types'

export default function AdminHomeLink() {
  const pathname = usePathname()
  const { user } = useAuth<User>()
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const { date, dayTime } = useMemo(() => {
    if (!now) {
      return {
        date: '',
        dayTime: '',
      }
    }

    const day = new Intl.DateTimeFormat('es-MX', { weekday: 'long' }).format(now)
    const time = new Intl.DateTimeFormat('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(now)

    return {
      date: new Intl.DateTimeFormat('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now),
      dayTime: `${day}, ${time}`,
    }
  }, [now])

  const displayName = user?.name || user?.email || 'Admin'

  return (
    <div className="prisma-admin-home-link">
      <div className="admin-sidebar-status" aria-label="Sesion actual">
        <strong>{dayTime || 'Sesion activa'}</strong>
        <span>{date || 'GBE Autos CMS'}</span>
        <strong>{displayName}</strong>
      </div>
      <span className="admin-builder-nav__label">Overview</span>
      <Link aria-current={pathname === '/admin' ? 'page' : undefined} data-icon="dashboard" href="/admin">
        Dashboard
      </Link>
    </div>
  )
}
