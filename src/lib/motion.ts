// Small helpers for motion that CSS alone can't do. Everything degrades silently:
// no vibration API (iOS Safari, desktop) or "reduce motion" simply means no effect.

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function vibrate(pattern: number | number[]) {
  try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern) } catch { /* ignore */ }
}

export const haptics = {
  tap: () => vibrate(8),
  success: () => vibrate([12, 50, 18]),
  error: () => vibrate([35, 40, 35]),
}

// Ease-out cubic: fast start, gentle landing.
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

// Value shown at `progress` (0..1) of a count-up; always lands exactly on `to`.
export function countUpValue(from: number, to: number, progress: number): number {
  if (progress >= 1) return to
  if (progress <= 0) return from
  return Math.round(from + (to - from) * easeOutCubic(progress))
}
