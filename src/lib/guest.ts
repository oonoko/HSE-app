// Guests are stored as ordinary driver accounts in the "Зочин" department (no shift),
// so no schema change is needed. Official statistics leave them out.
export const GUEST_DEPARTMENT = 'Зочин'

export function isGuest(user: { department?: string | null }): boolean {
  return user.department === GUEST_DEPARTMENT
}

const NAME_PART = /^[\p{L}][\p{L}\p{M}'’.\- ]{0,38}[\p{L}\p{M}.]$|^[\p{L}]$/u

export function cleanNamePart(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function validNamePart(value: string): boolean {
  return value.length >= 1 && value.length <= 40 && NAME_PART.test(value)
}

// SAP numbers are digits only (the login field already strips everything else); length is not restricted beyond a sane bound.
export function validSapNumber(value: string): boolean {
  return /^\d{1,20}$/.test(value)
}

export function guestFullName(lastName: string, firstName: string): string {
  return `${lastName} ${firstName}`
}
