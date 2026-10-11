import { mongoliaDate } from '@/lib/date'
import { effectiveCorrect, participantStatus, pickFinalAttempts, type ParticipantStatus } from '@/lib/training'
import { progressStatus, type ProgressStatus } from '@/lib/game-analytics'

export type ReportQuestion = { id: string; topic?: string | null; text: string; options: Array<{ text: string }>; correct_index: number; explanation?: string }
export type QuizAttemptRecord = {
  id: string; quiz_id: string; user_id: string; attempt_number: number; completed: boolean; passed: boolean | null
  score: number; max_score: number; correct_count: number; wrong_count: number; credited_points: number | null
  started_at: string; completed_at: string | null
  quiz: { title: string; topic: string | null; active_date: string; pass_percent: number | null; max_attempts: number; questions: ReportQuestion[] }
}
export type AnswerRecord = {
  attempt_id: string; question_id: string; selected_index: number | null; is_correct: boolean
  override_correct: boolean | null; override_reason: string | null
}
export type GameAttemptRecord = { id: string; game_id: string; score: number; duration_seconds: number; played_at: string; game: { title: string; template: string } | null }

export type Trend = 'improved' | 'declined' | 'stable' | 'unknown'
export const TREND_LABELS: Record<Trend, string> = { improved: 'Сайжирсан', declined: 'Муудсан', stable: 'Тогтвортой', unknown: 'Харьцуулах өгөгдөл хүрэлцэхгүй' }
// Quiz percentages move in whole points, so a 5-point change is the smallest one worth calling a trend.
export const QUIZ_TREND_POINTS = 5

export type AnswerView = {
  question_id: string; topic: string; text: string; options: string[]; selected_index: number | null; correct_index: number
  correct: boolean; overridden: boolean; override_reason: string | null; explanation: string
}
export type AttemptView = { id: string; number: number; percent: number; correct: number; wrong: number; passed: boolean | null; completed_at: string | null }
export type QuizEntry = {
  quiz_id: string; title: string; topic: string | null; date: string; training: boolean; pass_percent: number | null
  status: ParticipantStatus; attempts: AttemptView[]; attempts_used: number
  final: { attempt_id: string; number: number; percent: number; correct: number; wrong: number; score: number; credited: number; passed: boolean | null; completed_at: string | null }
  answers: AnswerView[]
}
export type WeakQuestion = { quiz_id: string; quiz_title: string; topic: string | null; question_id: string; text: string; correct_text: string; chosen_text: string }
export type TopicStat = { topic: string; answered: number; correct: number; percent: number }
export type GameEntry = {
  game_id: string; title: string; plays: number; first: number; latest: number; best: number; average: number
  change: number; changePercent: number; status: ProgressStatus; first_at: string; latest_at: string
  history: Array<{ played_at: string; score: number; duration_seconds: number }>
}

export type DriverReport = {
  quizzes: QuizEntry[]
  quizSummary: {
    count: number; passed: number; failed: number; avgPercent: number; firstPercent: number | null; latestPercent: number | null
    change: number | null; trend: Trend; attemptsTotal: number; retakes: number; creditedPoints: number
  }
  topics: TopicStat[]
  weakQuestions: WeakQuestion[]
  games: GameEntry[]
  gameSummary: { games: number; plays: number; totalScore: number; improved: number; declined: number; stable: number }
  timeline: Array<{ date: string; kind: 'quiz' | 'game'; title: string; value: number }>
  overall: Trend
}

const pct = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 100) : 0)
const avg = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0)

function trendOf(first: number | null, latest: number | null, count: number): Trend {
  if (first === null || latest === null || count < 2) return 'unknown'
  const delta = latest - first
  return delta >= QUIZ_TREND_POINTS ? 'improved' : delta <= -QUIZ_TREND_POINTS ? 'declined' : 'stable'
}

