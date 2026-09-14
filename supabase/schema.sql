-- ============================================================
-- HSE Safety App — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Locations ────────────────────────────────────────────────
create table public.locations (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  name_en    text not null,
  qr_code    text unique not null,
  aimag      text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Users ────────────────────────────────────────────────────
-- Locations хүснэгтийн дараа үүсгэнэ (location_id foreign key).
create table public.users (
  id            uuid primary key default uuid_generate_v4(),
  sap_id        text unique not null,
  name          text not null,
  name_en       text,
  department    text not null,
  department_en text,
  location_id   uuid references public.locations(id),
  role          text not null default 'driver' check (role in ('driver', 'admin')),
  total_score   integer not null default 0,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  last_active   timestamptz
);

-- ── Hazard Images ────────────────────────────────────────────
create table public.hazard_images (
  id         uuid primary key default uuid_generate_v4(),
  image_url  text not null,
  location_id uuid references public.locations(id),
  date       date not null,
  title      text,
  title_en   text,
  hazards    jsonb not null default '[]',
  created_by text not null,
  created_at timestamptz not null default now()
);

-- ── Daily Sessions ───────────────────────────────────────────
create table public.daily_sessions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.users(id) on delete cascade,
  image_id     uuid not null references public.hazard_images(id) on delete cascade,
  date         date not null,
  score        integer not null default 0,
  completed    boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique(user_id, image_id, date)
);

-- ── Hazard Answers ───────────────────────────────────────────
create table public.hazard_answers (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid not null references public.daily_sessions(id) on delete cascade,
  hazard_id       text not null,
  question_id     text not null,
  selected_option integer not null,
  is_correct      boolean not null,
  answered_at     timestamptz not null default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table public.users enable row level security;
alter table public.locations enable row level security;
alter table public.hazard_images enable row level security;
alter table public.daily_sessions enable row level security;
alter table public.hazard_answers enable row level security;

-- Users: өөрийн мэдээллийг харж болно; admin бүгдийг харна
create policy "users_select_own" on public.users
  for select using (sap_id = current_setting('app.current_sap_id', true) or
                    current_setting('app.current_role', true) = 'admin');

create policy "users_update_own" on public.users
  for update using (sap_id = current_setting('app.current_sap_id', true));

-- Locations: бүгд харж болно
create policy "locations_select_all" on public.locations
  for select using (true);

-- Hazard images: бүгд харж болно; admin засаж болно
create policy "images_select_all" on public.hazard_images
  for select using (true);

create policy "images_insert_admin" on public.hazard_images
  for insert with check (current_setting('app.current_role', true) = 'admin');

-- Daily sessions: өөрийн session-ийг харна; admin бүгдийг
create policy "sessions_select_own" on public.daily_sessions
  for select using (user_id::text = current_setting('app.current_user_id', true) or
                    current_setting('app.current_role', true) = 'admin');

create policy "sessions_insert_own" on public.daily_sessions
  for insert with check (user_id::text = current_setting('app.current_user_id', true));

create policy "sessions_update_own" on public.daily_sessions
  for update using (user_id::text = current_setting('app.current_user_id', true));

-- Hazard answers: session-той холбоотой
create policy "answers_select_own" on public.hazard_answers
  for select using (
    session_id in (
      select id from public.daily_sessions
      where user_id::text = current_setting('app.current_user_id', true)
    ) or current_setting('app.current_role', true) = 'admin'
  );

create policy "answers_insert_own" on public.hazard_answers
  for insert with check (
    session_id in (
      select id from public.daily_sessions
      where user_id::text = current_setting('app.current_user_id', true)
    )
  );

-- ============================================================
-- Индексүүд
-- ============================================================

create index idx_sessions_user_date on public.daily_sessions(user_id, date);
create index idx_sessions_image on public.daily_sessions(image_id);
create index idx_answers_session on public.hazard_answers(session_id);
create index idx_images_date_location on public.hazard_images(date, location_id);
create index idx_users_sap on public.users(sap_id);

-- ============================================================
-- Trigger: session дуусахад total_score шинэчлэнэ
-- ============================================================

create or replace function update_user_score()
returns trigger language plpgsql as $$
begin
  if NEW.completed = true and OLD.completed = false then
    update public.users
    set total_score = total_score + (NEW.score - OLD.score),
        last_active = now()
    where id = NEW.user_id;
  end if;
  return NEW;
end;
$$;

create trigger on_session_complete
  after update on public.daily_sessions
  for each row execute function update_user_score();

-- ============================================================
-- Sample data (locations)
-- ============================================================

insert into public.locations (name, name_en, qr_code, aimag) values
  ('УБ салбар', 'UB Branch', 'HK-LOC-005', 'Улаанбаатар'),
  ('Оюу Толгойн салбар', 'Oyu Tolgoi Branch', 'HK-LOC-OT', 'Өмнөговь');
