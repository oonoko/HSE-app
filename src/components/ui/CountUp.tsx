'use client'

import { useEffect, useRef, useState } from 'react'
import { countUpValue, prefersReducedMotion } from '@/lib/motion'

// Counts from the previously shown number (0 on first paint) to `value`.
export default function CountUp({ value, duration = 900, format = (n: number) => n.toLocaleString() }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  const from = useRef(prefersReducedMotion() ? value : 0)

  useEffect(() => {
    if (prefersReducedMotion() || from.current === value) { setShown(value); from.current = value; return }
    const start = performance.now(), origin = from.current
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setShown(countUpValue(origin, value, progress))
      if (progress < 1) frame = requestAnimationFrame(tick); else from.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{format(shown)}</>
}
