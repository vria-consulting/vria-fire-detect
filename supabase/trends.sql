-- Onglet « Tendances » + drill-down par jour de /veille (2026-08-14).
-- Deux RPC service_role : veille_trends() (séries d'évolution 30 j) et
-- veille_day(d) (détail d'une journée cliquée). Posées via l'API de
-- management comme les précédentes (visibility.sql, backlinks).

create or replace function public.veille_trends()
returns jsonb
language sql
security definer
set search_path = public
as $$
  with days as (
    select generate_series(
      (now() at time zone 'utc')::date - 29,
      (now() at time zone 'utc')::date,
      interval '1 day'
    )::date as day
  ),
  pv as (
    select created_at::date as day,
      case
        when referrer_host is null or referrer_host = '' then 'direct'
        when referrer_host ilike '%google.%' or referrer_host ilike '%bing.com%'
          or referrer_host ilike '%duckduckgo%' or referrer_host ilike '%ecosia%'
          or referrer_host ilike '%qwant%' or referrer_host ilike '%yandex%'
          or referrer_host ilike '%search.yahoo%' or referrer_host ilike '%startpage%'
          or referrer_host ilike '%brave.%' then 'search'
        when referrer_host ilike '%linkedin%' or referrer_host = 'lnkd.in'
          or referrer_host ilike '%facebook%' or referrer_host = 't.co'
          or referrer_host ilike '%twitter%' or referrer_host = 'x.com'
          or referrer_host ilike '%instagram%' or referrer_host ilike '%reddit%'
          or referrer_host ilike '%threads%' or referrer_host ilike '%bsky%'
          or referrer_host ilike '%mastodon%' then 'social'
        when referrer_host in (
          'chatgpt.com','chat.openai.com','perplexity.ai','www.perplexity.ai',
          'copilot.microsoft.com','gemini.google.com','claude.ai','you.com'
        ) then 'ai'
        else 'referral'
      end as channel,
      visitor_hash
    from page_views
    where created_at >= (now() at time zone 'utc')::date - 29
      and not coalesce(is_bot, false)
  )
  select jsonb_build_object(
    'generated_at', now(),
    'channels_daily', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
        select d.day,
          count(p.*) filter (where p.channel = 'search')::int   as search,
          count(p.*) filter (where p.channel = 'social')::int   as social,
          count(p.*) filter (where p.channel = 'direct')::int   as direct,
          count(p.*) filter (where p.channel = 'ai')::int       as ai,
          count(p.*) filter (where p.channel = 'referral')::int as referral,
          count(p.*)::int                                       as total,
          count(distinct p.visitor_hash)::int                   as uniques
        from days d
        left join pv p on p.day = d.day
        group by d.day
      ) x
    ),
    'bots_daily', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
        select d.day,
          count(b.*) filter (where b.bot in (
            'GPTBot','ChatGPT-User','OAI-SearchBot','ClaudeBot','Claude-User',
            'Claude-SearchBot','PerplexityBot','Perplexity-User','Meta',
            'Amazonbot','Applebot','Bytespider','CCBot','Google-Extended'
          ))::int as ai,
          count(b.*) filter (where b.bot in (
            'Googlebot','GoogleOther','Bingbot','DuckDuckBot','YandexBot',
            'Qwantbot','SeznamBot'
          ))::int as engines
        from days d
        left join bot_hits b on b.day = d.day
        group by d.day
      ) x
    ),
    'citations_weekly', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.week), '[]'::jsonb) from (
        select week, count(*)::int as total, count(*) filter (where cited)::int as cited
        from ai_citations
        group by week
      ) x
    ),
    'domains_cumul', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.day), '[]'::jsonb) from (
        with firsts as (
          select referrer_host, min(created_at)::date as first_day
          from page_views
          where referrer_host is not null and referrer_host <> ''
            and referrer_host not ilike '%kanari%'
          group by referrer_host
        )
        select d.day, (select count(*) from firsts f where f.first_day <= d.day)::int as domains
        from days d
      ) x
    )
  )
$$;
revoke all on function public.veille_trends() from public, anon, authenticated;

create or replace function public.veille_day(d date)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'day', d,
    'totals', (
      select jsonb_build_object(
        'views', count(*)::int,
        'uniques', count(distinct visitor_hash)::int
      )
      from page_views
      where created_at::date = d and not coalesce(is_bot, false)
    ),
    'hourly', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.hour), '[]'::jsonb) from (
        select h.hour,
          count(p.*) filter (where not coalesce(p.is_bot, false))::int as views
        from generate_series(0, 23) as h(hour)
        left join page_views p
          on p.created_at::date = d
          and extract(hour from p.created_at at time zone 'Europe/Paris')::int = h.hour
        group by h.hour
      ) x
    ),
    'top_paths', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select path, count(*)::int as views
        from page_views
        where created_at::date = d and not coalesce(is_bot, false)
        group by path order by views desc limit 14
      ) x
    ),
    'referrers', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select coalesce(nullif(referrer_host, ''), 'direct') as host, count(*)::int as views
        from page_views
        where created_at::date = d and not coalesce(is_bot, false)
        group by 1 order by views desc limit 12
      ) x
    ),
    'countries', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select coalesce(nullif(country, ''), '??') as country, count(*)::int as views
        from page_views
        where created_at::date = d and not coalesce(is_bot, false)
        group by 1 order by views desc limit 8
      ) x
    ),
    'devices', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select coalesce(nullif(device, ''), '?') as device, count(*)::int as views
        from page_views
        where created_at::date = d and not coalesce(is_bot, false)
        group by 1 order by views desc limit 5
      ) x
    ),
    'bots', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select bot, count(*)::int as hits
        from bot_hits
        where day = d
        group by bot order by hits desc limit 14
      ) x
    )
  )
$$;
revoke all on function public.veille_day(date) from public, anon, authenticated;
