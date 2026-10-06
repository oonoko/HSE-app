'use client'

import { useEffect, useMemo, useState } from 'react'
import { SHIFT_NUMBERS, shiftLabel } from '@/lib/shifts'

type Driver = { id: string; sap_id: string; name: string; shift_number: number | null }

export default function RosterPicker({ selected, onChange, lockedShift }: { selected: string[]; onChange: (ids: string[]) => void; lockedShift?: number | null }) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [shift, setShift] = useState<string>(lockedShift ? String(lockedShift) : '')

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => setDrivers(((data.data ?? []) as Array<Driver & { role: string }>).filter(user => user.role === 'driver'))).finally(() => setLoading(false))
  }, [])

  const chosen = useMemo(() => new Set(selected), [selected])
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return drivers.filter(driver => (!shift || String(driver.shift_number) === shift) && (!needle || driver.name.toLowerCase().includes(needle) || driver.sap_id.includes(needle)))
  }, [drivers, search, shift])
  const allVisibleChosen = visible.length > 0 && visible.every(driver => chosen.has(driver.id))

  function toggle(id: string) { onChange(chosen.has(id) ? selected.filter(item => item !== id) : [...selected, id]) }
  function toggleAllVisible() {
    if (allVisibleChosen) { const hide = new Set(visible.map(driver => driver.id)); onChange(selected.filter(id => !hide.has(id))) }
    else onChange(Array.from(new Set([...selected, ...visible.map(driver => driver.id)])))
  }

  return <div className="roster-picker">
    <div className="roster-tools">
      <input className="input-field" placeholder="Нэр эсвэл SAP хайх" value={search} onChange={e => setSearch(e.target.value)} />
      {!lockedShift && <select className="input-field" value={shift} onChange={e => setShift(e.target.value)}><option value="">Бүх ээлж</option>{SHIFT_NUMBERS.map(n => <option key={n} value={n}>{shiftLabel(n)}</option>)}</select>}
      <button type="button" className="btn-secondary" onClick={toggleAllVisible} disabled={visible.length === 0}>{allVisibleChosen ? 'Харагдаж буйг цуцлах' : 'Харагдаж буйг бүгдийг сонгох'}</button>
    </div>
    <p className="roster-count"><strong>{selected.length}</strong> хүн сонгогдсон · харагдаж буй {visible.length}</p>
    <div className="roster-list">
      {loading ? <div className="empty-state"><span className="spinner" />Ачааллаж байна...</div> : visible.length === 0 ? <p className="roster-empty">Хүн олдсонгүй</p> : visible.map(driver =>
        <label key={driver.id} className={chosen.has(driver.id) ? 'selected' : ''}>
          <input type="checkbox" checked={chosen.has(driver.id)} onChange={() => toggle(driver.id)} />
          <span><strong>{driver.name}</strong><small>SAP {driver.sap_id} · {shiftLabel(driver.shift_number)}</small></span>
        </label>)}
    </div>
  </div>
}
