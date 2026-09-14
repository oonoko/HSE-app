import type { User, Location, HazardImage, DailySession, LeaderboardEntry } from '@/types'

// ============================================================
// MOCK DATA — Supabase тохиргоо хийгдэхээс өмнө ашиглана
// ============================================================

export const MOCK_USERS: User[] = [
  {
    id: 'u1', sap_id: '10001', name: 'Батболд Дорж', name_en: 'Batbold Dorj',
    department: 'Хөдөлгөөн', department_en: 'Transport', location_id: 'loc1',
    role: 'driver', total_score: 145, created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u2', sap_id: '10002', name: 'Одгэрэл Мөнх', name_en: 'Odgerel Munkh',
    department: 'Логистик', department_en: 'Logistics', location_id: 'loc1',
    role: 'driver', total_score: 120, created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u3', sap_id: '10003', name: 'Энхжаргал Баяр', name_en: 'Enkhjargal Bayar',
    department: 'Хөдөлгөөн', department_en: 'Transport', location_id: 'loc2',
    role: 'driver', total_score: 95, created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u4', sap_id: '10004', name: 'Ганзориг Нацаг', name_en: 'Ganzorigr Natsag',
    department: 'Механик', department_en: 'Mechanics', location_id: 'loc1',
    role: 'driver', total_score: 170, created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'u5', sap_id: '10005', name: 'Нарантуяа Өлзий', name_en: 'Narantuya Ulzii',
    department: 'Логистик', department_en: 'Logistics', location_id: 'loc3',
    role: 'driver', total_score: 85, created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'admin1', sap_id: '99999', name: 'Байгалмаа', name_en: 'Baigalmaa',
    department: 'HSE', department_en: 'HSE', location_id: undefined,
    role: 'admin', total_score: 0, created_at: '2026-01-01T00:00:00Z',
  },
]

export const MOCK_LOCATIONS: Location[] = [
  { id: 'loc1', name: 'Гараж №1', name_en: 'Garage #1', qr_code: 'HK-LOC-001', aimag: 'Өмнөговь', active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'loc2', name: 'Цахилгааны өрөө', name_en: 'Electrical Room', qr_code: 'HK-LOC-002', aimag: 'Өмнөговь', active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'loc3', name: 'Агуулах', name_en: 'Warehouse', qr_code: 'HK-LOC-003', aimag: 'Өмнөговь', active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'loc4', name: 'Мандалговь бааз', name_en: 'Mandalgovi Base', qr_code: 'HK-LOC-004', aimag: 'Дундговь', active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'loc5', name: 'УБ Салбар', name_en: 'UB Branch', qr_code: 'HK-LOC-005', aimag: 'Улаанбаатар', active: true, created_at: '2026-01-01T00:00:00Z' },
]

