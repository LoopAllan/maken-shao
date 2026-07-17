import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { datasets, validateCharacterDetailReferences, validateCharacterReferences, validateDataset, validateTechniqueMediaFiles, validateWalkthroughReferences } from '../scripts/validate-data.js';

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
  nameJa: '示範角色',
  nameLatin: null,
  nameZhHant: '示範角色',
  nameEn: 'Demo Character',
  nameEnStatus: 'romanized',
  imagePath: 'assets/images/characters/demo-character.gif',
  imageAlt: '示範角色佔位圖',
  imageKind: 'no-attributable-source',
  imageSourceId: null,
  imageOriginalUrl: null,
  imageSha256: '0'.repeat(64),
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

test('rejects hostless or malformed HTTP URI values while accepting valid URLs', () => {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'url'],
    properties: {
      id: { type: 'string', minLength: 1 },
      url: { type: 'string', format: 'uri' }
    }
  };
  const validateUrl = (url) => validateDataset({ fileName: 'uri-probe.json', records: [{ id: 'probe', url }], sourceIds: new Set(), type: 'source', schema });
  assert.deepEqual(validateUrl('https://example.com/path?x=1#section'), []);
  assert.deepEqual(validateUrl('http://127.0.0.1:8080/path'), []);
  for (const invalid of [
    'https://',
    'http:///path',
    'https://?query',
    'javascript:alert(1)',
    'not-a-url',
    'https://trusted.example\n@evil.example/path',
    'https://trusted.example\r@evil.example/path',
    'https://trusted.example\t@evil.example/path',
    'https://example.com/path\u0085segment',
    'https://trusted.example\\@evil.example/path',
    'https://trusted.example@evil.example/path',
    'https://@evil.example/path',
    'https://:@evil.example/path'
  ]) {
    assert.match(validateUrl(invalid).join('\n'), /must be an absolute http\(s\) URI/i, JSON.stringify(invalid));
  }
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

