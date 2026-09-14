'use client'

export type Lang = 'mn' | 'en'

const LANG_KEY = 'hse_lang'

export function getStoredLang(): Lang {
  if (typeof window === 'undefined') return 'mn'
  return (localStorage.getItem(LANG_KEY) as Lang) ?? 'mn'
}

export function setStoredLang(lang: Lang): void {
  localStorage.setItem(LANG_KEY, lang)
}

// t() helper — объектоос хэлний утга авна
export function t<T extends { [key: string]: string }>(obj: T, lang: Lang, mnKey: keyof T, enKey: keyof T): string {
  return (lang === 'en' ? obj[enKey] : obj[mnKey]) as string
}

// Ерөнхий UI текстүүд
export const UI_TEXT = {
  mn: {
    login: 'Нэвтрэх',
    logout: 'Гарах',
    sapId: 'SAP ID',
    sapIdPlaceholder: 'SAP ID оруулна уу',
    home: 'Нүүр',
    leaderboard: 'Тэмцээн',
    history: 'Түүх',
    admin: 'Удирдлага',
    startQuiz: 'Шалгалт эхлэх',
    next: 'Дараагийн асуулт',
    correct: 'Зөв!',
    wrong: 'Буруу',
    score: 'Оноо',
    completed: 'Дуусгасан',
    department: 'Хэлтэс',
    total: 'Нийт',
    today: 'Өнөөдөр',
    back: 'Буцах',
    save: 'Хадгалах',
    cancel: 'Цуцлах',
    loading: 'Ачааллаж байна...',
    error: 'Алдаа гарлаа',
    notFound: 'Олдсонгүй',
    alreadyDone: 'Өнөөдрийн шалгалт дууссан',
    comeBackTomorrow: 'Маргааш дахин ирэх',
    noImageToday: 'Өнөөдрийн зураг байхгүй',
    rank: 'Байр',
    name: 'Нэр',
    sessions: 'Хичээл',
    addHazard: '+ Аюул нэмэх',
    uploadImage: 'Зураг оруулах',
    users: 'Ажилчид',
    reports: 'Тайлан',
    images: 'Зургууд',
    locations: 'Байршлууд',
    loginError: 'SAP ID олдсонгүй. Дахин оруулна уу.',
  },
  en: {
    login: 'Login',
    logout: 'Logout',
    sapId: 'SAP ID',
    sapIdPlaceholder: 'Enter your SAP ID',
    home: 'Home',
    leaderboard: 'Leaderboard',
    history: 'History',
    admin: 'Admin',
    startQuiz: 'Start Quiz',
    next: 'Next Question',
    correct: 'Correct!',
    wrong: 'Wrong',
    score: 'Score',
    completed: 'Completed',
    department: 'Department',
    total: 'Total',
    today: 'Today',
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    error: 'Error occurred',
    notFound: 'Not found',
    alreadyDone: 'Today\'s quiz completed',
    comeBackTomorrow: 'Come back tomorrow',
    noImageToday: 'No image for today',
    rank: 'Rank',
    name: 'Name',
    sessions: 'Sessions',
    addHazard: '+ Add Hazard',
    uploadImage: 'Upload Image',
    users: 'Workers',
    reports: 'Reports',
    images: 'Images',
    locations: 'Locations',
    loginError: 'SAP ID not found. Please try again.',
  },
}
