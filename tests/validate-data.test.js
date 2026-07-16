import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { datasets, validateDataset } from '../scripts/validate-data.js';

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
  role: null
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
