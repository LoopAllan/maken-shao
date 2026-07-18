import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('moves image provenance and rights notices into alt text instead of visible captions', async () => {
  const app = await readFile(path.join(root, 'assets/js/app.js'), 'utf8');
  assert.match(app, /function characterImageAlt\(/);
  assert.match(app, /function mapImageAlt\(/);
  assert.match(app, /function techniqueImageAlt\(/);
  assert.match(app, /item\.imageRightsNote/);
  assert.match(app, /media\.associationPageUrl/);
  assert.match(app, /media\.archiveUrl/);
  assert.doesNotMatch(app, /document\.createElement\('figcaption'\)/);
  assert.doesNotMatch(app, /figure\.append\(image, caption\)/);
});
