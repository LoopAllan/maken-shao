import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(target);
    return entry.name.endsWith('.html') ? [target] : [];
  }));
  return nested.flat();
}

test('removes the Boss page and every shipped navigation link to it', async () => {
  const files = await htmlFiles(root);
  assert.ok(!files.some((file) => file.endsWith('/pages/bosses.html')));
  const html = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  html.forEach((source) => assert.doesNotMatch(source, /bosses\.html|>Boss</));
});

test('keeps an opened mobile navigation fixed beneath the sticky header', async () => {
  const [app, css] = await Promise.all([
    readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8'),
    readFile(path.join(root, 'assets', 'css', 'style.css'), 'utf8')
  ]);
  assert.match(app, /function setMobileMenuOffset\(\)/);
  assert.match(app, /sidebar\.style\.setProperty\('--mobile-menu-top'/);
  assert.match(css, /\.sidebar\.is-open \{ display:block; position:fixed; top:var\(--mobile-menu-top\);/);
});
