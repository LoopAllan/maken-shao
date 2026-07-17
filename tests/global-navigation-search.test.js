import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function htmlFiles(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && !['.git', 'node_modules'].includes(entry.name)) return htmlFiles(target);
    return entry.isFile() && entry.name.endsWith('.html') ? [target] : [];
  }));
  return nested.flat();
}

test('ships the same accessible global search control on every page', async () => {
  for (const file of await htmlFiles()) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /<form class="global-search" role="search" data-global-search>/, `${path.relative(root, file)} has global search`);
    assert.match(html, /data-global-search-input/, `${path.relative(root, file)} has search input`);
    assert.match(html, /data-global-search-results/, `${path.relative(root, file)} has live results container`);
  }
});

test('global search indexes full records and links every result to its rendered section', async () => {
  const app = await readFile(path.join(root, 'assets/js/app.js'), 'utf8');
  for (const token of ['character-details.json', 'sources.json', 'plainText', 'snippetFor', 'searchHref', '#record-', 'scrollToHashTarget']) {
    assert.ok(app.includes(token), `app.js includes ${token}`);
  }
});

test('character detail renderer reverse-lists characters that directly require the current character', async () => {
  const app = await readFile(path.join(root, 'assets/js/app.js'), 'utf8');
  assert.match(app, /details\.filter\(\(candidate\) => candidate\.prerequisiteCharacterIds\.includes\(id\)\)/);
  assert.match(app, /需要此角色作為前置的角色/);
  assert.match(app, /直接前置/);
  assert.doesNotMatch(app, /同一地圖可獲得角色/);
  assert.doesNotMatch(app, /maps\.filter\(\(map\) => map\.obtainableCharacterIds\.includes\(id\)\)/);
});
