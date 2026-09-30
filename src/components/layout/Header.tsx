'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import Icon from '@/components/ui/Icon'
import { shiftLabel } from '@/lib/shifts'

export default function Header() {
  const { user, logout } = useApp()
  const router = useRouter()
  function handleLogout() { logout(); router.push('/login') }

  return (
    <header className="app-header">
      <div className="header-brand">
        <Image src="/brand/logo.jpg" alt="Ханбогд Хурд" width={48} height={48} className="header-logo" />
        <div><strong>HSE Safety</strong><span>{user?.role === 'admin' ? (user.is_super_admin ? 'Ерөнхий HSE удирдлага' : `${shiftLabel(user.shift_number)} · HSE`) : `Жолооч · ${shiftLabel(user?.shift_number)}`}</span></div>
      </div>
      <div className="header-user">
        <div><strong>{user?.name}</strong><span>SAP {user?.sap_id}</span></div>
        <button className="icon-button" onClick={handleLogout} title="Гарах"><Icon name="logout" size={20} /></button>
      </div>
    </header>
  )
}
