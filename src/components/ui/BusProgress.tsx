'use client'

import { useEffect, useState } from 'react'
import BusArt from '@/components/ui/BusArt'

// Quiz progress as a journey: the bus advances one stop per question and reaches the flag at the end.
export default function BusProgress({ done, total }: { done: number; total: number }) {
  const safeTotal = Math.max(1, total)
  const fraction = Math.min(1, Math.max(0, done / safeTotal))
  const [moving, setMoving] = useState(false)

  // Wheels turn only while the bus is actually travelling to its next stop.
  useEffect(() => {
    if (done === 0) return
    setMoving(true)
    const timer = setTimeout(() => setMoving(false), 950)
    return () => clearTimeout(timer)
  }, [done])

  return <div className={`bus-progress ${moving ? 'moving' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={safeTotal} aria-valuenow={done} aria-label="Шалгалтын явц">
    <div className="bus-progress-road">
      <span className="bus-progress-trail" style={{ transform: `scaleX(${fraction})` }} />
      <div className="bus-progress-stops">{Array.from({ length: safeTotal - 1 }).map((_, i) => <i key={i} className={i + 1 <= done ? 'passed' : ''} style={{ left: `${((i + 1) / safeTotal) * 100}%` }} />)}</div>
    </div>
    <svg className="bus-progress-bus" viewBox="0 0 200 72" style={{ left: `calc((100% - 86px) * ${fraction})` }} aria-hidden="true"><BusArt /></svg>
    <svg className="bus-progress-flag" viewBox="0 0 24 36" aria-hidden="true"><path d="M4 2v32" /><path className="cloth" d="M4 3h16v12H4z" /><path className="check" d="M4 3h4v4H4zM12 3h4v4h-4zM8 7h4v4H8zM16 7h4v4h-4zM4 11h4v4H4zM12 11h4v4h-4z" /></svg>
    <span className="bus-progress-count">{Math.min(done, safeTotal)} / {safeTotal}</span>
  </div>
}
