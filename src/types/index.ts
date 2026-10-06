// ============================================================
// HSE Safety App — бүх TypeScript types
// ============================================================

export type UserRole = 'driver' | 'admin'
export type Language = 'mn' | 'en'

export interface User {
  id: string
  sap_id: string
  name: string
  name_en?: string
  department: string
  department_en?: string
  location_id?: string
  role: UserRole
  total_score: number
  avatar_url?: string
  created_at: string
  last_active?: string
  shift_number?: number
  is_super_admin?: boolean
}

export type QuizStatus = 'draft' | 'scheduled' | 'active' | 'closed'
export type GameTemplate = 'truth_false' | 'match' | 'word_grid' | 'random_box'
export type GameCategory = 'critical_risk_22' | 'life_rules_7' | 'other'

export interface DailyQuizOption {
  text: string
}

export interface DailyQuizQuestion {
  id: string
  image_url?: string
  text: string
  options: [DailyQuizOption, DailyQuizOption, DailyQuizOption]
  correct_index: number
  explanation?: string
}

export interface DailyQuiz {
  id: string
  title: string
  topic?: string
  active_date: string
  start_time: string
  end_time: string
  time_limit_seconds: number
  target_shift?: number
  status: QuizStatus
  questions: DailyQuizQuestion[]
  created_by: string
  created_at: string
  pass_percent?: number | null
  max_attempts?: number
  attendee_ids?: string[]
  my_status?: QuizMyStatus
}

export interface QuizMyStatus {
  attempts_used: number
  attempts_allowed: number
  attempts_left: number
  passed: boolean
  locked: boolean
  in_progress: boolean
  final?: { score: number; max_score: number; correct_count: number; wrong_count: number; passed: boolean | null } | null
}

export interface QuizMeta {
  title: string
  training: boolean
  pass_percent: number | null
  attempts_used: number
  attempts_allowed: number
  attempts_left: number
  passed: boolean
  locked: boolean
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  user_id: string
  score: number
  max_score: number
  correct_count: number
  wrong_count: number
  total_time_seconds: number
  completed: boolean
  started_at: string
  completed_at?: string
  attempt_number?: number
  passed?: boolean | null
  credited_points?: number
  quiz?: DailyQuiz
}

export interface SafetyGame {
  id: string
  title: string
  category: GameCategory
  template: GameTemplate
  content: Record<string, unknown>
  active: boolean
  created_by: string
  created_at: string
}

export interface GameAttempt {
  id: string
  game_id: string
  user_id: string
  score: number
  duration_seconds: number
  played_at: string
  game?: SafetyGame
}

export interface Location {
  id: string
  name: string
  name_en: string
  qr_code: string
  aimag: string
  active: boolean
  created_at: string
}
