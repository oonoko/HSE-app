-- Hazard / near-miss / incident reports submitted by drivers (and guests).
create table if not exists public.hazard_reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid references public.users(id) on delete set null,
  shift_number  smallint,
  anonymous     boolean not null default false,
  kind          text not null check (kind in ('hazard', 'near_miss', 'incident')),
  category      text not null check (category in ('road', 'vehicle', 'behavior', 'ppe', 'fire', 'environment', 'health', 'other')),
  severity      text not null check (severity in ('low', 'medium', 'high', 'critical')),
  location_text text not null check (char_length(location_text) between 2 and 200),
  latitude      double precision,
  longitude     double precision,
  description   text not null check (char_length(description) between 5 and 2000),
  image_urls    jsonb not null default '[]'::jsonb check (jsonb_typeof(image_urls) = 'array' and jsonb_array_length(image_urls) <= 3),
  status        text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'rejected')),
  admin_note    text,
  handled_by    uuid references public.users(id) on delete set null,
  handled_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_hazard_reports_status_time on public.hazard_reports(status, created_at desc);
create index if not exists idx_hazard_reports_reporter on public.hazard_reports(reporter_id, created_at desc);

alter table public.hazard_reports enable row level security;
