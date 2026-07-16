import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { datasets, validateCharacterReferences, validateDataset, validateWalkthroughReferences } from '../scripts/validate-data.js';

const validSource = {
  id: 'demo-source',
  title: '示範資料，非正式攻略內容：來源',
  sourceType: 'official-website',
  publisherOrAuthor: 'Demo Publisher',
  sourceLevel: 'official',
  url: 'https://example.invalid/source',
  publicationDate: null,
  accessedDate: '2026-07-15',
  notes: '示範資料，非正式攻略內容'
};

const validRecord = {
  id: 'demo-character',
  title: '示範資料，非正式攻略內容：角色',
  summary: '示範資料，非正式攻略內容',
  content: '示範資料，非正式攻略內容',
  gameVersion: 'maken-shao-ps2',
  region: 'unknown',
  sourceIds: ['demo-source'],
  confidence: 'unverified',
  verificationStatus: 'not-verified',
  verificationNote: '示範資料，非正式攻略內容；目前尚未查證。',
  lastVerified: '2026-07-15',
  isPlaceholder: true,
  spoiler: false,
  nameJa: '示範角色',
  nameLatin: null,
  nameZhHant: '示範角色',
  nameEn: 'Demo Character',
  nameEnStatus: 'romanized',
  imagePath: 'assets/images/characters/demo-character.gif',
  imageAlt: '示範角色佔位圖',
  imageKind: 'no-attributable-source',
  imageSourceId: null,
  role: null,
};

test('accepts a valid placeholder record and existing source reference', () => {
  const errors = validateDataset({
    fileName: 'characters.json',
    records: [validRecord],
    sourceIds: new Set(['demo-source']),
    type: 'character'
  });
  assert.deepEqual(errors, []);
});

test('reports missing fields, invalid enum, duplicate IDs, unknown sources, and invalid dates', () => {
  const invalid = {
    ...validRecord,
    id: 'duplicate',
    gameVersion: 'wrong-version',
    sourceIds: ['missing-source'],
    lastVerified: '2026-99-99'
  };
  const errors = validateDataset({
    fileName: 'characters.json',
    records: [invalid, { ...invalid }],
    sourceIds: new Set(['demo-source']),
    type: 'character'
  });
  const output = errors.join('\n');
  assert.match(output, /characters\.json \[duplicate\].*gameVersion/i);
  assert.match(output, /unknown sourceId "missing-source"/i);
  assert.match(output, /duplicate id "duplicate"/i);
  assert.match(output, /lastVerified: must be a real YYYY-MM-DD date/i);
});

test('rejects spoilerLevel records that search would expose', () => {
  const errors = validateDataset({
    fileName: 'characters.json',
    records: [
      { ...validRecord, id: 'major-character', spoiler: false, spoilerLevel: 'major' },
      { ...validRecord, id: 'minor-character', spoiler: false, spoilerLevel: 'minor' },
      { ...validRecord, id: 'false-positive', spoiler: true, spoilerLevel: 'none' }
    ],
    sourceIds: new Set(['demo-source']),
    type: 'character'
  });
  const output = errors.join('\n');
  assert.match(output, /major-character.*non-none spoilerLevel requires spoiler true/i);
  assert.match(output, /minor-character.*non-none spoilerLevel requires spoiler true/i);
  assert.match(output, /false-positive.*spoiler true requires non-none spoilerLevel/i);
});

test('rejects incomplete character image metadata', () => {
  const errors = validateDataset({
    fileName: 'characters.json',
    records: [
      { ...validRecord, id: 'missing-alt', imagePath: 'assets/images/characters/demo-character.gif', imageAlt: null },
      { ...validRecord, id: 'missing-path', imagePath: null, imageAlt: '示範角色圖' }
    ],
    sourceIds: new Set(['demo-source']),
    type: 'character'
  });
  const output = errors.join('\n');
  assert.match(output, /missing-alt.*imagePath and imageAlt must either both be present or both be null/i);
  assert.match(output, /missing-path.*imagePath and imageAlt must either both be present or both be null/i);
});

test('registers world and systems datasets for v0.2 validation', () => {
  assert.deepEqual(datasets['world.json'], { schema: 'world.schema.json', type: 'world' });
  assert.deepEqual(datasets['systems.json'], { schema: 'system.schema.json', type: 'system' });
});