test('rejects incomplete character image metadata', () => {
  const errors = validateDataset({
    fileName: 'characters.json',
    records: [
      { ...validRecord, id: 'missing-alt', imagePath: 'assets/images/characters/demo-character.gif', imageAlt: null },
      { ...validRecord, id: 'missing-path', imagePath: null, imageAlt: '示範角色圖' },
      { ...validRecord, id: 'missing-source-url', imageKind: 'official-source', imageSourceId: 'demo-source', imageOriginalUrl: null }
    ],
    sourceIds: new Set(['demo-source']),
    type: 'character'
  });
  const output = errors.join('\n');
  assert.match(output, /missing-alt.*imagePath and imageAlt must either both be present or both be null/i);
  assert.match(output, /missing-path.*imagePath and imageAlt must either both be present or both be null/i);
  assert.match(output, /missing-source-url.*official-source requires imageOriginalUrl/i);
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

test('requires v0.4 character identity, taxonomy, provenance, and community reference fields', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [schema, characters, sources] = await Promise.all([
    readFile(path.join(root, 'schemas', 'character.schema.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data', 'characters.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data', 'sources.json'), 'utf8').then(JSON.parse)
  ]);
  for (const field of ['nameJa', 'nameLatin', 'nameZhHant', 'nameEn', 'nameEnStatus', 'linkAliases', 'imagePath', 'imageAlt', 'imageKind', 'imageSourceId', 'imageOriginalUrl', 'imageDownloadUrl', 'imageSha256', 'imageFilePageUrl', 'imageUploader', 'imageUploadedAt', 'imageSourceSha1', 'imageSourceMime', 'imageSourceWidth', 'imageSourceHeight', 'imageSourceBytes', 'imageSourceVerification', 'imageLocalMime', 'imageUnderlyingSource', 'imageArtist', 'imageLicense', 'imageReuseStatus', 'imageContentType', 'imageRightsNote', 'imageVersionNote', 'role', 'characterType', 'characterGroup', 'wikiNavigationGroup', 'wikiLinkedCharacterIds', 'tags', 'age', 'occupation', 'communityReferences', 'affiliations', 'brainJackStatus', 'firstAppearanceWalkthroughId', 'relatedWalkthroughIds']) {
    assert.ok(schema.required.includes(field), `character schema requires ${field}`);
  }
  assert.deepEqual(schema.properties.characterGroup.enum, ['main', 'fukenshi', 'hakke', 'hostile', 'npc', 'other']);
  assert.deepEqual(schema.properties.brainJackStatus.enum, ['player-entity', 'confirmed-host', 'not-a-host', 'not-verified']);
  assert.equal(schema.properties.imagePath.type, 'string');
  assert.equal(schema.properties.imageAlt.type, 'string');
  const sourceIds = new Set(sources.map((source) => source.id));
  const tooOldErrors = validateDataset({ fileName: 'characters.json', records: [{ ...characters[0], id: 'age-too-high', age: 100000 }], sourceIds, type: 'character', schema });
  assert.match(tooOldErrors.join('\n'), /age-too-high.*age.*must be at most 99999/i);
  const maximumAgeErrors = validateDataset({ fileName: 'characters.json', records: [{ ...characters[0], id: 'age-at-maximum', age: 99999 }], sourceIds, type: 'character', schema });
  assert.doesNotMatch(maximumAgeErrors.join('\n'), /age-at-maximum.*age/i);
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

test('ships all 28 MegaTen Wiki MX-navigation characters with PS2 scope and traceable images', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [sources, characters, walkthrough] = await Promise.all(['sources.json', 'characters.json', 'walkthrough.json'].map(async (file) => JSON.parse(await readFile(path.join(root, 'data', file), 'utf8'))));
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const byId = new Map(characters.map((record) => [record.id, record]));
  const officialCharacters = characters.filter((record) => record.sourceIds.includes('atlus-maken-shao-characters-archive'));
  assert.equal(officialCharacters.length, 17);
  assert.equal(characters.length, 28);
  for (const id of ['maken', 'kei-sagami', 'kou-yamashiro', 'jj-jones', 'hiromitsu-sagami', 'anne-miller', 'lee-feichao', 'lee-fei-shan', 'lee-fu-sho', 'dr-dublin-guiness', 'mr-meteor', 'pan-gu', 'ryu-kashin', 'kati', 'ramrod', 'badelaire', 'akinas', 'andrei', 'sharja', 'dal', 'margarete', 'don-marcala', 'rei', 'inaba-go', 'barlinka', 'smith', 'yusuf', 'william']) assert.ok(byId.has(id), `characters includes ${id}`);
  assert.equal(characters.filter((record) => record.brainJackStatus === 'confirmed-host').length, 18);
  assert.ok(characters.filter((record) => record.brainJackStatus === 'confirmed-host').every((record) => !/不推定可操作性|不足以把.*Brain Jack/.test(record.content)), 'confirmed hosts do not contradict their verified status in prose');
  assert.deepEqual(Object.fromEntries([...characters.reduce((counts, record) => counts.set(record.characterGroup, (counts.get(record.characterGroup) || 0) + 1), new Map()).entries()].sort()), { fukenshi: 7, hakke: 8, hostile: 3, main: 3, npc: 7 });
  assert.equal(characters.filter((record) => record.wikiNavigationGroup === 'playable').length, 19);
  assert.equal(characters.filter((record) => record.wikiNavigationGroup === 'non-playable').length, 9);
  assert.equal(characters.reduce((total, record) => total + record.wikiLinkedCharacterIds.length, 0), 102);
  assert.ok(characters.every((record) => record.wikiLinkedCharacterIds.every((id) => byId.has(id) && id !== record.id)));
  assert.ok(characters.every((record) => record.gameVersion === 'maken-shao-ps2' && record.region === 'JP' && record.isPlaceholder === false));
  assert.ok(characters.every((record) => record.sourceIds.every((id) => sourceMap.has(id))));
  assert.ok(characters.every((record) => record.sourceIds.includes('megaten-wiki-maken-x-characters')));
  assert.ok(characters.every((record) => record.nameZhHant && record.nameJa && record.nameEn && record.tags.length > 0));
  assert.ok(characters.every((record) => record.linkAliases.includes(record.nameZhHant) && record.linkAliases.includes(record.nameJa) && record.linkAliases.includes(record.nameEn)));
  assert.ok(characters.every((record) => new Set(record.linkAliases).size === record.linkAliases.length));
  const aliasOwners = new Map();
  characters.forEach((record) => record.linkAliases.forEach((alias) => {
    const key = alias.normalize('NFKC').toLocaleLowerCase('en');
    if (!aliasOwners.has(key)) aliasOwners.set(key, new Set());
    aliasOwners.get(key).add(record.id);
  }));
  assert.ok([...aliasOwners.entries()].every(([, owners]) => owners.size === 1), 'every character alias has exactly one owner');
  assert.ok(byId.get('rei').linkAliases.includes('八卦雷') && byId.get('rei').linkAliases.includes('雷'));
  assert.ok(byId.get('lee-fei-shan').linkAliases.includes('飛扇'));
  assert.ok(characters.every((record) => record.communityReferences.length === 1 && record.communityReferences[0].revisionId > 0));
  assert.ok(characters.every((record) => ['official', 'romanized', 'community'].includes(record.nameEnStatus)));
  assert.ok(characters.every((record) => record.imagePath && record.imageAlt && record.imageSourceId === 'megaten-wiki-maken-x-characters'));
  assert.ok(characters.every((record) => record.imageKind.startsWith('community-source-')));
  assert.ok(characters.every((record) => /^https:\/\/megamitensei\.fandom\.com\/wiki\/File:/.test(record.imageFilePageUrl)));
  assert.ok(characters.every((record) => /^[a-f0-9]{40}$/.test(record.imageSourceSha1)));
  assert.equal(characters.filter((record) => record.imageSourceVerification === 'exact-retrieval-verified').length, 23);
  assert.deepEqual(characters.filter((record) => record.imageSourceVerification === 'api-metadata-only-current-cdn-byte-mismatch').map((record) => record.id).sort(), ['hiromitsu-sagami', 'jj-jones', 'lee-feichao', 'lee-fu-sho', 'mr-meteor']);
  assert.ok(characters.every((record) => /-fandom\.webp$/.test(record.imagePath) && record.imageLocalMime === 'image/webp'));
  assert.ok(characters.every((record) => /\/revision\/latest(?:\/scale-to-width-down\/640)?\?cb=/.test(record.imageDownloadUrl)));
  assert.ok(characters.every((record) => record.imageUnderlyingSource === 'unknown' && record.imageArtist === 'unknown' && record.imageLicense === 'not-supplied'));
  assert.ok(characters.every((record) => record.imageReuseStatus === 'copyrighted-reference-use-only-no-redistribution-license-claimed'));
  const imageAssets = await Promise.all(characters.map((record) => readFile(path.join(root, record.imagePath))));
  assert.ok(imageAssets.every((asset) => asset.subarray(0, 4).toString('ascii') === 'RIFF' && asset.subarray(8, 12).toString('ascii') === 'WEBP'), 'every character image has a WebP signature matching its extension');
  characters.forEach((record, index) => assert.equal(createHash('sha256').update(imageAssets[index]).digest('hex'), record.imageSha256, `${record.id} image checksum matches metadata`));
  assert.equal(byId.get('lee-feichao').nameZhHant, '李飛超');
  assert.equal(byId.get('lee-feichao').brainJackStatus, 'not-a-host');
  assert.equal(byId.get('lee-fei-shan').nameZhHant, '李飛扇');
  assert.equal(byId.get('lee-fei-shan').brainJackStatus, 'confirmed-host');
  assert.equal(byId.get('lee-fei-shan').confidence, 'cross-verified');
  assert.deepEqual(byId.get('lee-fei-shan').sourceIds, ['blue-violet-maken-shao-characters', 'gamehyoron-maken-shao-route-table', 'kentaro-maken-shao-early-chart', 'megaten-wiki-maken-x-characters']);
  assert.equal(byId.get('ryu-kashin').nameZhHant, '劉嘉伸');
  assert.equal(byId.get('mr-meteor').nameJa, '天尊流星（てんそんりゅうせい）');
  assert.equal(byId.get('mr-meteor').nameEnStatus, 'community');
  assert.equal(byId.get('maken').nameEnStatus, 'official');
  assert.equal(byId.get('kei-sagami').nameZhHant, '相模桂');
  assert.deepEqual(walkthrough.find((step) => step.id === 'route-opening-kanazawa').brainJackTargetIds, ['kei-sagami', 'andrei']);
  assert.deepEqual(validateCharacterReferences(characters, walkthrough), []);
});

test('character page declares category tabs, query, and multi-tag filters', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [html, app, home] = await Promise.all([
    readFile(path.join(root, 'pages', 'characters.html'), 'utf8'),
    readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8'),
    readFile(path.join(root, 'index.html'), 'utf8')
  ]);
  assert.match(html, /data-content-file="characters\.json"/);
  assert.match(html, /data-character-tabs/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /data-character-tag-list/);
  assert.match(html, /data-character-query/);
  assert.match(app, /characterGroup/);
  assert.match(app, /selectedTags/);
  assert.match(app, /setAttribute\('role', 'tab'\)/);
  assert.match(app, /tab\.id = `character-tab-\$\{group\}`/);
  assert.match(app, /contentTarget\.setAttribute\('aria-labelledby', selectedTab\.id\)/);
  assert.match(html, /role="tabpanel" aria-labelledby="character-tab-all"/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /nameZhHant/);
  assert.match(app, /nameEnStatus/);
  assert.match(app, /character-portrait/);
  assert.match(app, /imageFilePageUrl/);
  assert.match(app, /角色頁交叉參考/);
  assert.match(app, /Wiki 內文明示連結角色/);
  assert.match(app, /Wiki 導覽/);
  assert.match(app, /沒有符合篩選條件的資料/);
  assert.match(home, /完整 28 名角色資料/);
  assert.doesNotMatch(home, /22 筆|17 張可追溯官方角色圖/);
});

test('ships one validated detail record and static page for every character', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [characters, details, walkthrough, sources, schema, app, generator, pageFiles] = await Promise.all([
    readFile(path.join(root, 'data', 'characters.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data', 'character-details.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data', 'walkthrough.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'data', 'sources.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'schemas', 'character-detail.schema.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8'),
    readFile(path.join(root, 'scripts', 'generate-character-pages.js'), 'utf8'),
    readdir(path.join(root, 'pages', 'characters'))
  ]);
  assert.deepEqual(datasets['character-details.json'], { schema: 'character-detail.schema.json', type: 'character-detail' });
  assert.equal(details.length, 28);
  assert.deepEqual(details.map((record) => record.id).sort(), characters.map((record) => record.id).sort());
  assert.deepEqual(validateCharacterDetailReferences(details, characters, walkthrough), []);
  const sourceIds = new Set(sources.map((source) => source.id));
  assert.deepEqual(validateDataset({ fileName: 'character-details.json', records: details, sourceIds, type: 'character-detail', schema }), []);
  assert.deepEqual(validateTechniqueMediaFiles(details, root), []);
  const missingArchiveBytes = structuredClone(details);
  delete missingArchiveBytes.find((record) => record.id === 'kei-sagami').techniques.find((technique) => technique.nameJa === '寿星突き').media[0].archiveBytes;
  assert.match(validateDataset({ fileName: 'character-details.json', records: missingArchiveBytes, sourceIds, type: 'character-detail', schema }).join('\n'), /missing required field "archiveBytes"/i);
  const invalidArchiveBytes = structuredClone(details);
  invalidArchiveBytes.find((record) => record.id === 'kei-sagami').techniques.find((technique) => technique.nameJa === '寿星突き').media[0].archiveBytes = 0;
  assert.match(validateDataset({ fileName: 'character-details.json', records: invalidArchiveBytes, sourceIds, type: 'character-detail', schema }).join('\n'), /archiveBytes.*must be at least 1/i);
  assert.match(validateTechniqueMediaFiles(invalidArchiveBytes, root).join('\n'), /archiveBytes 0 does not match local file length 21787/i);
  for (const invalidUrl of ['https://', 'http:///path', 'https://trusted.example\n@evil.example/path', 'https://trusted.example\t@evil.example/path']) {
    const invalidArchiveUrl = structuredClone(details);
    invalidArchiveUrl.find((record) => record.id === 'kei-sagami').techniques.find((technique) => technique.nameJa === '寿星突き').media[0].archiveUrl = invalidUrl;
    assert.match(validateDataset({ fileName: 'character-details.json', records: invalidArchiveUrl, sourceIds, type: 'character-detail', schema }).join('\n'), /archiveUrl.*must be an absolute http\(s\) URI/i, invalidUrl);
  }
  assert.equal(pageFiles.filter((file) => file.endsWith('.html')).length, 28);
  for (const character of characters) {
    const html = await readFile(path.join(root, 'pages', 'characters', `${character.id}.html`), 'utf8');
    assert.match(html, new RegExp(`data-character-detail-id="${character.id}"`));
    assert.match(html, /data-base="\.\.\/\.\."/);
    assert.match(html, /href="\.\.\/\.\.\/assets\/css\/style\.css"/);
    assert.match(html, /href="\.\.\/characters\.html" aria-current="location"/);
    assert.match(html, /src="\.\.\/\.\.\/assets\/js\/character-links\.js"/);
  }
  assert.match(app, /characterDetailHref\(item\.id\)/);
  assert.match(app, /className = 'character-nav-toggle'/);
  assert.match(app, /className = 'character-detail-navigation'/);
  assert.match(app, /data-character-detail-id/);
  assert.match(generator, /Generated \$\{characters\.length\} character detail pages/);
});

test('provides sourced acquisition routes and 81 synchronization-gated moves for all 18 confirmed hosts', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [characters, details, sources] = await Promise.all(['characters.json', 'character-details.json', 'sources.json'].map((file) => readFile(path.join(root, 'data', file), 'utf8').then(JSON.parse)));
  const confirmedIds = new Set(characters.filter((record) => record.brainJackStatus === 'confirmed-host').map((record) => record.id));
  const playableDetails = details.filter((record) => confirmedIds.has(record.id));
  const unsupportedDetails = details.filter((record) => !confirmedIds.has(record.id));
  assert.equal(playableDetails.length, 18);
  assert.equal(unsupportedDetails.length, 10);
  assert.ok(unsupportedDetails.every((record) => record.acquisition === null && record.techniques.length === 0 && record.techniqueSources.length === 0));
  assert.ok(playableDetails.every((record) => record.acquisition && record.acquisition.steps.length > 0 && record.acquisition.sourceIds.length > 0));
  assert.ok(playableDetails.every((record) => record.techniques.length > 0 && record.techniqueSources.length === 2));
  assert.ok(playableDetails.every((record) => record.techniques.some((technique) => technique.acquisitionRatePercent === 0) && record.techniques.some((technique) => technique.acquisitionRatePercent === 100)));
  assert.equal(playableDetails.reduce((total, record) => total + record.techniques.length, 0), 81);
  assert.ok(playableDetails.flatMap((record) => record.techniques).every((technique) => Number.isInteger(technique.acquisitionRatePercent) && technique.acquisitionRatePercent >= 0 && technique.acquisitionRatePercent <= 100 && technique.nameJa && technique.typeJa && technique.command && Array.isArray(technique.media)));
  const keiMedia = details.find((record) => record.id === 'kei-sagami').techniques.filter((technique) => technique.media.length);
  assert.deepEqual(keiMedia.map((technique) => [technique.nameJa, technique.media.length]), [['寿星突き', 1]]);
  const keiMediaFiles = keiMedia.flatMap((technique) => technique.media);
  assert.ok(keiMediaFiles.every((media) => media.sourceId === 'atlus-maken-shao-system-page3-archive' && media.kind === 'official-technique-action-frame' && /^[a-f0-9]{64}$/.test(media.sha256)));
  for (const media of keiMediaFiles) {
    const bytes = await readFile(path.join(root, media.path));
    assert.equal(bytes.length, media.archiveBytes, `${media.path} archive byte length matches`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), media.sha256, `${media.path} checksum matches`);
    assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
  }
  assert.ok(playableDetails.every((record) => record.sourceIds.includes('atlus-maken-shao-system-page3-archive')));
  assert.deepEqual(new Set(playableDetails.flatMap((record) => record.techniqueSources.map((source) => source.sourceId)).filter((id) => id.startsWith('gamehyoron-maken-shao-characters-'))), new Set(['gamehyoron-maken-shao-characters-1', 'gamehyoron-maken-shao-characters-2', 'gamehyoron-maken-shao-characters-3', 'gamehyoron-maken-shao-characters-4']));
  assert.ok(['三段斬り', 'マキナクオーク'].every((name) => details.find((record) => record.id === 'kei-sagami').techniques.some((technique) => technique.nameJa === name)));
  assert.equal(details.find((record) => record.id === 'dal').techniques.find((technique) => technique.acquisitionRatePercent === 100).nameJa, 'ウラドウィルス');
  assert.equal(details.find((record) => record.id === 'smith').techniques.find((technique) => technique.nameJa === 'ローリングスミス').command, '□＋×～□□□□');
  assert.match(sources.find((source) => source.id === 'atlus-maken-shao-system-page3-archive').notes, /支配率.*シンクロ率/);
});

