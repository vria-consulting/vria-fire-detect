#!/usr/bin/env bash
# Photographie SEO de kanari.io en production (regle zero : avant / apres).
# Usage : scripts/seo-baseline.sh [https://kanari.io] > docs/seo-baseline-<date>.txt
# Enregistre : robots.txt, statut HTTP de chaque URL des sitemaps, et pour les
# pages cles : title, description, canonical, hreflang, types JSON-LD, mots <main>.
set -u
BASE="${1:-https://kanari.io}"
UA="kanari-seo-baseline"
CONC=6

echo "# kanari SEO baseline"
echo "# base: $BASE"
echo "# date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
echo "## robots.txt"
curl -s -A "$UA" "$BASE/robots.txt"
echo
echo "## llms.txt (statut, taille)"
curl -s -A "$UA" -o /dev/null -w "%{http_code} %{size_download}o\n" "$BASE/llms.txt"
echo
echo "## redirections"
for u in "http://kanari.io/fr" "https://www.kanari.io/fr" "https://vria-fire-detect.vercel.app/fr" "$BASE/" ; do
  printf "%-45s " "$u"
  curl -s -A "$UA" -o /dev/null -I -w "%{http_code} -> %{redirect_url}\n" "$u"
done
echo
echo "## 404"
curl -s -A "$UA" -o /dev/null -w "%{http_code} pour /fr/page-inexistante-xyz\n" "$BASE/fr/page-inexistante-xyz"
echo

echo "## pages cles"
KEY_PAGES="/fr /en /es /pt /fr/a-propos /fr/methodologie /fr/canadair /fr/canadair/f-zbmg /fr/statistiques /fr/statistiques/france /fr/statistiques/france/2026-08 /fr/feux /fr/feux/savoie /en/fires /en/fires/germany /fr/guide /fr/guide/odeur-de-fumee-que-faire /fr/guide/comment-fonctionne-un-canadair /fr/feux-en-cours /fr/feu /fr/newsletter /fr/api /fr/widget /fr/faq /fr/confidentialite /fr/precocite /fr/bilan"
for p in $KEY_PAGES; do
  tmp=$(mktemp)
  code=$(curl -s -A "$UA" -o "$tmp" -w "%{http_code}" "$BASE$p")
  python3 - "$p" "$code" "$tmp" <<'PY'
import sys,re,html,json
p,code,f=sys.argv[1],sys.argv[2],sys.argv[3]
h=open(f,encoding='utf-8',errors='replace').read()
def one(rx):
    m=re.search(rx,h,re.I|re.S); return html.unescape(m.group(1)).strip() if m else ''
title=one(r'<title>([^<]*)</title>')
desc=one(r'<meta\s+name="description"\s+content="([^"]*)"')
canon=one(r'<link\s+rel="canonical"\s+href="([^"]*)"')
h1s=re.findall(r'<h1[^>]*>(.*?)</h1>',h,re.I|re.S)
h1=[re.sub(r'<[^>]+>','',x).strip()[:60] for x in h1s]
hl=re.findall(r'hreflang="([^"]+)"',h,re.I)
robots=one(r'<meta\s+name="robots"\s+content="([^"]*)"')
og=one(r'<meta\s+property="og:image"\s+content="([^"]*)"')
types=set(); bad=0
for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>',h,re.S):
    try:
        d=json.loads(m.group(1))
        def walk(n):
            if isinstance(n,dict):
                t=n.get('@type')
                if isinstance(t,str): types.add(t)
                elif isinstance(t,list): types.update(t)
                for v in n.values(): walk(v)
            elif isinstance(n,list):
                for v in n: walk(v)
        walk(d)
    except Exception: bad+=1
m=re.search(r'<main[^>]*>(.*?)</main>',h,re.S|re.I)
body=m.group(1) if m else h
body=re.sub(r'<script.*?</script>','',body,flags=re.S)
body=re.sub(r'<style.*?</style>','',body,flags=re.S)
words=len(re.sub(r'<[^>]+>',' ',body).split())
print(f"### {p}")
print(f"http={code} words_main={words} title_len={len(title)} desc_len={len(desc)} h1_count={len(h1)} hreflang_count={len(hl)} jsonld_bad={bad}")
print(f"title={title}")
print(f"desc={desc}")
print(f"canonical={canon}")
print(f"h1={h1}")
print(f"hreflang={sorted(set(hl))}")
print(f"robots={robots or '(aucune)'}")
print(f"og:image={og}")
print(f"jsonld={sorted(types)}")
print()
PY
  rm -f "$tmp"
done

echo "## statut HTTP de chaque URL des sitemaps"
for s in sitemap.xml sitemap-news.xml sitemap-events.xml; do
  echo "### $s"
  curl -s -A "$UA" "$BASE/$s" | grep -oE '<loc>[^<]+</loc>' | sed 's/<[^>]*>//g' \
  | xargs -P "$CONC" -I{} sh -c 'printf "%s %s\n" "$(curl -s -A kanari-seo-baseline -o /dev/null -I -w "%{http_code}" "{}")" "{}"' \
  | sort -k2
  echo
done
