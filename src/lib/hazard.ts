export const HAZARD_KINDS = [
  { value: 'hazard', label: 'Аюултай нөхцөл', hint: 'Осол болоогүй ч аюул учруулж болзошгүй зүйл' },
  { value: 'near_miss', label: 'Осолд дөхсөн тохиолдол', hint: 'Бага зэрэг өөрөөр болсон бол осол болох байсан' },
  { value: 'incident', label: 'Осол, гэмтэл', hint: 'Осол, гэмтэл, эвдрэл гарсан' },
] as const

export const HAZARD_CATEGORIES = [
  { value: 'road', label: 'Зам, замын нөхцөл' },
  { value: 'vehicle', label: 'Техник, тээврийн хэрэгсэл' },
  { value: 'behavior', label: 'Аюултай үйлдэл, зан үйл' },
  { value: 'ppe', label: 'Хувийн хамгаалах хэрэгсэл' },
  { value: 'fire', label: 'Гал, тэсрэлт' },
  { value: 'environment', label: 'Орчин, гоожилт, бохирдол' },
  { value: 'health', label: 'Эрүүл мэнд, ядаргаа' },
  { value: 'other', label: 'Бусад' },
] as const

export const HAZARD_SEVERITIES = [
  { value: 'low', label: 'Бага' },
  { value: 'medium', label: 'Дунд' },
  { value: 'high', label: 'Өндөр' },
  { value: 'critical', label: 'Маш ноцтой' },
] as const

export const HAZARD_STATUSES = [
  { value: 'new', label: 'Шинэ' },
  { value: 'in_review', label: 'Шалгаж байна' },
  { value: 'resolved', label: 'Шийдвэрлэсэн' },
  { value: 'rejected', label: 'Хүлээн аваагүй' },
] as const

export type HazardKind = typeof HAZARD_KINDS[number]['value']
export type HazardCategory = typeof HAZARD_CATEGORIES[number]['value']
export type HazardSeverity = typeof HAZARD_SEVERITIES[number]['value']
export type HazardStatus = typeof HAZARD_STATUSES[number]['value']

export const MAX_HAZARD_PHOTOS = 3
export const MAX_REPORTS_PER_DAY = 20

const label = <T extends { value: string; label: string }>(list: readonly T[], value: string | null | undefined) =>
  list.find(item => item.value === value)?.label ?? ''
export const kindLabel = (value?: string | null) => label(HAZARD_KINDS, value)
export const categoryLabel = (value?: string | null) => label(HAZARD_CATEGORIES, value)
export const severityLabel = (value?: string | null) => label(HAZARD_SEVERITIES, value)
export const statusLabel = (value?: string | null) => label(HAZARD_STATUSES, value)

const has = (list: readonly { value: string }[], value: unknown): boolean => list.some(item => item.value === value)

export type HazardInput = {
  kind: HazardKind; category: HazardCategory; severity: HazardSeverity
  location_text: string; latitude: number | null; longitude: number | null
  description: string; image_urls: string[]; anonymous: boolean
}

// Returns the cleaned input, or an error message in Mongolian.
export function validateHazardInput(raw: Record<string, unknown>, allowedImagePrefix: string): { ok: true; value: HazardInput } | { ok: false; error: string } {
  if (!has(HAZARD_KINDS, raw.kind)) return { ok: false, error: 'Мэдээллийн төрлөө сонгоно уу' }
  if (!has(HAZARD_CATEGORIES, raw.category)) return { ok: false, error: 'Ангилалаа сонгоно уу' }
  if (!has(HAZARD_SEVERITIES, raw.severity)) return { ok: false, error: 'Ноцтой байдлаа сонгоно уу' }
  const location = String(raw.location_text ?? '').replace(/\s+/g, ' ').trim()
  if (location.length < 2 || location.length > 200) return { ok: false, error: 'Байршлаа бичнэ үү (2–200 тэмдэгт)' }
  const description = String(raw.description ?? '').trim()
  if (description.length < 5) return { ok: false, error: 'Юу болсныг тодорхой бичнэ үү (дор хаяж 5 тэмдэгт)' }
  if (description.length > 2000) return { ok: false, error: 'Тайлбар 2000 тэмдэгтээс бага байх ёстой' }

  const lat = raw.latitude === null || raw.latitude === undefined || raw.latitude === '' ? null : Number(raw.latitude)
  const lng = raw.longitude === null || raw.longitude === undefined || raw.longitude === '' ? null : Number(raw.longitude)
  if ((lat === null) !== (lng === null)) return { ok: false, error: 'Байршлын координат дутуу байна' }
  if (lat !== null && lng !== null && (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) return { ok: false, error: 'Байршлын координат буруу байна' }

  const images = Array.isArray(raw.image_urls) ? raw.image_urls : []
  if (images.length > MAX_HAZARD_PHOTOS) return { ok: false, error: `Зураг ${MAX_HAZARD_PHOTOS}-аас илүүгүй байна` }
  if (!images.every(url => typeof url === 'string' && url.startsWith(allowedImagePrefix))) return { ok: false, error: 'Зураг буруу байна' }

  return {
    ok: true,
    value: {
      kind: raw.kind as HazardKind, category: raw.category as HazardCategory, severity: raw.severity as HazardSeverity,
      location_text: location, latitude: lat, longitude: lng, description, image_urls: images as string[], anonymous: raw.anonymous === true,
    },
  }
}

// Anonymous reporters stay hidden from admins (the owner still sees their own reports).
export function maskReporter<T extends { anonymous: boolean; reporter?: { name: string; sap_id: string } | null }>(report: T): T {
  return report.anonymous ? { ...report, reporter: null } : report
}

export function mapsUrl(latitude: number | null, longitude: number | null): string | null {
  return latitude === null || longitude === null ? null : `https://www.google.com/maps?q=${latitude},${longitude}`
}

export const SEVERITY_RANK: Record<HazardSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 }
export const isOpen = (status: HazardStatus) => status === 'new' || status === 'in_review'
