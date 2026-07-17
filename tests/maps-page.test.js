import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateDataset, validateMapMediaFiles, validateMapReferences } from '../scripts/validate-data.js';

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

test('ships a map encyclopedia page backed by maps.json', async () => {
  const page = await readFile(path.join(root, 'pages/maps.html'), 'utf8');
  assert.match(page, /<h1[^>]*>地圖圖鑑<\/h1>/);
  assert.match(page, /data-content-file="maps\.json"/);
  assert.match(page, /data-map-results/);
});

test('loads map mention linking before app.js on every site page', async () => {
  for (const file of await htmlFiles()) {
    const html = await readFile(file, 'utf8');
    const mapLinks = html.indexOf('map-links.js');
    const app = html.indexOf('app.js');
    assert.ok(mapLinks >= 0, `${path.relative(root, file)} loads map-links.js`);
    assert.ok(app > mapLinks, `${path.relative(root, file)} loads map-links.js before app.js`);
  }
});

test('adds the map encyclopedia to every primary navigation', async () => {
  for (const file of await htmlFiles()) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /href="(?:(?:\.\.\/)*|\.\/)?(?:pages\/)?maps\.html"/, `${path.relative(root, file)} links maps.html`);
  }
});

test('map renderer exposes multilingual titles, media, prerequisites, characters, and enemies', async () => {
  const app = await readFile(path.join(root, 'assets/js/app.js'), 'utf8');
  for (const token of ['map-card', 'map-media-gallery', '前置地圖', '可獲得角色', '敵人', 'map-link', 'map-preview-card', 'associationNote']) {
    assert.ok(app.includes(token), `app.js includes ${token}`);
  }
});

