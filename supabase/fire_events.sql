-- ============================================================
-- kanari — Mémoire des feux (pages événement SEO + futurs bilans/stats)
-- Alimentée par le cron (archiveEvents). Idempotent.
-- ============================================================

create table if not exists public.fire_events (
  -- Clé de dédoublonnage : jour UTC de 1re détection + cellule ~11 km.
  -- Les ids de clustering dérivent légèrement d'un scan à l'autre ; cette
  -- clé les fusionne en un seul événement archivé.
  archive_key text primary key,
  slug        text unique not null,
  event_id    text,                    -- dernier id de clustering vu
  first_seen  timestamptz not null,
  last_seen   timestamptz not null,
  lat         double precision not null,
  lon         double precision not null,
  detections  int not null default 0,
  viirs       int not null default 0,
  goes        int not null default 0,
  mtg         int not null default 0,
  max_frp     double precision not null default 0,
  confidence  text,                    -- possible | probable | corrobore
  place       text,                    -- commune / lieu (géocodage inverse)
  admin       text,                    -- région / état
  country     text,                    -- ISO-2
  dept_code   text,                    -- France uniquement
  dept_slug   text,
  aircraft    jsonb not null default '[]'::jsonb, -- moyens aériens croisés
  post_count  int not null default 0,
  first_press timestamptz,
  status      text not null default 'active',     -- active | ended
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists fire_events_last_seen_idx on public.fire_events (last_seen desc);
create index if not exists fire_events_dept_idx      on public.fire_events (dept_slug);
create index if not exists fire_events_country_idx   on public.fire_events (country);
create index if not exists fire_events_status_idx    on public.fire_events (status);

-- RLS : aucune policy publique — seul le serveur (service_role) lit/écrit.
alter table public.fire_events enable row level security;
