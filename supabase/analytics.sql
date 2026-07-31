-- ============================================================
-- kanari — Veille d'audience (cookieless / RGPD) + enrichissement contributions
-- A exécuter dans le SQL editor Supabase (projet kanari).
-- Idempotent : peut être rejoué sans risque.
-- ============================================================

-- 1) Journal des visites -------------------------------------------------
--    Aucune donnée personnelle : l'IP n'est jamais stockée, seulement un
--    hash quotidien salé (compte les visiteurs uniques sans cookie, méthode
--    Plausible). RLS activé, aucune policy publique : seul le serveur
--    (clé service_role) lit/écrit.
create table if not exists public.page_views (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  path          text not null,
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  country       text,          -- code pays ISO (en-tête géo Vercel)
  region        text,
  city          text,
  device        text,          -- mobile | tablet | desktop
  browser       text,
  os            text,
  lang          text,          -- fr | en | ...
  screen_w      int,
  screen_h      int,
  visitor_hash  text,          -- sha256(IP + UA + sel du jour) tronqué
  is_bot        boolean not null default false
);

create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx     on public.page_views (path);
create index if not exists page_views_visitor_idx  on public.page_views (visitor_hash);
create index if not exists page_views_country_idx  on public.page_views (country);

alter table public.page_views enable row level security;

-- 2) Provenance des contributions ---------------------------------------
alter table public.contributions add column if not exists referrer_host text;
alter table public.contributions add column if not exists utm_source   text;
alter table public.contributions add column if not exists utm_medium   text;
alter table public.contributions add column if not exists utm_campaign text;
alter table public.contributions add column if not exists country      text;
alter table public.contributions add column if not exists device       text;

-- 3) Agrégats du dashboard ----------------------------------------------
--    Une seule fonction -> tout le JSON du tableau de bord. Poussé côté
--    Postgres (indexé, rapide), l'API serveur ne fait qu'un appel /rpc.
create or replace function public.veille_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with pv as (select * from page_views where is_bot = false)
  select jsonb_build_object(
    'generated_at', now(),
    'live', (select count(distinct visitor_hash) from pv where created_at > now() - interval '5 minutes'),
    'totals', jsonb_build_object(
      'today_views',   (select count(*) from pv where created_at >= date_trunc('day', now())),
      'today_uniques', (select count(distinct visitor_hash) from pv where created_at >= date_trunc('day', now())),
      'views_7d',      (select count(*) from pv where created_at > now() - interval '7 days'),
      'uniques_7d',    (select count(distinct visitor_hash) from pv where created_at > now() - interval '7 days'),
      'views_30d',     (select count(*) from pv where created_at > now() - interval '30 days'),
      'uniques_30d',   (select count(distinct visitor_hash) from pv where created_at > now() - interval '30 days'),
      'views_all',     (select count(*) from pv),
      'uniques_all',   (select count(distinct visitor_hash) from pv)
    ),
    'daily', (select coalesce(jsonb_agg(row_to_json(d) order by d.day), '[]'::jsonb) from (
      select date_trunc('day', created_at)::date as day, count(*) as views,
             count(distinct visitor_hash) as uniques
      from pv where created_at > now() - interval '30 days' group by 1 order by 1) d),
    'hourly', (select coalesce(jsonb_agg(row_to_json(h) order by h.hour), '[]'::jsonb) from (
      select date_trunc('hour', created_at) as hour, count(*) as views
      from pv where created_at > now() - interval '24 hours' group by 1 order by 1) h),
    'top_paths', (select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) from (
      select path, count(*) as views from pv where created_at > now() - interval '7 days'
      group by 1 order by 2 desc limit 12) p),
    'top_referrers', (select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) from (
      select coalesce(nullif(referrer_host,''), '(direct)') as host, count(*) as views
      from pv where created_at > now() - interval '7 days' group by 1 order by 2 desc limit 12) r),
    'countries', (select coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) from (
      select coalesce(nullif(country,''),'??') as country, count(*) as views
      from pv where created_at > now() - interval '30 days' group by 1 order by 2 desc limit 12) c),
    'devices', (select coalesce(jsonb_agg(row_to_json(d)), '[]'::jsonb) from (
      select coalesce(nullif(device,''),'?') as device, count(*) as views
      from pv where created_at > now() - interval '30 days' group by 1 order by 2 desc) d),
    'browsers', (select coalesce(jsonb_agg(row_to_json(b)), '[]'::jsonb) from (
      select coalesce(nullif(browser,''),'?') as browser, count(*) as views
      from pv where created_at > now() - interval '30 days' group by 1 order by 2 desc limit 8) b),
    'utm', (select coalesce(jsonb_agg(row_to_json(u)), '[]'::jsonb) from (
      select coalesce(nullif(utm_source,''),'(aucune)') as source,
             coalesce(nullif(utm_campaign,''),'') as campaign,
             count(*) as views, count(distinct visitor_hash) as uniques
      from pv where created_at > now() - interval '30 days' group by 1,2 order by 3 desc limit 12) u),
    'langs', (select coalesce(jsonb_agg(row_to_json(l)), '[]'::jsonb) from (
      select coalesce(nullif(lang,''),'?') as lang, count(*) as views
      from pv where created_at > now() - interval '30 days' group by 1 order by 2 desc) l),
    'contrib', jsonb_build_object(
      'total', (select count(*) from contributions),
      'new',   (select count(*) from contributions where status = 'new'),
      'today', (select count(*) from contributions where created_at >= date_trunc('day', now())),
      'views_contrib_7d', (select count(*) from pv where path like '%contribuer%' and created_at > now() - interval '7 days'),
      'recent', (select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb) from (
        select id, created_at, name, email, role, left(message, 140) as message,
               jsonb_array_length(coalesce(attachments,'[]'::jsonb)) as files,
               status, coalesce(nullif(utm_source,''), referrer_host) as source, country
        from contributions order by created_at desc limit 20) x)
    )
  );
$$;

-- Verrouillage : seul le serveur (service_role) peut appeler la fonction.
revoke all on function public.veille_stats() from public, anon, authenticated;
grant execute on function public.veille_stats() to service_role;
