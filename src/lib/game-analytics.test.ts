import { describe, expect, it } from 'vitest'
import { analyzeGame, progressStatus } from './game-analytics'

const drivers = [
  { id: 'a', sap_id: '1', name: 'Ану', shift_number: 1 },
  { id: 'b', sap_id: '2', name: 'Бат', shift_number: 1 },
  { id: 'c', sap_id: '3', name: 'Цэцэг', shift_number: 2 },
  { id: 'd', sap_id: '4', name: 'Дорж', shift_number: 2 },
]
const play = (user_id: string, score: number, played_at: string, duration_seconds = 60) => ({ user_id, score, played_at, duration_seconds })

describe('progressStatus', () => {
  it('needs two plays and a 10% move', () => {
    expect(progressStatus(1, 500, 900)).toBe('single')
    expect(progressStatus(2, 500, 560)).toBe('improved')
    expect(progressStatus(2, 500, 540)).toBe('stable')
    expect(progressStatus(2, 500, 440)).toBe('declined')
    expect(progressStatus(2, 0, 100)).toBe('improved')
  })
})

describe('analyzeGame', () => {
  const attempts = [
    play('a', 500, '2026-09-17T03:00:00Z'), play('a', 1400, '2026-10-01T03:00:00Z'),
    play('b', 1400, '2026-09-17T03:00:00Z'), play('b', 1000, '2026-09-17T05:00:00Z'), play('b', 1000, '2026-10-08T03:00:00Z'),
    play('c', 700, '2026-09-17T04:00:00Z'),
    play('ghost', 999, '2026-09-17T04:00:00Z'),
  ]
  const result = analyzeGame(attempts, drivers, 1500)

  it('counts only known drivers and who has not played', () => {
    expect(result.totals).toMatchObject({ drivers: 4, players: 3, notPlayed: 1, plays: 6 })
  })

  it('compares first and latest play per driver in time order', () => {
    const a = result.drivers.find(d => d.id === 'a')!
    expect(a).toMatchObject({ plays: 2, first: 500, latest: 1400, best: 1400, change: 900, changePercent: 180, status: 'improved' })
    const b = result.drivers.find(d => d.id === 'b')!
    expect(b).toMatchObject({ plays: 3, first: 1400, latest: 1000, best: 1400, change: -400, status: 'declined' })
    expect(result.drivers.find(d => d.id === 'c')!.status).toBe('single')
    expect(result.drivers[0].id).toBe('a')
  })

  it('summarises progress over repeat players only', () => {
    expect(result.progress).toMatchObject({ repeaters: 2, improved: 1, declined: 1, single: 1, avgFirst: 950, avgLatest: 1200, avgChange: 250 })
  })

  it('builds a per-day timeline in Mongolia time', () => {
    expect(result.timeline.map(point => [point.date, point.plays])).toEqual([['2026-09-17', 4], ['2026-10-01', 1], ['2026-10-08', 1]])
    expect(result.timeline[0].avgScore).toBe(900)
  })

  it('compares shifts', () => {
    expect(result.shifts.find(s => s.shift === 1)).toMatchObject({ players: 2, repeaters: 2, avgFirst: 950, avgLatest: 1200, change: 250 })
    expect(result.shifts.find(s => s.shift === 2)).toMatchObject({ players: 1, repeaters: 0 })
  })

  it('handles no plays', () => {
    const empty = analyzeGame([], drivers)
    expect(empty.totals.players).toBe(0)
    expect(empty.timeline).toEqual([])
  })
})
