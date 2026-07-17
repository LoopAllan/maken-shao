import assert from 'node:assert/strict';
import test from 'node:test';
import '../assets/js/map-links.js';

const { buildMapAliasEntries, segmentMapMentions, shouldLinkMapMention } = globalThis.MakenMaps;

const maps = [
  { id: 'taj-mahal', linkAliases: ['泰姬瑪哈陵', 'タージマハル', 'Taj Mahal'] },
  { id: 'hong-kong', linkAliases: ['香港', 'ホンコン', 'Hong Kong'] },
  { id: 'london', linkAliases: ['倫敦', 'ロンドン', 'London'] }
];

test('links longest multilingual map aliases while preserving ordinary text', () => {
  const aliases = buildMapAliasEntries(maps);
  assert.deepEqual(segmentMapMentions('香港之後可前往泰姬瑪哈陵（Taj Mahal）。', aliases), [
    { text: '香港', mapId: 'hong-kong' },
    { text: '之後可前往', mapId: null },
    { text: '泰姬瑪哈陵', mapId: 'taj-mahal' },
    { text: '（', mapId: null },
    { text: 'Taj Mahal', mapId: 'taj-mahal' },
    { text: '）。', mapId: null }
  ]);
});

test('does not link Latin map aliases inside larger words', () => {
  const aliases = buildMapAliasEntries(maps);
  const segments = segmentMapMentions('Londoner is not the same token as London.', aliases);
  assert.deepEqual(segments.filter((segment) => segment.mapId), [{ text: 'London', mapId: 'london' }]);
});

test('rejects map aliases shared by multiple map records', () => {
  const aliases = buildMapAliasEntries([
    { id: 'one', linkAliases: ['共同地名', '地圖一'] },
    { id: 'two', linkAliases: ['共同地名', '地圖二'] }
  ]);
  assert.equal(aliases.some((entry) => entry.alias === '共同地名'), false);
  assert.equal(aliases.some((entry) => entry.alias === '地圖一' && entry.mapId === 'one'), true);
});

test('avoids self-links and treats Kanazawa institution text as ambiguous', () => {
  assert.equal(shouldLinkMapMention('金澤研究所所長與研究開發人員', 'kanazawa-research-institute', null, 0, 6), false);
  assert.equal(shouldLinkMapMention('完成金澤研究所關卡後前往林卡頓', 'kanazawa-research-institute', null, 2, 8), true);
  assert.equal(shouldLinkMapMention('完成倫敦後', 'london', 'london'), false);
  assert.equal(shouldLinkMapMention('完成倫敦後', 'london', null), true);
});

test('does not let distant process vocabulary turn a Kanazawa institution reference into a map link', () => {
  const text = '金澤研究所所長在流程會議發言。';
  assert.equal(shouldLinkMapMention(text, 'kanazawa-research-institute', null, 0, '金澤研究所'.length), false);
});

test('links explicit Kanazawa stage contexts without leaking across repeated mentions', () => {
  for (const text of ['在金澤研究所的流程中迎戰敵人。', '在金澤研究所以相模桂開始遊戲。']) {
    const start = text.indexOf('金澤研究所');
    assert.equal(shouldLinkMapMention(text, 'kanazawa-research-institute', null, start, start + '金澤研究所'.length), true, text);
  }
  const mixed = '金澤研究所所長表示，完成金澤研究所關卡。';
  const first = mixed.indexOf('金澤研究所');
  const second = mixed.indexOf('金澤研究所', first + 1);
  assert.equal(shouldLinkMapMention(mixed, 'kanazawa-research-institute', null, first, first + '金澤研究所'.length), false);
  assert.equal(shouldLinkMapMention(mixed, 'kanazawa-research-institute', null, second, second + '金澤研究所'.length), true);
  const metadata = '區域：金澤研究所';
  const metadataStart = metadata.indexOf('金澤研究所');
  assert.equal(shouldLinkMapMention(metadata, 'kanazawa-research-institute', null, metadataStart, metadataStart + '金澤研究所'.length), true);
});
