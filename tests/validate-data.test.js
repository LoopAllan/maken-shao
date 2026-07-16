import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { datasets, validateDataset, validateWalkthroughReferences } from '../scripts/validate-data.js';

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
