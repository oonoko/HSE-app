type QuizWindow = {
  active_date: string
  status: string
  target_shift?: number | null
  start_time: string
  end_time: string
}

export function isQuizOpenForDriver(quiz: QuizWindow, now: { date: string; time: string; shiftNumber?: number | null }): boolean {
  if (quiz.active_date !== now.date) return false
  if (!['scheduled', 'active'].includes(quiz.status)) return false
  if (quiz.target_shift && quiz.target_shift !== now.shiftNumber) return false
  if (quiz.start_time.slice(0, 5) > now.time) return false
  if (quiz.end_time.slice(0, 5) < now.time) return false
  return true
}
