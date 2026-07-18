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
  assert.match(app, /metadata\.tabIndex = 0/);
  assert.match(app, /function tagStrip\(item\)/);
  assert.match(app, /tags\.className = 'card-tag-strip'/);
  assert.match(app, /sources\.className = 'card-source-strip'/);
  assert.match(app, /article\.append\(meta, tagStrip\(item\), sourceLinks\(item, sourceMap\)\)/);
  assert.match(css, /\.card-metadata-strip,\.card-tag-strip,\.card-source-strip[^}]*overflow-x:auto/);
  assert.match(css, /\.card-metadata-strip,\.card-tag-strip,\.card-source-strip[^}]*flex-wrap:nowrap/);
});

test('migrates static card metadata to the same keyboard-scrollable strip', async () => {
  const pages = await Promise.all(['endings.html', 'knowledge.html'].map((file) => readFile(path.join(root, 'pages', file), 'utf8')));
  pages.forEach((html) => {
    assert.doesNotMatch(html, /class="metadata"/);
    assert.match(html, /class="card-metadata-strip" aria-label="屬性" tabindex="0"/);
  });
});

test('keeps character index cards focused and removes obsolete verification and name annotations', async () => {
  const app = await appSource();

  assert.doesNotMatch(app, /角色頁交叉參考/);
  assert.doesNotMatch(app, /Wiki 內文明示連結角色/);
  assert.doesNotMatch(app, /wikiLinkedCharacterIds/);
  assert.doesNotMatch(app, /查證註記：/);
  assert.doesNotMatch(app, /英文名：官方角色圖可讀的拉丁字樣/);
  assert.doesNotMatch(app, /if \(isCharacter && item\.nameJa && item\.nameZhHant && item\.nameEn\)/);
  assert.match(app, /function characterProfileSource\(character\)/);
  assert.match(app, /profileSource\.className = 'character-profile-source'/);
  assert.match(app, /heading\.textContent = '人物檔案固定版本來源'/);
  assert.match(app, /各段落的版本範圍與實際引用 revision 已直接標在正文下方/);
  assert.match(app, /overview\.append\(identity, profile\);[\s\S]*?overview\.append\(profileSource\);[\s\S]*?overview\.append\(tagStrip\(character\), sourceLinks\(character, sourceMap\)\)/);
});

test('ships a complete, structured Fandom-backed profile for every character detail page', async () => {
  const characters = JSON.parse(await readFile(path.join(root, 'data', 'characters.json'), 'utf8'));
  assert.equal(characters.length, 28);
  for (const character of characters) {
    assert.ok(character.profile.introduction.length >= 40, `${character.id} has a substantive introduction`);
    assert.ok(character.profile.background.length >= 120, `${character.id} has a substantive story background`);
    assert.ok(character.profile.personality.length >= 60, `${character.id} has a substantive personality account`);
    assert.ok(character.communityReferences?.[0]?.pageUrl, `${character.id} cites its Fandom character page`);
    assert.ok(character.communityReferences?.[0]?.revisionId, `${character.id} pins the source revision`);
    for (const field of ['introduction', 'background', 'personality', 'appearanceAndAbilities']) {
      const provenance = character.profileProvenance?.[field];
      assert.ok(provenance?.versionScope?.length >= 12, `${character.id}.${field} declares a visible version scope`);
      assert.ok(provenance?.referenceTitles?.length >= 1, `${character.id}.${field} cites at least one revision`);
      for (const title of provenance.referenceTitles) {
        assert.ok(character.communityReferences.some((reference) => reference.pageTitle === title), `${character.id}.${field} resolves ${title}`);
      }
    }
  }
});

test('renders every profile section directly with revision-pinned citations and no spoiler controls', async () => {
  const app = await appSource();

  assert.match(app, /characterProfileSection\('角色介紹', character\.profile\.introduction, character\.profileProvenance\.introduction, references\)/);
  assert.match(app, /characterProfileSection\('故事背景', character\.profile\.background, character\.profileProvenance\.background, references\)/);
  assert.match(app, /characterProfileSection\('人物個性', character\.profile\.personality, character\.profileProvenance\.personality, references\)/);
  assert.match(app, /characterProfileSection\('外觀與能力', character\.profile\.appearanceAndAbilities, character\.profileProvenance\.appearanceAndAbilities, references\)/);
  assert.match(app, /url\.searchParams\.set\('oldid', String\(reference\.revisionId\)\)/);
  assert.match(app, /provenance\.referenceTitles\.forEach/);
  assert.doesNotMatch(app, /createElement\('details'\)[\s\S]{0,500}character\.profile/);
});

test('hides the prerequisite-dependent card when no character requires the current character', async () => {
  const app = await appSource();

  assert.match(app, /if \(prerequisiteDependents\.length\) \{[\s\S]*?target\.append\(prerequisiteSection\);[\s\S]*?\}/);
  assert.doesNotMatch(app, /目前沒有已查證角色以此角色作為直接前置。/);
});
