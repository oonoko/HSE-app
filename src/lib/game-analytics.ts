import { mongoliaDate } from '@/lib/date'

export type GameAttemptLite = { user_id: string; score: number; duration_seconds: number; played_at: string }
export type DriverLite = { id: string; sap_id: string; name: string; shift_number: number | null }

export type ProgressStatus = 'improved' | 'declined' | 'stable' | 'single'

export const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  improved: 'Сайжирсан', declined: 'Муудсан', stable: 'Тогтвортой', single: 'Нэг л удаа тоглосон',
}

// A change of at least this share of the first score counts as a real move rather than noise.
export const PROGRESS_THRESHOLD_PERCENT = 10

export type DriverProgress = DriverLite & {
  plays: number
  first: number
  latest: number
  best: number
  change: number
  changePercent: number
  status: ProgressStatus
  firstAt: string
  latestAt: string
}

export type TimelinePoint = { date: string; plays: number; players: number; avgScore: number; avgDuration: number }
export type ShiftProgress = { shift: number | null; players: number; plays: number; repeaters: number; avgFirst: number; avgLatest: number; change: number }

export type GameAnalysis = {
  totals: { drivers: number; players: number; notPlayed: number; plays: number; avgScore: number; avgDuration: number; maxScore: number | null }
  progress: { repeaters: number; improved: number; declined: number; stable: number; single: number; avgFirst: number; avgLatest: number; avgBest: number; avgChange: number }
  timeline: TimelinePoint[]
  drivers: DriverProgress[]
  shifts: ShiftProgress[]
}

const avg = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0)

export function progressStatus(plays: number, first: number, latest: number): ProgressStatus {
  if (plays < 2) return 'single'
  const delta = latest - first
  const threshold = Math.max(1, Math.abs(first) * PROGRESS_THRESHOLD_PERCENT / 100)
  if (delta >= threshold) return 'improved'
  if (delta <= -threshold) return 'declined'
  return 'stable'
}

export function analyzeGame(attempts: GameAttemptLite[], drivers: DriverLite[], maxScore: number | null = null): GameAnalysis {
  const driverById = new Map(drivers.map(driver => [driver.id, driver]))
  const mine = attempts.filter(attempt => driverById.has(attempt.user_id)).sort((a, b) => a.played_at.localeCompare(b.played_at))

  const byUser = new Map<string, GameAttemptLite[]>()
  for (const attempt of mine) byUser.set(attempt.user_id, [...(byUser.get(attempt.user_id) ?? []), attempt])

  const progressRows: DriverProgress[] = []
  for (const [userId, list] of byUser) {
    const first = list[0], last = list[list.length - 1]
    const change = last.score - first.score
    progressRows.push({
      ...driverById.get(userId)!,
      plays: list.length, first: first.score, latest: last.score, best: Math.max(...list.map(item => item.score)),
      change, changePercent: first.score > 0 ? Math.round((change / first.score) * 100) : (change > 0 ? 100 : 0),
      status: progressStatus(list.length, first.score, last.score), firstAt: first.played_at, latestAt: last.played_at,
    })
  }
  progressRows.sort((a, b) => b.change - a.change || a.name.localeCompare(b.name))

  const repeaters = progressRows.filter(row => row.plays >= 2)
  const days = new Map<string, GameAttemptLite[]>()
  for (const attempt of mine) {
    const day = mongoliaDate(new Date(attempt.played_at))
    days.set(day, [...(days.get(day) ?? []), attempt])
  }
  const timeline: TimelinePoint[] = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({
    date, plays: list.length, players: new Set(list.map(item => item.user_id)).size,
    avgScore: avg(list.map(item => item.score)), avgDuration: avg(list.map(item => item.duration_seconds)),
  }))

  const shiftKeys = [...new Set(progressRows.map(row => row.shift_number))].sort((a, b) => (a ?? 99) - (b ?? 99))
  const shifts: ShiftProgress[] = shiftKeys.map(shift => {
    const rows = progressRows.filter(row => row.shift_number === shift)
    const again = rows.filter(row => row.plays >= 2)
    return {
      shift, players: rows.length, plays: rows.reduce((sum, row) => sum + row.plays, 0), repeaters: again.length,
      avgFirst: avg(again.map(row => row.first)), avgLatest: avg(again.map(row => row.latest)),
      change: avg(again.map(row => row.latest)) - avg(again.map(row => row.first)),
    }
  })

  const count = (status: ProgressStatus) => progressRows.filter(row => row.status === status).length
  return {
    totals: {
      drivers: drivers.length, players: progressRows.length, notPlayed: Math.max(0, drivers.length - progressRows.length),
      plays: mine.length, avgScore: avg(mine.map(item => item.score)), avgDuration: avg(mine.map(item => item.duration_seconds)), maxScore,
    },
    progress: {
      repeaters: repeaters.length, improved: count('improved'), declined: count('declined'), stable: count('stable'), single: count('single'),
      avgFirst: avg(repeaters.map(row => row.first)), avgLatest: avg(repeaters.map(row => row.latest)), avgBest: avg(repeaters.map(row => row.best)),
      avgChange: avg(repeaters.map(row => row.latest)) - avg(repeaters.map(row => row.first)),
    },
    timeline, drivers: progressRows, shifts,
  }
}