test('keeps v0.2 entries PS2-scoped and linked to registered official sources', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [sources, world, systems] = await Promise.all(['sources.json', 'world.json', 'systems.json'].map(async (file) => JSON.parse(await readFile(path.join(root, 'data', file), 'utf8'))));
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  for (const record of [...world, ...systems]) {
    assert.equal(record.gameVersion, 'maken-shao-ps2');
    assert.ok(record.sourceIds.every((id) => sourceMap.has(id)), `${record.id} has a registered source`);
  }
  assert.ok(world.every((record) => record.sourceIds.some((id) => sourceMap.get(id).sourceLevel === 'official')));
  assert.equal(systems.find((record) => record.id === 'maken-shao-psi-research-status').verificationStatus, 'not-verified');
});

test('requires v0.4 character identity, role, route, and spoiler fields', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const schema = JSON.parse(await readFile(path.join(root, 'schemas', 'character.schema.json'), 'utf8'));
  for (const field of ['nameJa', 'nameLatin', 'nameZhHant', 'nameEn', 'nameEnStatus', 'imagePath', 'imageAlt', 'imageKind', 'imageSourceId', 'role', 'characterType', 'affiliations', 'brainJackStatus', 'firstAppearanceWalkthroughId', 'relatedWalkthroughIds', 'spoilerLevel']) {
    assert.ok(schema.required.includes(field), `character schema requires ${field}`);
  }
  assert.deepEqual(schema.properties.spoilerLevel.enum, ['none', 'minor', 'major']);
  assert.deepEqual(schema.properties.brainJackStatus.enum, ['player-entity', 'confirmed-host', 'not-a-host', 'not-verified']);
});

test('rejects unknown and inconsistent character walkthrough references', () => {
  const characters = [{ id: 'character-one', firstAppearanceWalkthroughId: 'missing-first', relatedWalkthroughIds: ['step-one', 'missing-step'] }];
  const walkthrough = [{ id: 'step-one', brainJackTargetIds: ['missing-character'] }];
  const output = validateCharacterReferences(characters, walkthrough).join('\n');
  assert.match(output, /character-one.*unknown firstAppearanceWalkthroughId "missing-first"/i);
  assert.match(output, /character-one.*unknown relatedWalkthroughIds reference "missing-step"/i);
  assert.match(output, /step-one.*unknown brainJackTargetIds reference "missing-character"/i);
  assert.match(output, /character-one.*firstAppearanceWalkthroughId must be included in relatedWalkthroughIds/i);
});

test('requires reciprocal confirmed Brain Jack host links', () => {
  const characters = [
    { id: 'host-one', brainJackStatus: 'confirmed-host', firstAppearanceWalkthroughId: null, relatedWalkthroughIds: [] },
    { id: 'support-one', brainJackStatus: 'not-verified', firstAppearanceWalkthroughId: null, relatedWalkthroughIds: [] }
  ];
  const walkthrough = [{ id: 'step-one', brainJackTargetIds: ['support-one'] }];
  const output = validateCharacterReferences(characters, walkthrough).join('\n');
  assert.match(output, /host-one.*confirmed-host is not referenced by any walkthrough brainJackTargetIds/i);
  assert.match(output, /step-one.*support-one.*not marked confirmed-host/i);
});