export const MOCK_IMAGES: HazardImage[] = [
  {
    id: 'img1',
    image_url: '/mock/garage.jpg',
    location_id: 'loc1',
    location: MOCK_LOCATIONS[0],
    date: new Date().toISOString().split('T')[0],
    title: 'Гаражийн аюулгүй байдал',
    title_en: 'Garage Safety Check',
    hazards: [
      {
        id: 'h1',
        x_percent: 38,
        y_percent: 72,
        label: 'Шалан дээрх хог',
        label_en: 'Floor debris',
        quiz: [
          {
            id: 'q1',
            question: 'Шалан дээрх хог яагаад аюултай вэ?',
            question_en: 'Why is floor debris dangerous?',
            options: [
              { text: 'Гулсч унах аюул учруулна', text_en: 'Creates slip/trip hazard', correct: true },
              { text: 'Дулаан алдагдана', text_en: 'Causes heat loss', correct: false },
              { text: 'Гэрэл нь муудна', text_en: 'Reduces lighting', correct: false },
            ],
            explanation: 'Шалан дээрх хог, тос нь ажилчдыг гулсаж унахад хүргэж, хүнд гэмтэл учруулах боломжтой.',
            explanation_en: 'Floor debris and oil can cause workers to slip and fall, potentially causing serious injury.',
          },
          {
            id: 'q2',
            question: 'Хог цэвэрлэхэд ямар хэрэгсэл хэрэглэнэ?',
            question_en: 'What equipment to use for cleanup?',
            options: [
              { text: 'Тос шингээгч материал', text_en: 'Absorbent material', correct: true },
              { text: 'Ердийн цаас', text_en: 'Regular paper', correct: false },
              { text: 'Хуурай алчуур', text_en: 'Dry cloth only', correct: false },
            ],
            explanation: 'Тос, шингэний асгаралтыг тос шингээгч материалаар цэвэрлэж, дараа нь тосны хогийн саванд хийнэ.',
            explanation_en: 'Oil/liquid spills should be cleaned with absorbent material and disposed of in the oil waste bin.',
          },
          {
            id: 'q3',
            question: 'Хог олсон тохиолдолд та юу хийх ёстой вэ?',
            question_en: 'What should you do when you find debris?',
            options: [
              { text: 'Шууд цэвэрлэж, HSE-д мэдэгдэнэ', text_en: 'Clean immediately and report to HSE', correct: true },
              { text: 'Дуустал хүлээнэ', text_en: 'Wait until shift end', correct: false },
              { text: 'Бусдад хэлнэ', text_en: 'Just tell someone else', correct: false },
            ],
            explanation: 'Аюулыг нэн даруй арилгах нь ажилчдыг хамгаалах хамгийн чухал алхам юм.',
            explanation_en: 'Immediately addressing the hazard is the most important step to protect workers.',
          },
        ],
      },
      {
        id: 'h2',
        x_percent: 82,
        y_percent: 82,
        label: 'Унасан конус',
        label_en: 'Fallen traffic cone',
        quiz: [
          {
            id: 'q4',
            question: 'Унасан конус яагаад аюулгүй байдлын асуудал вэ?',
            question_en: 'Why is a fallen cone a safety issue?',
            options: [
              { text: 'Автомашин дайрах аюул нэмэгдэнэ', text_en: 'Increases vehicle collision risk', correct: true },
              { text: 'Зөвхөн харагдахын тулд байдаг', text_en: 'It\'s only for visibility', correct: false },
              { text: 'Аюулгүй, зөвхөн тохиолддог', text_en: 'It\'s safe, just happens', correct: false },
            ],
            explanation: 'Конус нь хориглосон хэсгийг тэмдэглэдэг. Унасан конус зам хаалтыг арилгаж, ослын аюул нэмэгдэнэ.',
            explanation_en: 'Cones mark restricted areas. A fallen cone removes the barrier, increasing accident risk.',
          },
          {
            id: 'q5',
            question: 'Та конус унасаныг харвал юу хийх вэ?',
            question_en: 'What do you do when you see a fallen cone?',
            options: [
              { text: 'Шууд босгож, зөв байранд тавина', text_en: 'Stand it up immediately in correct position', correct: true },
              { text: 'Алхаж өнгөрнө', text_en: 'Walk past it', correct: false },
              { text: 'Shift ахлагчаас хүлээнэ', text_en: 'Wait for shift leader', correct: false },
            ],
            explanation: 'Аюулгүй байдлын тэмдэг тоног хэрэгслийг шууд сэргээх нь бүхний үүрэг.',
            explanation_en: 'Immediately restoring safety signage is everyone\'s responsibility.',
          },
          {
            id: 'q6',
            question: 'Конусын зөв байрлал ямар байх ёстой вэ?',
            question_en: 'What is the correct cone placement?',
            options: [
              { text: 'Хориглосон талбайн ирмэгт шулуун', text_en: 'Straight at the edge of restricted area', correct: true },
              { text: 'Хаана ч байсан болно', text_en: 'Anywhere is fine', correct: false },
              { text: 'Хоорондоо 5м зайтай', text_en: '5m apart always', correct: false },
            ],
            explanation: 'Конусыг хориглосон талбайн зааг дагуу шулуун байрлуулж, тодорхой мессеж дамжуулах ёстой.',
            explanation_en: 'Cones should be placed straight along the perimeter of restricted areas to convey a clear message.',
          },
        ],
      },
    ],
    created_by: '99999',
    created_at: new Date().toISOString(),
  },
  {
    id: 'img2',
    image_url: '/mock/electrical.jpg',
    location_id: 'loc2',
    location: MOCK_LOCATIONS[1],
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    title: 'Цахилгааны өрөөний аюул',
    title_en: 'Electrical Room Hazards',
    hazards: [
      {
        id: 'h3',
        x_percent: 68,
        y_percent: 42,
        label: 'Цахилгааны хажуух ус',
        label_en: 'Water near electrical panel',
        quiz: [
          {
            id: 'q7',
            question: 'Цахилгааны самбарын ойролцоо ус байрлуулах нь ямар аюул вэ?',
            question_en: 'What danger does water near an electrical panel pose?',
            options: [
              { text: 'Цахилгаан шокны болон гал түймрийн аюул', text_en: 'Electrical shock and fire hazard', correct: true },
              { text: 'Зөвхөн гоо сайхны асуудал', text_en: 'Only an aesthetic issue', correct: false },
              { text: 'Агаарын чийгшил нэмэгдэнэ', text_en: 'Increases humidity only', correct: false },
            ],
            explanation: 'Ус нь цахилгааны дамжуулагч учир самбарт орвол богино замын холболт, гал түймэр эсвэл цахилгаан шок үүсгэж болно.',
            explanation_en: 'Water conducts electricity. If it reaches the panel, it can cause short circuit, fire, or electric shock.',
          },
          {
            id: 'q8',
            question: 'Цахилгааны өрөөнд юу хадгалах ёсгүй вэ?',
            question_en: 'What should NOT be stored in an electrical room?',
            options: [
              { text: 'Шингэн, химийн бодис, цаасан материал', text_en: 'Liquids, chemicals, paper materials', correct: true },
              { text: 'Зөвхөн ус', text_en: 'Only water', correct: false },
              { text: 'Аливаа зүйл хадгалж болно', text_en: 'Anything can be stored', correct: false },
            ],
            explanation: 'Цахилгааны өрөө нь зөвхөн цахилгааны тоног төхөөрөмжийн зориулалтаар байх ёстой. Шингэн, үлдэгдэл материал байрлуулж болохгүй.',
            explanation_en: 'Electrical rooms should only contain electrical equipment. No liquids or combustible materials should be stored there.',
          },
          {
            id: 'q9',
            question: 'Цахилгааны өрөөнд шингэн олбол яах вэ?',
            question_en: 'If you find liquid in the electrical room, what do you do?',
            options: [
              { text: 'Яаралтай дуудлага өгч, өрөөнөөс гарна', text_en: 'Alert immediately and exit the room', correct: true },
              { text: 'Цахилгааны самбарт хүрэхгүй цэвэрлэнэ', text_en: 'Clean without touching the panel', correct: false },
              { text: 'Хааяа цэвэрлэвэл болно', text_en: 'Clean it when convenient', correct: false },
            ],
            explanation: 'Цахилгааны дэргэдэх шингэн нь аюулгүй байдлын яаралтай нөхцөл. HSE болон цахилгааны инженерт яаралтай мэдэгдэнэ.',
            explanation_en: 'Liquid near electricity is an emergency. Immediately notify HSE and the electrical engineer.',
          },
        ],
      },
    ],
    created_by: '99999',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

export const MOCK_SESSIONS: DailySession[] = [
  { id: 's1', user_id: 'u1', image_id: 'img1', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], score: 15, completed: true, completed_at: new Date(Date.now() - 80000000).toISOString(), created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 's2', user_id: 'u1', image_id: 'img2', date: new Date(Date.now() - 172800000).toISOString().split('T')[0], score: 10, completed: true, completed_at: new Date(Date.now() - 165000000).toISOString(), created_at: new Date(Date.now() - 172800000).toISOString() },
]

export const MOCK_LEADERBOARD: LeaderboardEntry[] = MOCK_USERS
  .filter(u => u.role !== 'admin')
  .sort((a, b) => b.total_score - a.total_score)
  .map((u, i) => ({
    rank: i + 1,
    user_id: u.id,
    name: u.name,
    department: u.department,
    total_score: u.total_score,
    sessions_completed: Math.floor(u.total_score / 15),
    is_current_user: false,
  }))

// Тухайн өдрийн зургийг олох
export function getTodayImage(locationId?: string): HazardImage | null {
  const today = new Date().toISOString().split('T')[0]
  if (locationId) {
    return MOCK_IMAGES.find(img => img.date === today && img.location_id === locationId) ?? MOCK_IMAGES.find(img => img.date === today) ?? null
  }
  return MOCK_IMAGES.find(img => img.date === today) ?? null
}

export function getUserById(sapId: string): User | null {
  return MOCK_USERS.find(u => u.sap_id === sapId) ?? null
}

export function getUserSessions(userId: string): DailySession[] {
  return MOCK_SESSIONS.filter(s => s.user_id === userId)
    .map(s => ({ ...s, image: MOCK_IMAGES.find(img => img.id === s.image_id) }))
}
