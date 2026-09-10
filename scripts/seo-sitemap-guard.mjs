// Bounded cross-check of sitemap membership against the page's actual SEO signals.
// Run in CI offline and against production after deployment. No paid service required.
const base = (process.argv[2] || 'https://kanari.io').replace(/\/$/, '');
const errors = [];
const decode = (s) => s.replaceAll('&amp;', '&');
async function get(path) {
  const r = await fetch(new URL(path, base), { signal: AbortSignal.timeout(60000), redirect: 'manual' });
  if (r.status !== 200) throw new Error(`${path}: HTTP ${r.status}`);
  return { body: await r.text(), headers: r.headers };
}
for (const file of ['/sitemap.xml', '/sitemap-news.xml']) {
  const { body } = await get(file);
  let urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]));
  if (file === '/sitemap.xml') urls = urls.filter((url) => /\/statistiques\/[^/]+\/\d{4}-\d{2}$/.test(url));
  // One language per monthly report, spread across the sitemap including its tail.
  urls = urls.filter((url) => !/\/statistiques\//.test(url) || url.includes('/fr/'));
  const sample = [...new Set([urls[0], urls[Math.floor(urls.length / 2)], ...urls.slice(-4)].filter(Boolean))];
  for (const url of sample) {
    const path = new URL(url).pathname;
    try {
      const page = await get(path);
      const tags = page.body.match(/<meta\b[^>]*>|<link\b[^>]*>/gi) || [];
      const robots = tags.filter((tag) => /name=["'](?:robots|googlebot)["']/i.test(tag)).join(' ');
      if (/noindex/i.test(robots + ' ' + (page.headers.get('x-robots-tag') || ''))) throw new Error('noindex URL advertised');
      const canonical = tags.find((tag) => /rel=["']canonical["']/i.test(tag))?.match(/href=["']([^"']+)["']/i)?.[1];
      if (!canonical || new URL(decode(canonical), 'https://kanari.io').href !== url) throw new Error('missing or non-self canonical');
      console.log(`OK ${file} → ${path}`);
    } catch (error) { errors.push(`${path}: ${error.message}`); }
  }
  console.log(`${file}: ${urls.length} eligible URLs, ${sample.length} sampled`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