test('ships the 17 officially named PS2 character-page entries in v0.4', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [sources, characters, walkthrough] = await Promise.all(['sources.json', 'characters.json', 'walkthrough.json'].map(async (file) => JSON.parse(await readFile(path.join(root, 'data', file), 'utf8'))));
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const byId = new Map(characters.map((record) => [record.id, record]));
  const officialCharacters = characters.filter((record) => record.sourceIds.includes('atlus-maken-shao-characters-archive'));
  assert.equal(officialCharacters.length, 17);
  assert.equal(characters.length, 22);
  for (const id of ['maken', 'kei-sagami', 'kou-yamashiro', 'jj-jones', 'hiromitsu-sagami', 'anne-miller', 'lee-feichao', 'kati', 'ramrod', 'badelaire', 'akinas', 'andrei', 'sharja', 'dal', 'margarete', 'don-marcala', 'rei', 'inaba-go', 'barlinka', 'smith', 'yusuf', 'william']) assert.ok(byId.has(id), `characters includes ${id}`);
  assert.equal(characters.filter((record) => record.brainJackStatus === 'confirmed-host').length, 18);
  assert.deepEqual(Object.fromEntries([...characters.reduce((counts, record) => counts.set(record.characterType, (counts.get(record.characterType) || 0) + 1), new Map()).entries()].sort()), { 'brain-jack-host': 3, core: 2, 'faction-member': 13, supporting: 4 });
  assert.ok(characters.every((record) => record.gameVersion === 'maken-shao-ps2' && record.region === 'JP' && record.isPlaceholder === false));
  assert.ok(characters.every((record) => record.sourceIds.every((id) => sourceMap.has(id))));
  assert.ok(characters.every((record) => record.nameZhHant && record.nameJa && record.nameEn));
  assert.ok(characters.every((record) => ['official', 'romanized'].includes(record.nameEnStatus)));
  assert.ok(characters.every((record) => record.imagePath && record.imageAlt));
  assert.equal(characters.filter((record) => record.imageKind === 'official-source').length, 17);
  assert.equal(characters.filter((record) => record.imageKind === 'no-attributable-source').length, 5);
  assert.ok(officialCharacters.every((record) => record.imageKind === 'official-source' && record.imageSourceId === 'atlus-maken-shao-characters-archive'));
  const imageAssets = await Promise.all(characters.map((record) => readFile(path.join(root, record.imagePath))));
  assert.ok(imageAssets.every((asset) => asset.byteLength > 300), 'every character image asset is present and non-trivial');
  assert.equal(byId.get('inaba-go').imageKind, 'no-attributable-source');
  assert.equal(byId.get('inaba-go').imageSourceId, null);
  assert.equal(byId.get('lee-feichao').nameZhHant, '李飛扇');
  assert.equal(byId.get('maken').nameEnStatus, 'official');
  assert.equal(byId.get('kei-sagami').nameZhHant, '相模桂');
  assert.deepEqual(walkthrough.find((step) => step.id === 'route-opening-kanazawa').brainJackTargetIds, ['kei-sagami', 'andrei']);
  assert.deepEqual(validateCharacterReferences(characters, walkthrough), []);
});

test('character page declares v0.4 data and filters', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [html, app] = await Promise.all([
    readFile(path.join(root, 'pages', 'characters.html'), 'utf8'),
    readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8')
  ]);
  assert.match(html, /data-content-file="characters\.json"/);
  assert.match(html, /data-character-type-filter/);
  assert.match(html, /data-brain-jack-filter/);
  assert.match(app, /characterType/);
  assert.match(app, /brainJackStatus/);
  assert.match(app, /nameZhHant/);
  assert.match(app, /nameEnStatus/);
  assert.match(app, /character-portrait/);
  assert.match(app, /const isMinor = item\.spoilerLevel === 'minor'/);
  assert.match(app, /if \(!isMajor && !isMinor\) details\.open = true/);
  assert.match(app, /站內中性佔位圖/);
  assert.match(app, /展開角色細節與查證資料/);
  assert.match(app, /沒有符合篩選條件的資料/);
});

test('keeps every major-card title inside its closed spoiler disclosure', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const app = await readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8');
  assert.match(app, /const hiddenTitle = document\.createElement\('h2'\);/);
  assert.match(app, /hiddenTitle\.textContent = '重大劇透內容（已隱藏）';/);
  assert.match(app, /details\.append\(control, title, body\);/);
  assert.match(app, /article\.append\(hiddenTitle, details\);/);
});

test('restores sourced walkthrough objectives in rendered card details', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const app = await readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8');
  assert.match(app, /Array\.isArray\(item\.objectives\)/);
  assert.match(app, /heading\.textContent = '已查證目標';/);
  assert.match(app, /item\.objectives\.forEach/);
});

test('requires v0.3 walkthrough routing and objective fields', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const schema = JSON.parse(await readFile(path.join(root, 'schemas', 'walkthrough.schema.json'), 'utf8'));
  for (const field of ['routeId', 'routeTitle', 'objectives', 'prerequisites', 'anyOfPrerequisites', 'branchChoiceIds', 'bossIds', 'brainJackTargetIds', 'missable', 'spoilerLevel']) {
    assert.ok(schema.required.includes(field), `walkthrough schema requires ${field}`);
  }
  assert.deepEqual(schema.properties.spoilerLevel.enum, ['none', 'minor', 'major']);
});

