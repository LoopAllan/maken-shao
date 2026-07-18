import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function appSource() {
  return readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8');
}

test('renders card tags above a horizontally scrollable source strip', async () => {
  const app = await appSource();
  const css = await readFile(path.join(root, 'assets', 'css', 'style.css'), 'utf8');

  assert.match(app, /function metadataStrip\(\)/);
  assert.match(app, /metadata\.className = 'card-metadata-strip'/);
  assert.match(app, /function tagStrip\(item\)/);
  assert.match(app, /tags\.className = 'card-tag-strip'/);
  assert.match(app, /sources\.className = 'card-source-strip'/);
  assert.match(app, /article\.append\(meta, tagStrip\(item\), sourceLinks\(item, sourceMap\)\)/);
  assert.match(css, /\.card-metadata-strip,\.card-tag-strip,\.card-source-strip[^}]*overflow-x:auto/);
  assert.match(css, /\.card-metadata-strip,\.card-tag-strip,\.card-source-strip[^}]*flex-wrap:nowrap/);
});

test('keeps character index cards focused and removes obsolete verification and name annotations', async () => {
  const app = await appSource();

  assert.doesNotMatch(app, /角色頁交叉參考/);
  assert.doesNotMatch(app, /Wiki 內文明示連結角色/);
  assert.doesNotMatch(app, /wikiLinkedCharacterIds/);
  assert.doesNotMatch(app, /查證註記：/);
  assert.doesNotMatch(app, /英文名：官方角色圖可讀的拉丁字樣/);
  assert.doesNotMatch(app, /if \(isCharacter && item\.nameJa && item\.nameZhHant && item\.nameEn\)/);
  assert.match(app, /overview\.append\(identity, profile, tagStrip\(character\), sourceLinks\(character, sourceMap\)\)/);
});

test('hides the prerequisite-dependent card when no character requires the current character', async () => {
  const app = await appSource();

  assert.match(app, /if \(prerequisiteDependents\.length\) \{[\s\S]*?target\.append\(prerequisiteSection\);[\s\S]*?\}/);
  assert.doesNotMatch(app, /目前沒有已查證角色以此角色作為直接前置。/);
});
