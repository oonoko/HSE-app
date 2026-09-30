export const SHIFT_NUMBERS = [1, 2, 3, 4, 5] as const
export type ShiftNumber = typeof SHIFT_NUMBERS[number]

const SHIFT_LABELS: Record<number, string> = { 1: '1-р ээлж', 2: '2-р ээлж', 3: '3-р ээлж', 4: '4-р ээлж', 5: 'Хот' }

export function shiftLabel(shiftNumber?: number | null): string {
  if (!shiftNumber) return 'Ээлж оноогоогүй'
  return SHIFT_LABELS[shiftNumber] ?? `${shiftNumber}-р ээлж`
}

export function shiftLabelShort(shiftNumber?: number | null): string {
  if (!shiftNumber) return 'Ээлжгүй'
  return SHIFT_LABELS[shiftNumber] ?? `${shiftNumber}-р ээлж`
}
