import type { DriverReport, Trend, TopicStat } from '@/lib/driver-report'

export type ShiftDriverReport = {
  driver: { id: string; sap_id: string; name: string; shift_number: number | null; total_score: number }
  rank: number | null
  report: DriverReport
}

export const LOW_QUIZ_PERCENT = 60

export function attentionReasons(report: DriverReport): string[] {
  const reasons: string[] = []
  if (report.quizSummary.count === 0 && report.gameSummary.plays === 0) return ['Асуумж өгөөгүй, тоглоом тоглоогүй']
  if (report.quizzes.some(entry => entry.status === 'locked')) reasons.push('Сургалтын шалгалт түгжигдсэн (ахин сургалтад суух)')
  if (report.quizzes.some(entry => entry.status === 'failed')) reasons.push('Сургалтын шалгалтад тэнцээгүй, дахин оролдох боломжтой')
  if (report.overall === 'declined') reasons.push('Үр дүн муудсан')
  if (report.quizSummary.count > 0 && report.quizSummary.avgPercent < LOW_QUIZ_PERCENT) reasons.push(`Дундаж зөв хариулт ${LOW_QUIZ_PERCENT}%-иас бага`)
  return reasons
}

export function verdictCounts(rows: ShiftDriverReport[]): Record<Trend, number> {
  const counts: Record<Trend, number> = { improved: 0, stable: 0, declined: 0, unknown: 0 }
  for (const row of rows) counts[row.report.overall] += 1
  return counts
}

// Sums every driver's answers per topic, so the percentage is over all answers given, not an average of averages.
export function groupTopics(rows: ShiftDriverReport[]): Array<TopicStat & { drivers: number }> {
  const map = new Map<string, { answered: number; correct: number; drivers: number }>()
  for (const row of rows) {
    for (const topic of row.report.topics) {
      const stat = map.get(topic.topic) ?? { answered: 0, correct: 0, drivers: 0 }
      stat.answered += topic.answered; stat.correct += topic.correct; stat.drivers += 1
      map.set(topic.topic, stat)
    }
  }
  return [...map.entries()].map(([topic, stat]) => ({ topic, ...stat, percent: stat.answered ? Math.round((stat.correct / stat.answered) * 100) : 0 })).sort((a, b) => a.percent - b.percent)
}

export function groupGames(rows: ShiftDriverReport[]): Array<{ title: string; players: number; plays: number; repeaters: number; avgFirst: number; avgLatest: number; improved: number; declined: number }> {
  const map = new Map<string, Array<DriverReport['games'][number]>>()
  for (const row of rows) for (const game of row.report.games) map.set(game.title, [...(map.get(game.title) ?? []), game])
  const avg = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0)
  return [...map.entries()].map(([title, list]) => {
    const again = list.filter(game => game.plays >= 2)
    return {
      title, players: list.length, plays: list.reduce((sum, game) => sum + game.plays, 0), repeaters: again.length,
      avgFirst: avg(again.map(game => game.first)), avgLatest: avg(again.map(game => game.latest)),
      improved: list.filter(game => game.status === 'improved').length, declined: list.filter(game => game.status === 'declined').length,
    }
  }).sort((a, b) => b.plays - a.plays)
}