test('validates sourced map records and byte-exact local gameplay images', async () => {
  const [maps, schema, sources, characters, walkthrough] = await Promise.all([
    readFile(path.join(root, 'data/maps.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'schemas/map.schema.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data/sources.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data/characters.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data/walkthrough.json'), 'utf8').then(JSON.parse)
  ]);
  const sourceIds = new Set(sources.map((source) => source.id));
  const characterIds = new Set(characters.map((character) => character.id));
  const walkthroughIds = new Set(walkthrough.map((record) => record.id));
  assert.deepEqual(validateDataset({ fileName: 'maps.json', records: maps, sourceIds, type: 'map', schema }), []);
  assert.deepEqual(validateMapReferences(maps, characters, walkthrough, sources), []);
  assert.deepEqual(validateMapMediaFiles(maps, root), []);

  const unknownPrerequisite = structuredClone(maps);
  unknownPrerequisite[1].requiredMapIds = ['missing-map'];
  assert.match(validateMapReferences(unknownPrerequisite, characters, walkthrough, sources).join('\n'), /unknown prerequisite map "missing-map"/i);
  const unknownCharacter = structuredClone(maps);
  unknownCharacter[0].obtainableCharacterIds = ['missing-character'];
  assert.match(validateMapReferences(unknownCharacter, characters, walkthrough, sources).join('\n'), /unknown obtainable character "missing-character"/i);
  const escapedMedia = structuredClone(maps);
  escapedMedia[0].images[0].path = 'assets/images/maps/../../../data/maps.json';
  assert.match(validateMapMediaFiles(escapedMedia, root).join('\n'), /escapes assets\/images\/maps/i);
  const wrongBytes = structuredClone(maps);
  wrongBytes[0].images[0].bytes += 1;
  assert.match(validateMapMediaFiles(wrongBytes, root).join('\n'), /does not match local file length/i);
  const wrongDimensions = structuredClone(maps);
  wrongDimensions[0].images[0].width += 1;
  assert.match(validateMapMediaFiles(wrongDimensions, root).join('\n'), /dimensions .* do not match WebP/i);
  const duplicateMedia = structuredClone(maps);
  duplicateMedia[1].images[0].path = duplicateMedia[0].images[0].path;
  duplicateMedia[1].images[0].derivativeUrl = duplicateMedia[0].images[0].derivativeUrl;
  assert.match(validateMapMediaFiles(duplicateMedia, root).join('\n'), /duplicate image path/i);
  assert.match(validateMapMediaFiles(duplicateMedia, root).join('\n'), /duplicate derivativeUrl/i);
  const detachedMediaSource = structuredClone(maps);
  detachedMediaSource[0].sourceIds = detachedMediaSource[0].sourceIds.filter((id) => id !== detachedMediaSource[0].images[0].sourceId);
  assert.match(validateMapReferences(detachedMediaSource, characters, walkthrough, sources).join('\n'), /image sourceId .* must also appear in map sourceIds/i);
  const noImages = structuredClone(maps);
  noImages[0].images = [];
  assert.match(validateDataset({ fileName: 'maps.json', records: noImages, sourceIds, type: 'map', schema }).join('\n'), /images.*must contain at least 1 item/i);
  const dreamcastImage = structuredClone(maps);
  dreamcastImage[0].images[0].gameVersionScope = 'unknown-version';
  assert.match(validateDataset({ fileName: 'maps.json', records: dreamcastImage, sourceIds, type: 'map', schema }).join('\n'), /gameVersionScope.*must equal/i);

  assert.equal(maps.length, 20, 'all 20 sourced map records, including Kunlun, are included');
  assert.equal(maps.some((map) => map.id === 'kunlun'), true);
  assert.equal(maps.reduce((count, map) => count + map.images.length, 0), 57);
  const mapIds = new Set(maps.map((map) => map.id));
  assert.equal(new Set(maps.map((map) => map.sequence)).size, maps.length, 'map sequence values are unique');
  assert.ok(maps.every((map) => Number.isInteger(map.sequence) && map.sequence > 0), 'maps have positive sequence values');
  for (const map of maps) {
    assert.equal(map.title, `${map.nameZhHant}｜${map.nameJa}｜${map.nameEn}`);
    assert.ok(map.images.length >= 1, `${map.id} has at least one gameplay image`);
    assert.ok(map.walkthroughIds.every((id) => walkthroughIds.has(id)), `${map.id} walkthrough references exist`);
    assert.ok(map.requiredMapIds.every((id) => mapIds.has(id)), `${map.id} required maps exist`);
    assert.ok(map.anyOfRequiredMapIds.every((id) => mapIds.has(id)), `${map.id} alternative required maps exist`);
    assert.ok(map.obtainableCharacterIds.every((id) => characterIds.has(id)), `${map.id} characters exist`);
    for (const enemy of map.enemies) assert.ok(enemy.sourceIds.every((id) => sourceIds.has(id)), `${map.id}/${enemy.nameJa} enemy sources exist`);
    assert.ok(map.images.some((media) => media.kind === 'map-structure'), `${map.id} has a structure image`);
    assert.ok(map.images.some((media) => ['landmark-gameplay', 'location-card'].includes(media.kind)), `${map.id} has a landmark or location-card image`);
    for (const media of map.images) {
      assert.ok(sourceIds.has(media.sourceId), `${map.id} image source exists`);
      assert.equal(media.gameVersionScope, 'maken-x-dreamcast');
      assert.equal(media.mime, 'image/webp');
      assert.ok(media.width > 0 && media.width <= 640);
      assert.ok(media.height > 0);
      assert.equal(media.sourceMime, 'image/png');
      assert.ok(media.sourceWidth >= media.width);
      assert.ok(media.sourceHeight >= media.height);
      assert.ok(media.sourceBytes > 0);
      assert.match(media.sourceSha1, /^[a-f0-9]{40}$/);
      assert.match(media.filePageUrl, /^https:\/\/megamitensei\.fandom\.com\/wiki\/File:/);
      assert.match(media.derivativeUrl, /^https:\/\/static\.wikia\.nocookie\.net\/megamitensei\/images\//);
      assert.ok(Number.isInteger(media.associationPageRevisionId) && media.associationPageRevisionId > 0);
      assert.ok(['location-page-image-list', 'file-title-series'].includes(media.associationMethod));
      assert.ok(Number.isInteger(media.fileRevisionId) && media.fileRevisionId > 0);
      const bytes = await readFile(path.join(root, media.path));
      assert.equal(bytes.length, media.bytes, `${media.path} byte length`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), media.sha256, `${media.path} sha256`);
    }
  }
});
