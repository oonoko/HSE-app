# HSE Safety App — Ханбогд Хурд

Ажлын байрны аюулгүй байдлын мэдлэг олгох PWA систем.

## Хурдан эхлэх

```bash
cd hse-safety
npm install
npm run dev
```

Браузерт: http://localhost:3000

**Demo нэвтрэлт:**
- Ажилтан: SAP ID `10001` – `10005`
- Admin: SAP ID `99999`

---

## Структур

```
src/
├── app/
│   ├── (auth)/login/     ← Нэвтрэх хуудас
│   ├── quiz/             ← Аюул олох + Quiz
│   ├── leaderboard/      ← Тэмцээний байр
│   ├── history/          ← Сургалтын түүх
│   ├── scan/             ← QR кодоор нэвтрэх
│   ├── admin/
│   │   ├── images/       ← Зураг удирдах + аюул байрлуулах
│   │   ├── users/        ← Ажилтан удирдах
│   │   └── reports/      ← Тайлан, статистик
│   └── api/              ← REST API routes
├── components/
│   ├── layout/           ← AppShell, Header, BottomNav
│   └── ui/               ← ScoreToast, etc.
├── lib/
│   ├── mock-data.ts      ← Mock өгөгдөл
│   ├── auth.ts           ← localStorage auth helpers
│   ├── context.tsx       ← Global app state (React Context)
│   └── i18n.ts           ← МН/EN i18n
└── types/
    └── index.ts          ← TypeScript типүүд
```

---

## Production руу шилжих

### 1. Supabase тохируулах

1. [supabase.com](https://supabase.com) дээр шинэ project үүсгэнэ
2. **SQL Editor** дээр `supabase/schema.sql` агуулгыг ажиллуулна
3. **Storage** дээр `hazard-images` bucket үүсгэж, public болгоно
4. **Project Settings → API** дээр credentials хуулна

### 2. .env.local тохируулах

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_MOCK_MODE=false
```

### 3. Ажилчдыг DB-д оруулах

Supabase Dashboard → Table Editor → users дээр ажилчдын мэдээллийг оруулна.

---

## Технологийн стек

| Давхарга | Технологи |
|----------|-----------|
| Frontend | Next.js 15, TypeScript |
| Styling  | Tailwind CSS + Custom CSS |
| Database | Supabase (PostgreSQL) |
| Storage  | Supabase Storage |
| Auth     | SAP ID → localStorage (MVP) |
| Deploy   | Vercel |

---

## Ирээдүйн нэмэлт

- [ ] Supabase Auth (session token)
- [ ] Push notifications (Web Push API / Service Worker)
- [ ] QR code scanner (камер)
- [ ] Видео/PDF хавсралт
- [ ] SAP API шууд холболт
- [ ] Excel тайлан экспорт

---

*Байгалмаа · HSE Safety Officer · Ханбогд Хурд ХХК*
