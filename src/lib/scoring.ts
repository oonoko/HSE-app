export function calculatePoints(isCorrect: boolean, responseMs: number, timeLimitMs: number): number {
  if (!isCorrect || timeLimitMs <= 0) return 0
  const clampedMs = Math.max(0, Math.min(responseMs, timeLimitMs))
  return 50 + Math.ceil(((timeLimitMs - clampedMs) / timeLimitMs) * 50)
}
