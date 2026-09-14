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
  shift_number?: 1 | 2 | 3 | 4
  is_super_admin?: boolean
}

export type QuizStatus = 'draft' | 'scheduled' | 'active' | 'closed'
export type GameTemplate = 'truth_false' | 'match' | 'puzzle' | 'random_box'
export type GameCategory = 'critical_risk_22' | 'life_rules_7'

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
  target_shift?: 1 | 2 | 3 | 4
  status: QuizStatus
  questions: DailyQuizQuestion[]
  created_by: string
  created_at: string
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

export interface QuizOption {
  text: string
  text_en: string
  correct: boolean
}

export interface QuizQuestion {
  id: string
  question: string
  question_en: string
  options: QuizOption[]
  explanation: string
  explanation_en: string
}

export interface Hazard {
  id: string
  x_percent: number  // 0–100, зурган дахь хэвтээ байрлал
  y_percent: number  // 0–100, зурган дахь босоо байрлал
  label: string
  label_en: string
  quiz: QuizQuestion[]
  video_url?: string
  pdf_url?: string
}

export interface HazardImage {
  id: string
  image_url: string
  location_id: string
  location?: Location
  date: string        // YYYY-MM-DD
  hazards: Hazard[]
  title?: string
  title_en?: string
  created_by: string  // admin SAP ID
  created_at: string
}

export interface HazardAnswer {
  id: string
  session_id: string
  hazard_id: string
  question_id: string
  selected_option: number  // 0, 1, 2
  is_correct: boolean
  answered_at: string
}

export interface DailySession {
  id: string
  user_id: string
  user?: User
  image_id: string
  image?: HazardImage
  date: string
  score: number
  completed: boolean
  completed_at?: string
  answers?: HazardAnswer[]
  created_at: string
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  name: string
  department: string
  total_score: number
  sessions_completed: number
  avatar_url?: string
  is_current_user?: boolean
}

// Quiz state — frontend дээр ашиглана
export interface QuizState {
  hazardId: string
  currentQuestion: number
  answers: Record<string, number>  // question_id -> selected option index
  completed: boolean
  score: number
}

// Session-ы нийт state
export interface SessionProgress {
  imageId: string
  completedHazards: Set<string>
  quizStates: Record<string, QuizState>  // hazard_id -> QuizState
  totalScore: number
  sessionComplete: boolean
}

// Admin форм төлөв
export interface HazardForm {
  label: string
  label_en: string
  x_percent: number
  y_percent: number
  quiz: QuizQuestion[]
}

export interface ImageUploadForm {
  file: File | null
  location_id: string
  date: string
  title: string
  title_en: string
  hazards: HazardForm[]
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
}
