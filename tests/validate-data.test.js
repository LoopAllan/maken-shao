import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDataset } from '../scripts/validate-data.js';

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
