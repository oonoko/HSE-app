export function mongoliaDate(value: Date | number = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function mongoliaTime(value: Date | number = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ulaanbaatar', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
