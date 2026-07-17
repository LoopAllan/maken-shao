import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.join(root, 'data');
const schemaDirectory = path.join(root, 'schemas');
export const datasets = {
  'sources.json': { schema: 'source.schema.json', type: 'source' },
  'world.json': { schema: 'world.schema.json', type: 'world' },
  'systems.json': { schema: 'system.schema.json', type: 'system' },
  'characters.json': { schema: 'character.schema.json', type: 'character' },
  'walkthrough.json': { schema: 'walkthrough.schema.json', type: 'walkthrough' },
  'knowledge.json': { schema: 'knowledge.schema.json', type: 'knowledge' },
  'endings.json': { schema: 'ending.schema.json', type: 'ending' },
  'bosses.json': { schema: 'boss.schema.json', type: 'boss' }
};
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
function isRealDate(value) {
  if (typeof value !== 'string' || !isoDate.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function allowsType(schema, value) {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  return types.some((type) => (type === 'null' && value === null) || (type === 'array' && Array.isArray(value)) || (type === 'integer' && Number.isInteger(value)) || (type === typeof value && !Array.isArray(value)));
}
function validateValue({ schema, value, label, errors }) {
  if (!allowsType(schema, value)) { errors.push(`${label}: expected ${[].concat(schema.type).join(' or ')}, received ${value === null ? 'null' : typeof value}`); return; }
  if (value === null) return;
  if (schema.const !== undefined && value !== schema.const) errors.push(`${label}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${label}: invalid enum value "${value}"; allowed: ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) errors.push(`${label}: must be at least ${schema.minLength} characters`);
    if (schema.maxLength && value.length > schema.maxLength) errors.push(`${label}: must be at most ${schema.maxLength} characters`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) errors.push(`${label}: does not match required pattern`);
    if (schema.format === 'date' && !isRealDate(value)) errors.push(`${label}: must be a real YYYY-MM-DD date`);
    if (schema.format === 'date-time' && (!isoDateTime.test(value) || Number.isNaN(Date.parse(value)))) errors.push(`${label}: must be a valid UTC ISO 8601 date-time`);
    if (schema.format === 'uri' && !/^https?:\/\//.test(value)) errors.push(`${label}: must be an absolute http(s) URI`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${label}: must be at least ${schema.minimum}`);
  if (typeof value === 'number' && schema.maximum !== undefined && value > schema.maximum) errors.push(`${label}: must be at most ${schema.maximum}`);
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${label}: must contain at least ${schema.minItems} item(s)`);
    if (schema.uniqueItems === true && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${label}: must contain unique items`);
    value.forEach((item, index) => schema.items && validateValue({ schema: schema.items, value: item, label: `${label}[${index}]`, errors }));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const field of schema.required || []) if (!(field in value)) errors.push(`${label}: missing required field "${field}"`);
    for (const [field, fieldSchema] of Object.entries(schema.properties || {})) if (field in value) validateValue({ schema: fieldSchema, value: value[field], label: `${label}.${field}`, errors });
    if (schema.additionalProperties === false) for (const field of Object.keys(value)) if (!(field in (schema.properties || {}))) errors.push(`${label}: unexpected field "${field}"`);
  }
}
export function validateDataset({ fileName, records, sourceIds, type, schema }) {
  const errors = [];
  if (!Array.isArray(records)) return [`${fileName}: top-level value must be an array`];
  const ids = new Set();
  const effectiveSchema = schema || {
    required: ['id','title','summary','content','gameVersion','region','sourceIds','confidence','verificationStatus','verificationNote','lastVerified'],
    properties: {
      gameVersion: { type: 'string', enum: ['maken-x-dreamcast', 'maken-shao-ps2', 'both-confirmed'] },
      confidence: { type: 'string', enum: ['official', 'cross-verified', 'single-source', 'unverified'] },
      verificationStatus: { type: 'string', enum: ['verified', 'partially-verified', 'conflicting', 'not-verified'] },
      lastVerified: { type: 'string', format: 'date' }
    }
  };
  records.forEach((record, index) => {
    const id = record && typeof record.id === 'string' ? record.id : `record-${index + 1}`;
    const prefix = `${fileName} [${id}]`;
    if (!record || typeof record !== 'object' || Array.isArray(record)) { errors.push(`${prefix}: record must be an object`); return; }
    for (const field of effectiveSchema.required || []) if (!(field in record)) errors.push(`${prefix}: missing required field "${field}"`);
    for (const [field, fieldSchema] of Object.entries(effectiveSchema.properties || {})) if (field in record) validateValue({schema:fieldSchema,value:record[field],label:`${prefix}: ${field}`,errors});
    if (effectiveSchema.additionalProperties === false) for (const field of Object.keys(record)) if (!(field in (effectiveSchema.properties || {}))) errors.push(`${prefix}: unexpected field "${field}"`);
    if (typeof record.id === 'string') { if (ids.has(record.id)) errors.push(`${prefix}: duplicate id "${record.id}"`); ids.add(record.id); }
    if (type !== 'source' && Array.isArray(record.sourceIds)) record.sourceIds.forEach((sourceId) => { if (!sourceIds.has(sourceId)) errors.push(`${prefix}: unknown sourceId "${sourceId}"`); });
    if (record.verificationStatus === 'verified' && record.confidence === 'unverified') errors.push(`${prefix}: verified status cannot use unverified confidence`);
    if (record.verificationStatus === 'conflicting' && (!record.verificationNote || record.verificationNote.trim().length < 3)) errors.push(`${prefix}: conflicting status requires a verificationNote`);
    if (record.isPlaceholder === true && ![record.title,record.summary,record.content,record.verificationNote].join(' ').includes('示範資料，非正式攻略內容')) errors.push(`${prefix}: placeholder records must include the required demo warning`);
    if (type === 'character' && (record.imagePath === null) !== (record.imageAlt === null)) errors.push(`${prefix}: imagePath and imageAlt must either both be present or both be null`);
    if (type === 'character' && record.imageKind === 'official-source') {
      if (!record.imageSourceId) errors.push(`${prefix}: official-source requires imageSourceId`);
      else {
        if (!sourceIds.has(record.imageSourceId)) errors.push(`${prefix}: unknown imageSourceId "${record.imageSourceId}"`);
        if (!Array.isArray(record.sourceIds) || !record.sourceIds.includes(record.imageSourceId)) errors.push(`${prefix}: imageSourceId must also appear in sourceIds`);
      }
      if (!record.imageOriginalUrl) errors.push(`${prefix}: official-source requires imageOriginalUrl`);
    }
    if (type === 'character' && typeof record.imageKind === 'string' && record.imageKind.startsWith('community-source-')) {
      if (!record.imageSourceId || !sourceIds.has(record.imageSourceId)) errors.push(`${prefix}: community image requires a registered imageSourceId`);
      if (!Array.isArray(record.sourceIds) || !record.sourceIds.includes(record.imageSourceId)) errors.push(`${prefix}: imageSourceId must also appear in sourceIds`);
      if (!record.imageOriginalUrl || !record.imageFilePageUrl || !record.imageUploader || !record.imageUploadedAt || !record.imageSourceSha1) errors.push(`${prefix}: community image requires complete Fandom provenance`);
    }
    if (type === 'character' && Array.isArray(record.communityReferences)) {
      record.communityReferences.forEach((reference, referenceIndex) => {
        if (!reference || !sourceIds.has(reference.sourceId)) errors.push(`${prefix}: communityReferences[${referenceIndex}] has an unknown sourceId`);
        else if (!Array.isArray(record.sourceIds) || !record.sourceIds.includes(reference.sourceId)) errors.push(`${prefix}: communityReferences[${referenceIndex}].sourceId must also appear in sourceIds`);
      });
    }
    if (type === 'character' && record.imageKind === 'no-attributable-source') {
      if (record.imageSourceId !== null) errors.push(`${prefix}: no-attributable-source requires null imageSourceId`);
      if (record.imageOriginalUrl !== null) errors.push(`${prefix}: no-attributable-source requires null imageOriginalUrl`);
    }
  });
  return errors;
}
function loadJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
export function validateWalkthroughReferences(records) {
  if (!Array.isArray(records)) return [];
  const byId = new Map(records.filter((record) => record && typeof record.id === 'string').map((record) => [record.id, record]));
  const ids = new Set(byId.keys());
  const errors = [];
  const graph = new Map();
  for (const record of records) {
    if (!record || typeof record.id !== 'string') continue;
    const dependencies = [...(Array.isArray(record.prerequisites) ? record.prerequisites : []), ...(Array.isArray(record.anyOfPrerequisites) ? record.anyOfPrerequisites : [])];
    graph.set(record.id, dependencies.filter((reference) => ids.has(reference) && reference !== record.id));
    for (const field of ['prerequisites', 'anyOfPrerequisites', 'branchChoiceIds']) {
      if (!Array.isArray(record[field])) continue;
      if (new Set(record[field]).size !== record[field].length) errors.push(`walkthrough.json [${record.id}]: ${field} contains duplicate references`);
      for (const reference of record[field]) {
        if (!ids.has(reference)) errors.push(`walkthrough.json [${record.id}]: unknown ${field} reference "${reference}"`);
        if (field !== 'branchChoiceIds' && reference === record.id) errors.push(`walkthrough.json [${record.id}]: ${field} cannot reference itself`);
      }
    }
    const required = Array.isArray(record.prerequisites) ? record.prerequisites : [];
    const alternatives = Array.isArray(record.anyOfPrerequisites) ? record.anyOfPrerequisites : [];
    for (const reference of required) if (alternatives.includes(reference)) errors.push(`walkthrough.json [${record.id}]: prerequisite "${reference}" cannot also appear in anyOfPrerequisites`);
    for (const predecessorId of [...required, ...alternatives]) {
      const predecessor = byId.get(predecessorId);
      if (!predecessor) continue;
      const outgoing = Array.isArray(predecessor.branchChoiceIds) ? predecessor.branchChoiceIds : [];
      if (!outgoing.includes(record.id)) errors.push(`walkthrough.json [${record.id}]: prerequisite "${predecessorId}" does not declare this step as a branch target`);
      if (Number.isInteger(predecessor.sequence) && Number.isInteger(record.sequence) && record.sequence < predecessor.sequence) errors.push(`walkthrough.json [${record.id}]: prerequisite "${predecessorId}" has a later sequence`);
    }
    for (const targetId of Array.isArray(record.branchChoiceIds) ? record.branchChoiceIds : []) {
      const target = byId.get(targetId);
      if (!target) continue;
      const incoming = [...(Array.isArray(target.prerequisites) ? target.prerequisites : []), ...(Array.isArray(target.anyOfPrerequisites) ? target.anyOfPrerequisites : [])];
      if (!incoming.includes(record.id)) errors.push(`walkthrough.json [${record.id}]: branch target "${targetId}" does not declare this step as a prerequisite`);
      if (Number.isInteger(record.sequence) && Number.isInteger(target.sequence) && target.sequence < record.sequence) errors.push(`walkthrough.json [${record.id}]: branch target "${targetId}" has an earlier sequence`);
    }
  }
  const state = new Map();
  const visit = (id, path = []) => {
    if (state.get(id) === 1) { errors.push(`walkthrough.json: prerequisite cycle detected (${[...path, id].join(' -> ')})`); return; }
    if (state.get(id) === 2) return;
    state.set(id, 1);
    for (const dependency of graph.get(id) || []) visit(dependency, [...path, id]);
    state.set(id, 2);
  };
  for (const id of ids) visit(id);
  return errors;
}
export function validateCharacterReferences(characters, walkthrough) {
  if (!Array.isArray(characters) || !Array.isArray(walkthrough)) return [];
  const characterIds = new Set(characters.filter((record) => record && typeof record.id === 'string').map((record) => record.id));
  const characterById = new Map(characters.filter((record) => record && typeof record.id === 'string').map((record) => [record.id, record]));
  const walkthroughIds = new Set(walkthrough.filter((record) => record && typeof record.id === 'string').map((record) => record.id));
  const referencedHosts = new Set();
  const errors = [];
  for (const character of characters) {
    if (!character || typeof character.id !== 'string') continue;
    const related = Array.isArray(character.relatedWalkthroughIds) ? character.relatedWalkthroughIds : [];
    if (character.firstAppearanceWalkthroughId !== null && character.firstAppearanceWalkthroughId !== undefined) {
      if (!walkthroughIds.has(character.firstAppearanceWalkthroughId)) errors.push(`characters.json [${character.id}]: unknown firstAppearanceWalkthroughId "${character.firstAppearanceWalkthroughId}"`);
      if (!related.includes(character.firstAppearanceWalkthroughId)) errors.push(`characters.json [${character.id}]: firstAppearanceWalkthroughId must be included in relatedWalkthroughIds`);
    }
    for (const id of related) if (!walkthroughIds.has(id)) errors.push(`characters.json [${character.id}]: unknown relatedWalkthroughIds reference "${id}"`);
    for (const id of Array.isArray(character.wikiLinkedCharacterIds) ? character.wikiLinkedCharacterIds : []) {
      if (!characterIds.has(id)) errors.push(`characters.json [${character.id}]: unknown wikiLinkedCharacterIds reference "${id}"`);
      if (id === character.id) errors.push(`characters.json [${character.id}]: wikiLinkedCharacterIds cannot reference itself`);
    }
  }
  for (const step of walkthrough) {
    if (!step || typeof step.id !== 'string') continue;
    for (const id of Array.isArray(step.brainJackTargetIds) ? step.brainJackTargetIds : []) {
      if (!characterIds.has(id)) errors.push(`walkthrough.json [${step.id}]: unknown brainJackTargetIds reference "${id}"`);
      else {
        referencedHosts.add(id);
        if (characterById.get(id).brainJackStatus !== 'confirmed-host') errors.push(`walkthrough.json [${step.id}]: brainJackTargetIds "${id}" is not marked confirmed-host`);
      }
    }
  }
  for (const character of characters) {
    if (character?.brainJackStatus === 'confirmed-host' && !referencedHosts.has(character.id)) errors.push(`characters.json [${character.id}]: confirmed-host is not referenced by any walkthrough brainJackTargetIds`);
  }
  return errors;
}
export function validateProject() {
  const errors = [];
  let sources = [];
  try { sources = loadJson(path.join(dataDirectory, 'sources.json')); } catch (error) { return [`sources.json: cannot parse JSON (${error.message})`]; }
  const sourceSchema = loadJson(path.join(schemaDirectory, 'source.schema.json'));
  errors.push(...validateDataset({fileName:'sources.json',records:sources,sourceIds:new Set(),type:'source',schema:sourceSchema}));
  const sourceIds = new Set(sources.filter((source) => source && typeof source.id === 'string').map((source) => source.id));
  const recordsByFile = new Map();
  for (const [fileName, config] of Object.entries(datasets)) {
    if (fileName === 'sources.json') continue;
    try {
      const records = loadJson(path.join(dataDirectory,fileName));
      recordsByFile.set(fileName, records);
      errors.push(...validateDataset({fileName,records,sourceIds,type:config.type,schema:loadJson(path.join(schemaDirectory,config.schema))}));
      if (fileName === 'walkthrough.json') errors.push(...validateWalkthroughReferences(records));
    }
    catch (error) { errors.push(`${fileName}: cannot parse JSON or schema (${error.message})`); }
  }
  errors.push(...validateCharacterReferences(recordsByFile.get('characters.json'), recordsByFile.get('walkthrough.json')));
  return errors;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateProject();
  if (errors.length) { console.error(`Data validation failed (${errors.length} error(s)):`); errors.forEach((error) => console.error(`- ${error}`)); process.exitCode = 1; }
  else console.log(`Data validation passed: ${Object.keys(datasets).length} data files and ${Object.keys(datasets).length} schemas checked.`);
}
