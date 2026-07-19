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
  const generators = await Promise.all([
    readFile(path.join(root, 'scripts', 'generate-character-pages.js'), 'utf8'),
    readFile(path.join(root, 'scripts', 'update-static-shell.js'), 'utf8')
  ]);
  assert.doesNotMatch(generators[0], /bosses\.html|>Boss</);
  assert.match(generators[1], /bosses\\\.html/);
});

test('keeps an opened mobile navigation fixed and independently scrollable beneath the sticky header', async () => {
  const [app, css] = await Promise.all([
    readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8'),
    readFile(path.join(root, 'assets', 'css', 'style.css'), 'utf8')
  ]);
  assert.match(app, /function setMobileMenuOffset\(\)/);
  assert.match(app, /document\.body\.classList\.toggle\('mobile-menu-open', open\)/);
  assert.match(app, /document\.body\.classList\.remove\('mobile-menu-open'\)/);
  assert.match(css, /body\.mobile-menu-open \{ overflow:hidden; \}/);
  assert.match(css, /\.sidebar\.is-open \{[^}]*position:fixed;[^}]*top:var\(--mobile-menu-top\);[^}]*bottom:0;[^}]*overflow-y:auto;[^}]*overscroll-behavior-y:contain;[^}]*touch-action:pan-y;/);
});

test('ships complete sourced Knowledge records without placeholders', async () => {
  const knowledge = JSON.parse(await readFile(path.join(root, 'data', 'knowledge.json'), 'utf8'));
  assert.ok(knowledge.length >= 16);
  knowledge.forEach((item) => {
    assert.equal(item.gameVersion, 'maken-shao-ps2');
    assert.equal(item.region, 'JP');
    assert.equal(item.isPlaceholder, false);
    assert.ok(item.sourceIds.length > 0);
    assert.ok(item.summary.length >= 20);
    assert.ok(item.content.length >= 35);
  });
});

test('models both terminal routes with walkthrough, opponent, evidence, and unsupported-detail boundaries', async () => {
  const [endings, walkthrough, characters, sources] = await Promise.all([
    readFile(path.join(root, 'data', 'endings.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data', 'walkthrough.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data', 'characters.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data', 'sources.json'), 'utf8').then(JSON.parse)
  ]);
  const walkthroughIds = new Set(walkthrough.map((item) => item.id));
  const characterIds = new Set(characters.map((item) => item.id));
  const sourceIds = new Set(sources.map((item) => item.id));
  assert.deepEqual(new Set(endings.map((item) => item.id)), new Set(['ending-konron', 'ending-forbidden-city']));
  const endingsIndex = await readFile(path.join(root, 'pages', 'endings.html'), 'utf8');
  assert.match(endingsIndex, /天尊流星戰或社群表標示的「ラスボス戦なし」分支/);
  assert.doesNotMatch(endingsIndex, /終戰對手為天尊流星/);
  for (const ending of endings) {
    assert.equal(ending.endingType, 'terminal-route');
    assert.ok(walkthroughIds.has(ending.terminalWalkthroughId));
    ending.entryWalkthroughIds.forEach((id) => assert.ok(walkthroughIds.has(id)));
    assert.ok(characterIds.has(ending.finalOpponentCharacterId));
    assert.equal(ending.canonicalNameStatus, 'community-label');
    assert.equal(ending.narrativeEvidenceStatus, 'route-only');
    assert.ok(ending.unsupportedDetails.length >= 3);
    ending.conditionEvidence.forEach((evidence) => assert.ok(sourceIds.has(evidence.sourceId)));
    const pageName = ending.id === 'ending-konron' ? 'konron.html' : 'forbidden-city.html';
    const html = await readFile(path.join(root, 'pages', 'endings', pageName), 'utf8');
    assert.match(html, /觸發流程/);
    assert.match(html, /結局內容脈絡/);
    assert.doesNotMatch(html, /<details|data-spoiler|spoiler-toggle/);
  }
});
