-- Visibilité SEO + IA (onglet « Visibilité » de /veille).
-- bot_hits : chaque chargement de page par un crawler SEO ou IA (inséré par
-- le middleware, fire-and-forget). ChatGPT-User / Perplexity-User = fetchs
-- déclenchés par une vraie question d'utilisateur → meilleur signal gratuit
-- de « kanari consulté par une IA ».
create table if not exists public.bot_hits (
  id   bigint generated always as identity primary key,
  ts   timestamptz not null default now(),
  day  date not null default (now() at time zone 'utc')::date,
  bot  text not null,
  path text not null
);
create index if not exists bot_hits_bot_day_idx on public.bot_hits (bot, day);
create index if not exists bot_hits_day_idx on public.bot_hits (day);
alter table public.bot_hits enable row level security;

-- ai_citations : le panel hebdomadaire « kanari est-il cité ? » (rempli par
-- le cron via l'API OpenAI + recherche web).
create table if not exists public.ai_citations (
  id       bigint generated always as identity primary key,
  ts       timestamptz not null default now(),
  week     text not null,   -- ex. 2026-W32
  engine   text not null,   -- chatgpt-search, perplexity…
  question text not null,
  cited    boolean not null,
  position int,             -- rang de kanari dans les sources citées
  sources  jsonb            -- domaines cités par la réponse
);
create index if not exists ai_citations_week_idx on public.ai_citations (week);
alter table public.ai_citations enable row level security;

-- Agrégats servis à /api/veille/visibility (service_role uniquement).
create or replace function public.veille_visibility()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'bots_daily', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select day, bot, count(*)::int as hits
        from bot_hits
        where day >= (now() at time zone 'utc')::date - 13
        group by day, bot
        order by day
      ) x
    ),
    'bots_totals', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select bot,
          count(*) filter (where day >= (now() at time zone 'utc')::date - 6)::int  as hits_7d,
          count(*) filter (where day <  (now() at time zone 'utc')::date - 6)::int  as hits_prev7
        from bot_hits
        where day >= (now() at time zone 'utc')::date - 13
        group by bot
        order by hits_7d desc
      ) x
    ),
    'bot_top_paths', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select path, count(*)::int as hits
        from bot_hits
        where day >= (now() at time zone 'utc')::date - 6
        group by path
        order by hits desc
        limit 12
      ) x
    ),
    'ai_referrals', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select referrer_host as host,
          count(*) filter (where created_at >= now() - interval '7 days')::int as views_7d,
          count(*) filter (where created_at <  now() - interval '7 days')::int as views_prev7
        from page_views
        where created_at >= now() - interval '14 days'
          and referrer_host in (
            'chatgpt.com','chat.openai.com','perplexity.ai','www.perplexity.ai',
            'copilot.microsoft.com','gemini.google.com','claude.ai','you.com',
            'phind.com','poe.com'
          )
        group by referrer_host
        order by views_7d desc
      ) x
    ),
    'citations', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select week, engine, question, cited, position, ts
        from ai_citations
        where week in (select distinct week from ai_citations order by week desc limit 2)
        order by week desc, question, engine
      ) x
    )
  );
$$;
revoke all on function public.veille_visibility() from public, anon, authenticated;
