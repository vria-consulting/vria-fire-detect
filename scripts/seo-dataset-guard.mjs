// Validate rendered JSON-LD, including nested Datasets, in all supported languages.
// node scripts/seo-dataset-guard.mjs [base URL]; no secrets or paid API required.
import assert from 'node:assert/strict';
const base = (process.argv[2] || 'http://localhost:3114').replace(/\/$/, '');
const paths = ['fr', 'en', 'es', 'pt'].flatMap(lang => [
  `/${lang}/methodologie`, `/${lang}/statistiques`, `/${lang}/statistiques/world/2026-08`,
]);
function objects(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(objects)];
}
const failures = [];
for (const path of paths) {
  try {
    const response = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200, `HTTP ${response.status}`);
    const html = await response.text();
    const nodes = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .flatMap(match => objects(JSON.parse(match[1])));
    const datasets = nodes.filter(node => [node['@type']].flat().includes('Dataset'));
    assert.ok(datasets.length > 0, 'Dataset absent');
    for (const dataset of datasets) {
      assert.ok(typeof dataset.name === 'string' && dataset.name.trim(), 'name absent');
      assert.ok(typeof dataset.description === 'string' && dataset.description.trim().length >= 50 && dataset.description.length <= 5000, 'description must contain 50–5000 characters');
      assert.ok(dataset.creator, 'creator absent');
      for (const creator of [dataset.creator].flat()) {
        const entity = creator.name ? creator : nodes.find(node => node['@id'] === creator['@id'] && node.name);
        assert.ok(entity && ['Person', 'Organization'].some(type => [entity['@type']].flat().includes(type)), 'creator must resolve to a named Person/Organization in the rendered graph');
      }
    }
    console.log(`OK ${path}: ${datasets.length} Dataset(s)`);
  } catch (error) {
    failures.push(`${path}: ${error.message}`);
  }
}
console.log(`${paths.length - failures.length}/${paths.length} rendered pages valid`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