test('rejects missing, duplicate, and inconsistent character detail references', () => {
  const characters = [{ id: 'one' }, { id: 'two' }];
  const walkthrough = [{ id: 'route-one' }];
  const details = [{ id: 'one', sourceIds: ['source-one'], acquisition: { walkthroughIds: ['missing-route'], sourceIds: ['missing-source'] }, techniques: [{ nameJa: '技', media: [{ sourceId: 'missing-media' }] }], techniqueSources: [] }, { id: 'one', sourceIds: [], acquisition: null, techniques: [], techniqueSources: [] }];
  const output = validateCharacterDetailReferences(details, characters, walkthrough).join('\n');
  assert.match(output, /duplicate detail record "one"/i);
  assert.match(output, /unknown acquisition walkthroughId "missing-route"/i);
  assert.match(output, /acquisition sourceId "missing-source" must also appear in sourceIds/i);
  assert.match(output, /techniques require techniqueSources/i);
  assert.match(output, /media sourceId "missing-media" must also appear in sourceIds/i);
  assert.match(output, /missing detail record for character "two"/i);
});

test('loads character mention links and accessible previews across every site entry page', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pageNames = ['introduction.html', 'systems.html', 'walkthrough.html', 'characters.html', 'knowledge.html', 'endings.html', 'bosses.html', 'references.html'];
  const htmlFiles = [path.join(root, 'index.html'), ...pageNames.map((name) => path.join(root, 'pages', name))];
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    assert.match(html, /character-links\.js/);
    assert.ok(html.indexOf('character-links.js') < html.indexOf('app.js'), `${path.basename(file)} loads mention helper before app`);
  }
  const app = await readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8');
  assert.match(app, /linkCharacterMentions/);
  assert.match(app, /魔剣爻.*Maken X/);
  assert.match(app, /excluded = .*\.metadata/);
  assert.match(app, /character-preview-card/);
  assert.match(app, /technique-media-gallery/);
  assert.match(app, /media\.archiveUrl/);
  assert.match(app, /media\.archiveBytes/);
  assert.match(app, /media\.sha256/);
  assert.match(app, /media\.originalUrl/);
  assert.match(app, /media\.path/);
  assert.match(app, /aria-describedby/);
  assert.match(app, /pointerenter/);
  assert.match(app, /focusin/);
  assert.match(app, /Escape/);
});

