import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCacheName, currentCacheName } from '../scripts/release.mjs';

test('sw.js tiene el hash de la versión actual (si falla: npm run release)', () => {
  assert.equal(currentCacheName(), computeCacheName());
});
