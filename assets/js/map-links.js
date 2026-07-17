(function exposeMapLinks(global) {
  'use strict';

  function normalize(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('en');
  }

  function buildMapAliasEntries(maps) {
    const owners = new Map();
    (maps || []).forEach((map) => {
      [...new Set(map.linkAliases || [])].forEach((alias) => {
        const text = String(alias || '').trim();
        if (!text) return;
        const key = normalize(text);
        if (!owners.has(key)) owners.set(key, new Map());
        owners.get(key).set(map.id, text);
      });
    });
    return [...owners.entries()]
      .filter(([, entries]) => entries.size === 1)
      .map(([normalizedAlias, entries]) => {
        const [[mapId, alias]] = entries;
        return { alias, normalizedAlias, mapId };
      })
      .sort((a, b) => b.normalizedAlias.length - a.normalizedAlias.length || a.alias.localeCompare(b.alias));
  }

  function hasSafeBoundaries(text, index, alias) {
    const before = index > 0 ? text[index - 1] : '';
    const after = text[index + alias.length] || '';
    if (/^[ァ-ヶー]+$/u.test(alias)) return !/[ァ-ヶー]/u.test(before) && !/[ァ-ヶー]/u.test(after);
    if (/^[a-z0-9][a-z0-9 .'-]*$/i.test(alias)) return !/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after);
    return true;
  }

  function segmentMapMentions(text, aliasEntries) {
    const original = String(text || '');
    if (!original || !aliasEntries?.length) return [{ text: original, mapId: null }];
    const normalized = normalize(original);
    const segments = [];
    const append = (value, mapId = null) => {
      if (!value) return;
      const previous = segments.at(-1);
      if (previous?.mapId === mapId) previous.text += value;
      else segments.push({ text: value, mapId });
    };
    let index = 0;
    while (index < original.length) {
      const match = aliasEntries.find((entry) => normalized.startsWith(entry.normalizedAlias, index)
        && hasSafeBoundaries(normalized, index, entry.normalizedAlias));
      if (match) {
        append(original.slice(index, index + match.normalizedAlias.length), match.mapId);
        index += match.normalizedAlias.length;
      } else {
        append(original[index]);
        index += 1;
      }
    }
    return segments;
  }

  function shouldLinkMapMention(text, mapId, ownMapId = null, start = null, end = null) {
    if (!mapId || mapId === ownMapId) return false;
    if (mapId !== 'kanazawa-research-institute') return true;
    const value = String(text || '');
    if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
    const before = value.slice(Math.max(0, start - 12), start);
    const after = value.slice(end, Math.min(value.length, end + 16));
    const routeActionBefore = /(地圖|關卡|攻略|開局|前往|進入|重訪|離開|完成|通關|破關|解鎖)(?:至|到|了|在|的)?$/u.test(before);
    const explicitStageSuffix = /^(?:的)?(?:地圖|關卡|攻略|流程)(?:中|內|段落|路線|部分)?(?!會議)/u.test(after);
    const startsThere = /(?:在|於)$/u.test(before) && /^(?:以.{1,8})?開始(?:遊戲|行動)/u.test(after);
    return routeActionBefore || explicitStageSuffix || startsThere;
  }

  global.MakenMaps = { buildMapAliasEntries, segmentMapMentions, shouldLinkMapMention };
})(typeof window === 'undefined' ? globalThis : window);
