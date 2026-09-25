'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'

export default function BottomNav() {
  const { isAdmin } = useApp()
  const pathname = usePathname()
  const driverItems = [
    { href: '/', icon: 'clipboard' as const, label: 'Өнөөдөр' },
    { href: '/games', icon: 'game' as const, label: 'Тоглоом' },
    { href: '/leaderboard', icon: 'trophy' as const, label: 'Оноо' },
    { href: '/profile', icon: 'user' as const, label: 'Профайл' },
  ]
  const adminItems = [
    { href: '/admin/quizzes', icon: 'clipboard' as const, label: 'Асуумж' },
    { href: '/admin/games', icon: 'game' as const, label: 'Тоглоом' },
    { href: '/admin/dashboard', icon: 'dashboard' as const, label: 'Dashboard' },
    { href: '/admin/reports', icon: 'trophy' as const, label: 'Тайлан' },
    { href: '/admin/my-shift', icon: 'shift' as const, label: 'Ээлж' },
  ]
  const items = isAdmin ? adminItems : driverItems
  return (
    <nav className="bottom-nav">
      {items.map(item => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return <Link key={item.href} href={item.href} className={`bottom-nav-item ${active ? 'active' : ''}`}><Icon name={item.icon} /><span>{item.label}</span></Link>
      })}
    </nav>
  )
}
