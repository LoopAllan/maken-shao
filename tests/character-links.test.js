import assert from 'node:assert/strict';
import test from 'node:test';
import '../assets/js/character-links.js';

const { buildCharacterAliasEntries, segmentCharacterMentions } = globalThis.MakenCharacters;

const characters = [
  { id: 'kei-sagami', linkAliases: ['相模桂', '桂', 'Kei Sagami'] },
  { id: 'rei', linkAliases: ['八卦雷', '雷', 'レイ', 'Rei'] },
  { id: 'inaba-go', linkAliases: ['稻葉鄉', '稲葉郷', 'Inaba Go'] }
];

test('links the longest character alias while preserving ordinary text', () => {
  const aliases = buildCharacterAliasEntries(characters);
  const segments = segmentCharacterMentions('相模桂與八卦雷交戰，之後擊敗雷。', aliases, []);
  assert.deepEqual(segments, [
    { text: '相模桂', characterId: 'kei-sagami' },
    { text: '與', characterId: null },
    { text: '八卦雷', characterId: 'rei' },
    { text: '交戰，之後擊敗', characterId: null },
    { text: '雷', characterId: 'rei' },
    { text: '。', characterId: null }
  ]);
});

test('does not link a one-character character alias inside protected move names', () => {
  const aliases = buildCharacterAliasEntries(characters);
  const segments = segmentCharacterMentions('稻葉鄉在 60% 習得落雷，100% 習得稲葉百雷。', aliases, ['落雷', '稲葉百雷']);
  assert.deepEqual(segments.filter((segment) => segment.characterId), [
    { text: '稻葉鄉', characterId: 'inaba-go' }
  ]);
});

test('does not link character aliases embedded in protected game titles', () => {
  const aliases = buildCharacterAliasEntries([{ id: 'maken', linkAliases: ['魔剣', 'Maken'] }]);
  const segments = segmentCharacterMentions('PS2《魔剣爻》與 Dreamcast《Maken X》', aliases, ['魔剣爻', 'Maken X']);
  assert.equal(segments.some((segment) => segment.characterId), false);
});

test('does not link short katakana or Latin aliases inside larger words', () => {
  const aliases = buildCharacterAliasEntries(characters);
  const segments = segmentCharacterMentions('プレイヤーはプレイステーション2でブレインジャックする。Reign is not Rei.', aliases, []);
  assert.deepEqual(segments.filter((segment) => segment.characterId), [
    { text: 'Rei', characterId: 'rei' }
  ]);
});

test('rejects aliases shared by multiple characters instead of guessing a target', () => {
  const aliases = buildCharacterAliasEntries([
    { id: 'one', linkAliases: ['共享名', '角色一'] },
    { id: 'two', linkAliases: ['共享名', '角色二'] }
  ]);
  assert.equal(aliases.some((entry) => entry.alias === '共享名'), false);
  assert.equal(aliases.some((entry) => entry.alias === '角色一' && entry.characterId === 'one'), true);
});
