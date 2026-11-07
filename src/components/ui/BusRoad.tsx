'use client'

import { useRef, useState } from 'react'
import { haptics } from '@/lib/motion'
import BusArt from '@/components/ui/BusArt'

// The bus drives through the Gobi: it stays put and bobs while dunes, tufts and clouds scroll past.
// Tap the bus to honk.
export default function BusRoad({ tone = 'light', caption }: { tone?: 'light' | 'dark'; caption?: string }) {
  const [honking, setHonking] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function honk() {
    haptics.success()
    setHonking(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setHonking(false), 900)
  }

  return <div className={`bus-scene ${tone} ${honking ? 'honking' : ''}`}>
    <svg viewBox="0 0 400 130" role="img" aria-label="Автобус цөлөөр явж байна" preserveAspectRatio="xMidYMid meet">
      <g className="bus-cloud c1"><ellipse cx="40" cy="26" rx="30" ry="9" /><ellipse cx="66" cy="20" rx="20" ry="9" /><ellipse cx="22" cy="22" rx="16" ry="7" /></g>
      <g className="bus-cloud c2"><ellipse cx="260" cy="38" rx="24" ry="7" /><ellipse cx="282" cy="33" rx="15" ry="7" /></g>
      <g className="bus-dunes"><path d="M0 100Q40 70 90 90T190 84T290 92T400 78L400 104L0 104Z" /><path transform="translate(400 0)" d="M0 100Q40 70 90 90T190 84T290 92T400 78L400 104L0 104Z" /></g>
      <rect className="bus-ground" x="0" y="98" width="400" height="32" />
      <rect className="bus-track" x="0" y="110" width="400" height="14" />
      <g className="bus-tufts">{[10, 70, 140, 190, 260, 330, 380, 440, 510].map((x, i) => <g key={x} transform={`translate(${x} ${101 + (i % 3)})`}><path d="M0 0l-2-7M0 0l1-8M0 0l3-6" /></g>)}</g>
      <line className="bus-dash" x1="0" y1="117" x2="460" y2="117" />
      <g className="bus-puffs">{[0, 1, 2].map(i => <circle key={i} className={`bus-puff p${i}`} cx="106" cy="108" r="6" />)}</g>
      <g className="bus-body" onClick={honk} style={{ cursor: 'pointer' }}>
        <g transform="translate(100 44) scale(1.06)"><BusArt /></g>
      </g>
    </svg>
    {honking && <span className="bus-honk" aria-hidden="true">Бип бип!</span>}
    {caption && <p className="bus-caption">{caption}</p>}
  </div>
}