test('rejects unknown walkthrough prerequisite and branch references', () => {
  const records = [{ id: 'step-one', prerequisites: ['missing-step'], branchChoiceIds: ['missing-branch'] }];
  const output = validateWalkthroughReferences(records).join('\n');
  assert.match(output, /step-one.*unknown prerequisites reference "missing-step"/i);
  assert.match(output, /step-one.*unknown branchChoiceIds reference "missing-branch"/i);
});

test('rejects self prerequisites and prerequisite cycles', () => {
  const records = [
    { id: 'step-a', sequence: 1, prerequisites: ['step-b'], anyOfPrerequisites: [], branchChoiceIds: [] },
    { id: 'step-b', sequence: 2, prerequisites: ['step-a'], anyOfPrerequisites: [], branchChoiceIds: [] },
    { id: 'step-self', sequence: 3, prerequisites: ['step-self'], anyOfPrerequisites: [], branchChoiceIds: [] }
  ];
  const output = validateWalkthroughReferences(records).join('\n');
  assert.match(output, /step-self.*cannot reference itself/i);
  assert.match(output, /prerequisite cycle/i);
});

test('rejects inconsistent outgoing and incoming walkthrough edges', () => {
  const records = [
    { id: 'step-a', sequence: 1, prerequisites: [], anyOfPrerequisites: [], branchChoiceIds: ['step-b', 'step-b'] },
    { id: 'step-b', sequence: 2, prerequisites: [], anyOfPrerequisites: [], branchChoiceIds: [] }
  ];
  const output = validateWalkthroughReferences(records).join('\n');
  assert.match(output, /branchChoiceIds contains duplicate references/i);
  assert.match(output, /branch target "step-b" does not declare this step as a prerequisite/i);
});

test('rejects incoming-only, backward, and overlapping walkthrough prerequisites', () => {
  const records = [
    { id: 'step-a', sequence: 3, prerequisites: [], anyOfPrerequisites: [], branchChoiceIds: [] },
    { id: 'step-b', sequence: 2, prerequisites: ['step-a'], anyOfPrerequisites: ['step-a'], branchChoiceIds: [] }
  ];
  const output = validateWalkthroughReferences(records).join('\n');
  assert.match(output, /step-b.*prerequisite "step-a" cannot also appear in anyOfPrerequisites/i);
  assert.match(output, /step-b.*prerequisite "step-a" does not declare this step as a branch target/i);
  assert.match(output, /step-b.*prerequisite "step-a" has a later sequence/i);
});

test('ships only sourced PS2 walkthrough records in v0.3', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [sources, walkthrough] = await Promise.all(['sources.json', 'walkthrough.json'].map(async (file) => JSON.parse(await readFile(path.join(root, 'data', file), 'utf8'))));
  const sourceIds = new Set(sources.map((source) => source.id));
  assert.equal(walkthrough.length, 17);
  assert.ok(walkthrough.every((record) => record.gameVersion === 'maken-shao-ps2' && record.region === 'JP'));
  assert.ok(walkthrough.every((record) => record.isPlaceholder === false && record.verificationStatus === 'partially-verified'));
  assert.ok(walkthrough.every((record) => record.sourceIds.every((id) => id !== 'demo-source' && sourceIds.has(id))));
  assert.deepEqual(validateWalkthroughReferences(walkthrough), []);
});

test('models reviewed Taj Mahal and endgame alternatives explicitly', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const records = JSON.parse(await readFile(path.join(root, 'data', 'walkthrough.json'), 'utf8'));
  const byId = new Map(records.map((record) => [record.id, record]));
  assert.match(byId.get('route-early-taj-mahal').content, /不能進入沙爾嘉的房間/);
  assert.deepEqual(byId.get('route-convergence-moscow').sourceIds.includes('kentaro-maken-shao-early-chart'), true);
  assert.deepEqual(byId.get('route-endgame-lisbon').branchChoiceIds, ['route-endgame-mecca', 'route-endgame-brazil']);
  assert.deepEqual(byId.get('route-ending-forbidden-city').anyOfPrerequisites, ['route-endgame-brazil', 'route-endgame-washington']);
  assert.deepEqual(byId.get('route-convergence-lyon').prerequisites, ['route-mid-istanbul-chain', 'route-mid-london-chain']);
  assert.deepEqual(byId.get('route-convergence-lyon').anyOfPrerequisites, []);
  assert.deepEqual(byId.get('route-optional-transylvania').branchChoiceIds, []);
  assert.deepEqual(byId.get('route-optional-vienna').branchChoiceIds, []);
});