test('keeps character-only UI out of walkthrough cards and preserves sequence order', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const app = await readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8');
  assert.match(app, /const isCharacter = contentType === 'characters'/);
  assert.match(app, /if \(isCharacter\) article\.append\(characterImage\(item\)\)/);
  assert.match(app, /if \(contentType === 'walkthrough'\)/);
  assert.match(app, /a\.sequence \?\? Number\.MAX_SAFE_INTEGER/);
  assert.match(app, /renderContentCard\(item, sourceMap, contentType, itemMap\)/);
});

test('renders every title, body, route, and source without disclosure or hiding controls', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [app, walkthrough, references, endings] = await Promise.all([
    readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8'),
    readFile(path.join(root, 'pages', 'walkthrough.html'), 'utf8'),
    readFile(path.join(root, 'pages', 'references.html'), 'utf8'),
    readFile(path.join(root, 'pages', 'endings.html'), 'utf8')
  ]);
  assert.doesNotMatch(app, /createElement\('details'\)|hiddenTitle|spoilerRouteToggle|data-spoiler/);
  assert.doesNotMatch(`${walkthrough}${references}${endings}`, /<details|<summary|data-spoiler|spoiler-toggle|spoiler-content/);
  assert.match(app, /article\.append\(title, summary\)/);
  assert.match(app, /article\.append\(content, meta\)/);
  assert.match(app, /article\.append\(title, metadata, description\)/);
});

