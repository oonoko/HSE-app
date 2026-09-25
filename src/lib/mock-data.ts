import type { User } from '@/types'

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

export function getUserById(sapId: string): User | null {
  return MOCK_USERS.find(u => u.sap_id === sapId) ?? null
}
