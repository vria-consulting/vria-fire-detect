-- ============================================================================
-- kanari · table des contributions citoyennes (page /contribuer)
-- À coller tel quel dans Supabase → SQL Editor, puis exécuter.
-- Ensuite, dans Vercel, définir :
--   SUPABASE_URL=https://<projet>.supabase.co
--   SUPABASE_SERVICE_ROLE_KEY=<clé service_role>  (côté serveur uniquement)
-- Le code bascule automatiquement de Vercel Blob vers Supabase dès que ces
-- deux variables sont présentes. Rien d'autre à changer.
-- ============================================================================

create table if not exists public.contributions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  email        text not null,
  phone        text,
  role         text,
  message      text not null,
  attachments  jsonb not null default '[]'::jsonb,  -- [{name,url,size,type}]
  lang         text,
  user_agent   text,
  ip_hash      text,                                 -- IP hashée (jamais brute)
  -- Cycle de vie exploité par ton agent de nuit :
  status       text not null default 'new',          -- new | reviewed | accepted | rejected | done
  ai_analysis  jsonb,                                 -- rempli par l'agent (pertinence, suggestion)
  processed_at timestamptz
);

-- Index pour l'agent : « donne-moi les demandes non traitées, les plus récentes ».
create index if not exists contributions_status_created_idx
  on public.contributions (status, created_at desc);

-- Sécurité : RLS activé, AUCUNE policy publique. Seule la clé service_role
-- (serveur) peut lire/écrire — elle contourne RLS. Rien n'est exposé côté client.
alter table public.contributions enable row level security;

-- ---------------------------------------------------------------------------
-- Stockage des pièces jointes : bucket privé « contributions ».
-- (Créable aussi via l'UI Storage. Ici en SQL pour tout faire d'un coup.)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contributions', 'contributions', false)
on conflict (id) do nothing;

-- Pas de policy publique sur le bucket : seul le service_role y accède.
-- Pour l'agent de nuit, requête type :
--   select id, name, email, message, attachments, created_at
--   from public.contributions
--   where status = 'new'
--   order by created_at desc;
