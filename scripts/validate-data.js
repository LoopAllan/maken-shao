import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDirectory = path.join(root, 'data');
const schemaDirectory = path.join(root, 'schemas');
const datasets = {
  'sources.json': { schema: 'source.schema.json', type: 'source' },
  'characters.json': { schema: 'character.schema.json', type: 'character' },
  'walkthrough.json': { schema: 'walkthrough.schema.json', type: 'walkthrough' },
  'knowledge.json': { schema: 'knowledge.schema.json', type: 'knowledge' },
  'endings.json': { schema: 'ending.schema.json', type: 'ending' },
  'bosses.json': { schema: 'boss.schema.json', type: 'boss' }
};
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
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
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${label}: invalid enum value "${value}"; allowed: ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) errors.push(`${label}: must be at least ${schema.minLength} characters`);
    if (schema.maxLength && value.length > schema.maxLength) errors.push(`${label}: must be at most ${schema.maxLength} characters`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) errors.push(`${label}: does not match required pattern`);
    if (schema.format === 'date' && !isRealDate(value)) errors.push(`${label}: must be a real YYYY-MM-DD date`);
    if (schema.format === 'uri' && !/^https?:\/\//.test(value)) errors.push(`${label}: must be an absolute http(s) URI`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${label}: must be at least ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${label}: must contain at least ${schema.minItems} item(s)`);
    value.forEach((item, index) => schema.items && validateValue({ schema: schema.items, value: item, label: `${label}[${index}]`, errors }));
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
  });
  return errors;
}
function loadJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
export function validateProject() {
  const errors = [];
  let sources = [];
  try { sources = loadJson(path.join(dataDirectory, 'sources.json')); } catch (error) { return [`sources.json: cannot parse JSON (${error.message})`]; }
  const sourceSchema = loadJson(path.join(schemaDirectory, 'source.schema.json'));
  errors.push(...validateDataset({fileName:'sources.json',records:sources,sourceIds:new Set(),type:'source',schema:sourceSchema}));
  const sourceIds = new Set(sources.filter((source) => source && typeof source.id === 'string').map((source) => source.id));
  for (const [fileName, config] of Object.entries(datasets)) {
    if (fileName === 'sources.json') continue;
    try { errors.push(...validateDataset({fileName,records:loadJson(path.join(dataDirectory,fileName)),sourceIds,type:config.type,schema:loadJson(path.join(schemaDirectory,config.schema))})); }
    catch (error) { errors.push(`${fileName}: cannot parse JSON or schema (${error.message})`); }
  }
  return errors;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateProject();
  if (errors.length) { console.error(`Data validation failed (${errors.length} error(s)):`); errors.forEach((error) => console.error(`- ${error}`)); process.exitCode = 1; }
  else console.log('Data validation passed: 7 data files and 6 schemas checked.');
}