test('removes spoiler control fields from every data file and schema', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dataFiles = Object.keys(datasets);
  for (const fileName of dataFiles) {
    const records = JSON.parse(await readFile(path.join(root, 'data', fileName), 'utf8'));
    assert.ok(records.every((record) => !Object.hasOwn(record, 'spoiler') && !Object.hasOwn(record, 'spoilerLevel')), `${fileName} has no spoiler control fields`);
  }
  for (const { schema } of Object.values(datasets)) {
    const contract = JSON.parse(await readFile(path.join(root, 'schemas', schema), 'utf8'));
    assert.ok(!contract.required.includes('spoiler') && !contract.required.includes('spoilerLevel'), `${schema} does not require spoiler controls`);
    assert.ok(!contract.properties.spoiler && !contract.properties.spoilerLevel, `${schema} does not define spoiler controls`);
  }
});

test('restores sourced walkthrough objectives in rendered cards', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const app = await readFile(path.join(root, 'assets', 'js', 'app.js'), 'utf8');
  assert.match(app, /Array\.isArray\(item\.objectives\)/);
  assert.match(app, /heading\.textContent = '已查證目標';/);
  assert.match(app, /item\.objectives\.forEach/);
});

test('requires v0.3 walkthrough routing and objective fields', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const schema = JSON.parse(await readFile(path.join(root, 'schemas', 'walkthrough.schema.json'), 'utf8'));
  for (const field of ['routeId', 'routeTitle', 'objectives', 'prerequisites', 'anyOfPrerequisites', 'branchChoiceIds', 'bossIds', 'brainJackTargetIds', 'missable']) {
    assert.ok(schema.required.includes(field), `walkthrough schema requires ${field}`);
  }
  assert.ok(!schema.required.includes('spoiler') && !schema.required.includes('spoilerLevel'));
  assert.ok(!schema.properties.spoiler && !schema.properties.spoilerLevel);
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
  assert.doesNotMatch(JSON.stringify(walkthrough), /尚未連到角色圖鑑|待 v0\.4 建立正式角色 ID|角色名稱翻譯.*待 v0\.4/);
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
