# HSE Safety App — Ханбогд Хурд

Жолоочийн аюулгүй ажиллагааны сургалтын PWA систем. Өдрийн мэдлэг шалгах асуумж, мэдлэг сэргээх тоглоом, онооны самбар, ХАБ-ын ажилтанд зориулсан удирдлагын хэрэгслүүд.

## Хурдан эхлэх

```bash
npm install
npm run dev
```

Браузерт: http://localhost:3000

`NEXT_PUBLIC_MOCK_MODE=true` үед Supabase тохируулаагүйгээр demo SAP ID (`10001`–`10005` ажилтан, `99999` admin) ашиглан туршиж болно.

---

## Структур

```
src/
├── app/
│   ├── (auth)/login/          ← Нэвтрэх хуудас (SAP ID + admin PIN)
│   ├── page.tsx                ← Жолоочийн нүүр (өдрийн асуумж)
│   ├── quiz/                   ← Асуумж бөглөх
│   ├── games/                  ← Мэдлэг сэргээх тоглоом
│   ├── leaderboard/             ← Онооны самбар
│   ├── profile/                 ← Жолоочийн профайл
│   ├── admin/
│   │   ├── quizzes/            ← Асуумж үүсгэх/засах, present/ дэлгэцээр харуулах
│   │   ├── games/              ← Тоглоом үүсгэх/засах, report/ тайлан
│   │   ├── dashboard/          ← Өдрийн гүйцэтгэлийн dashboard
│   │   ├── reports/            ← Бүх цаг үеийн нэгтгэсэн тайлан
│   │   ├── my-shift/           ← Ээлжийн 7 хоногийн харьцуулалт
│   │   ├── drivers/[id]/       ← Жолоочийн дэлгэрэнгүй + онооны trend график
│   │   └── users/              ← Ажилтан удирдах (нэг нэгээр/CSV импорт)
│   └── api/                    ← REST API routes
├── components/
│   ├── layout/                 ← AppShell, Header, BottomNav
│   └── ui/                     ← Icon, ScoreToast
├── lib/
│   ├── mock-data.ts            ← Demo login-д зориулсан mock хэрэглэгчид
│   ├── auth.ts, session.ts     ← Нэвтрэлт
│   ├── context.tsx             ← Global app state (React Context)
│   ├── push.ts, push-client.ts ← Web push мэдэгдэл
│   └── date.ts                 ← Монголын цагийн бүс тооцоолол
└── types/
    └── index.ts                ← TypeScript типүүд
public/
└── sw.js                       ← Service worker (offline кэш, push)
```

---

## Production руу шилжих

### 1. Supabase тохируулах

1. [supabase.com](https://supabase.com) дээр шинэ project үүсгэнэ
2. **SQL Editor** дээр дараах файлуудыг дараалан ажиллуулна:
   - `supabase/schema.sql`
   - `supabase/feature_platform.sql` (эсвэл шинэ өөрчлөлт бүрд `supabase/migrate_*.sql` файлуудыг тус тусад нь)
3. **Storage** дээр `hazard-images` bucket үүсгэж, public болгоно
4. **Project Settings → API** дээр credentials хуулна

### 2. .env.local тохируулах

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_MOCK_MODE=false
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:hse@khanbogdkhurd.mn
CRON_SECRET=...
```

VAPID key-г `npx web-push generate-vapid-keys` командаар үүсгэнэ. `CRON_SECRET`-ийг Vercel дээр мөн адил тохируулбал, `/api/push/send-reminders` cron endpoint-ыг хамгаална (`vercel.json`-д тохируулсан хуваарийн дагуу).

### 3. Ажилчдыг DB-д оруулах

`/admin/users` хуудаснаас нэг нэгээр эсвэл CSV файлаар багцаар оруулж болно.

---

## Технологийн стек

| Давхарга | Технологи |
|----------|-----------|
| Frontend | Next.js 15, TypeScript |
| Styling  | Custom CSS (Tailwind суурьтай) |
| Database | Supabase (PostgreSQL) |
| Storage  | Supabase Storage (upload үед `sharp`-аар автоматаар шахагдана) |
| Push     | Web Push API (`web-push`), Vercel Cron |
| Auth     | SAP ID + (admin-д) PIN → HMAC-signed session cookie |
| Deploy   | Vercel |

---

*Ханбогд Хурд ХХК*
