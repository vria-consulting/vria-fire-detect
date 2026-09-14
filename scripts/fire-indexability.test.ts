import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFireIndexable } from '../src/lib/firearchive';

const minor = { country: 'AO', dept_code: null, post_count: 0, aircraft: [], detections: 19, max_frp: 199.9 };
test('minor international records stay excluded; exact thresholds remain inclusive', () => {
  assert.equal(isFireIndexable(minor), false);
  assert.equal(isFireIndexable({ ...minor, detections: 20 }), true);
  assert.equal(isFireIndexable({ ...minor, max_frp: 200 }), true);
});
test('local relevance and corroboration qualify independently of intensity', () => {
  assert.equal(isFireIndexable({ ...minor, country: 'FR' }), true);
  assert.equal(isFireIndexable({ ...minor, dept_code: '89' }), true);
  assert.equal(isFireIndexable({ ...minor, post_count: 1 }), true);
  assert.equal(isFireIndexable({ ...minor, aircraft: [{ id: 'test-aircraft' }] }), true);
});
test('missing optional evidence does not qualify a minor record', () => {
  assert.equal(isFireIndexable({ ...minor, country: null, post_count: null }), false);
});