export function buildDriverReport(
  quizAttempts: QuizAttemptRecord[], answers: AnswerRecord[], gameAttempts: GameAttemptRecord[], bonusByQuiz: Map<string, number> = new Map(),
): DriverReport {
  const answersByAttempt = new Map<string, AnswerRecord[]>()
  for (const answer of answers) answersByAttempt.set(answer.attempt_id, [...(answersByAttempt.get(answer.attempt_id) ?? []), answer])

  const byQuiz = new Map<string, QuizAttemptRecord[]>()
  for (const attempt of quizAttempts) byQuiz.set(attempt.quiz_id, [...(byQuiz.get(attempt.quiz_id) ?? []), attempt])
  const finalIds = new Set(pickFinalAttempts(quizAttempts).map(attempt => attempt.id))

  const quizzes: QuizEntry[] = []
  for (const list of byQuiz.values()) {
    const sorted = [...list].sort((a, b) => a.attempt_number - b.attempt_number)
    const final = sorted.find(attempt => finalIds.has(attempt.id))
    if (!final) continue // never finished anything for this quiz
    const quiz = final.quiz
    const rules = { pass_percent: quiz.pass_percent, max_attempts: quiz.max_attempts }
    const finalAnswers = answersByAttempt.get(final.id) ?? []
    const total = final.correct_count + final.wrong_count
    quizzes.push({
      quiz_id: final.quiz_id, title: quiz.title, topic: quiz.topic, date: quiz.active_date, training: quiz.pass_percent !== null, pass_percent: quiz.pass_percent,
      status: participantStatus(rules, sorted, bonusByQuiz.get(final.quiz_id) ?? 0),
      attempts: sorted.filter(attempt => attempt.completed).map(attempt => ({
        id: attempt.id, number: attempt.attempt_number, percent: pct(attempt.correct_count, attempt.correct_count + attempt.wrong_count),
        correct: attempt.correct_count, wrong: attempt.wrong_count, passed: attempt.passed, completed_at: attempt.completed_at,
      })),
      attempts_used: sorted.filter(attempt => attempt.completed).length,
      final: {
        attempt_id: final.id, number: final.attempt_number, percent: pct(final.correct_count, total), correct: final.correct_count, wrong: final.wrong_count,
        score: final.score, credited: final.credited_points ?? final.score, passed: final.passed, completed_at: final.completed_at,
      },
      answers: quiz.questions.map(question => {
        const answer = finalAnswers.find(item => item.question_id === question.id)
        return {
          question_id: question.id, topic: question.topic?.trim() || quiz.topic?.trim() || quiz.title, text: question.text, options: question.options.map(option => option.text), selected_index: answer?.selected_index ?? null,
          correct_index: question.correct_index, correct: answer ? effectiveCorrect(answer) : false, overridden: answer?.override_correct != null,
          override_reason: answer?.override_reason ?? null, explanation: question.explanation ?? '',
        }
      }),
    })
  }
  quizzes.sort((a, b) => a.date.localeCompare(b.date) || (a.final.completed_at ?? '').localeCompare(b.final.completed_at ?? ''))

  const percents = quizzes.map(entry => entry.final.percent)
  const firstPercent = percents[0] ?? null
  const latestPercent = percents[percents.length - 1] ?? null
  const attemptsTotal = quizzes.reduce((sum, entry) => sum + entry.attempts_used, 0)
  const quizSummary = {
    count: quizzes.length,
    passed: quizzes.filter(entry => entry.status === 'passed').length,
    failed: quizzes.filter(entry => entry.status === 'failed' || entry.status === 'locked').length,
    avgPercent: avg(percents), firstPercent, latestPercent,
    change: firstPercent !== null && latestPercent !== null && quizzes.length > 1 ? latestPercent - firstPercent : null,
    trend: trendOf(firstPercent, latestPercent, quizzes.length),
    attemptsTotal, retakes: attemptsTotal - quizzes.length,
    creditedPoints: quizzes.reduce((sum, entry) => sum + entry.final.credited, 0),
  }

  const topicMap = new Map<string, { answered: number; correct: number }>()
  const weakQuestions: WeakQuestion[] = []
  for (const entry of quizzes) {
    for (const answer of entry.answers) {
      const stat = topicMap.get(answer.topic) ?? { answered: 0, correct: 0 }
      stat.answered += 1
      if (answer.correct) stat.correct += 1
      topicMap.set(answer.topic, stat)
      if (!answer.correct) weakQuestions.push({
        quiz_id: entry.quiz_id, quiz_title: entry.title, topic: answer.topic, question_id: answer.question_id, text: answer.text,
        correct_text: answer.options[answer.correct_index] ?? '', chosen_text: answer.selected_index === null ? 'Хариулаагүй' : (answer.options[answer.selected_index] ?? ''),
      })
    }
  }
  const topics: TopicStat[] = [...topicMap.entries()].map(([topic, stat]) => ({ topic, ...stat, percent: pct(stat.correct, stat.answered) })).sort((a, b) => a.percent - b.percent)

  const byGame = new Map<string, GameAttemptRecord[]>()
  for (const attempt of [...gameAttempts].sort((a, b) => a.played_at.localeCompare(b.played_at))) byGame.set(attempt.game_id, [...(byGame.get(attempt.game_id) ?? []), attempt])
  const games: GameEntry[] = [...byGame.entries()].map(([gameId, list]) => {
    const first = list[0], last = list[list.length - 1], change = last.score - first.score
    return {
      game_id: gameId, title: first.game?.title ?? 'Тоглоом', plays: list.length, first: first.score, latest: last.score, best: Math.max(...list.map(item => item.score)),
      average: avg(list.map(item => item.score)), change, changePercent: first.score > 0 ? Math.round((change / first.score) * 100) : (change > 0 ? 100 : 0),
      status: progressStatus(list.length, first.score, last.score), first_at: first.played_at, latest_at: last.played_at,
      history: list.map(item => ({ played_at: item.played_at, score: item.score, duration_seconds: item.duration_seconds })),
    }
  }).sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title))
  const gameSummary = {
    games: games.length, plays: gameAttempts.length, totalScore: gameAttempts.reduce((sum, item) => sum + item.score, 0),
    improved: games.filter(game => game.status === 'improved').length, declined: games.filter(game => game.status === 'declined').length, stable: games.filter(game => game.status === 'stable').length,
  }

  const timeline: DriverReport['timeline'] = [
    ...quizzes.map(entry => ({ date: mongoliaDate(new Date(entry.final.completed_at ?? entry.date)), kind: 'quiz' as const, title: entry.title, value: entry.final.percent })),
    ...gameAttempts.map(item => ({ date: mongoliaDate(new Date(item.played_at)), kind: 'game' as const, title: item.game?.title ?? 'Тоглоом', value: item.score })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  // The overall verdict rests on quizzes (percent of correct answers); games only tip it when there are no quizzes to compare.
  let overall = quizSummary.trend
  if (overall === 'unknown' && gameSummary.improved + gameSummary.declined + gameSummary.stable > 0) {
    overall = gameSummary.improved > gameSummary.declined ? 'improved' : gameSummary.declined > gameSummary.improved ? 'declined' : 'stable'
  }
  return { quizzes, quizSummary, topics, weakQuestions, games, gameSummary, timeline, overall }
}

// A driver who may still retake a training quiz must not see its correct answers in their own report.
export function redactForDriver(report: DriverReport): DriverReport {
  const hidden = new Set(report.quizzes.filter(entry => entry.training && entry.status === 'failed').map(entry => entry.quiz_id))
  if (hidden.size === 0) return report
  return {
    ...report,
    quizzes: report.quizzes.map(entry => hidden.has(entry.quiz_id) ? { ...entry, answers: [] } : entry),
    weakQuestions: report.weakQuestions.map(item => hidden.has(item.quiz_id) ? { ...item, correct_text: '', chosen_text: '' } : item),
  }
}
