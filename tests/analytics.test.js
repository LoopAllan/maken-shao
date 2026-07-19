import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const measurementId = 'G-T37QS0HH08';
const gtagSrc = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;

async function htmlFiles(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && !['.git', 'node_modules'].includes(entry.name)) return htmlFiles(target);
    return entry.isFile() && entry.name.endsWith('.html') ? [target] : [];
  }));
  return nested.flat();
}

test('ships the supplied GA4 baseline tag on every page and preserves it in page generators', async () => {
  const pages = await htmlFiles();
  assert.ok(pages.length > 0);

  for (const page of pages) {
    const html = await readFile(page, 'utf8');
    assert.match(html, new RegExp(`<script async src="${gtagSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"><\\/script>`));
    assert.match(html, /window\.dataLayer = window\.dataLayer \|\| \[\];/);
    assert.match(html, /gtag\('config', 'G-T37QS0HH08'\);/);
  }

  const [generator, shellUpdater] = await Promise.all([
    readFile(path.join(root, 'scripts', 'generate-character-pages.js'), 'utf8'),
    readFile(path.join(root, 'scripts', 'update-static-shell.js'), 'utf8')
  ]);
  assert.match(generator, /G-T37QS0HH08/);
  assert.match(shellUpdater, /G-T37QS0HH08/);
});
