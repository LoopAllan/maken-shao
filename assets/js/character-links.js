(function exposeCharacterLinks(global) {
  'use strict';

  function normalize(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase('en');
  }

  function buildCharacterAliasEntries(characters) {
    const owners = new Map();
    (characters || []).forEach((character) => {
      [...new Set(character.linkAliases || [])].forEach((alias) => {
        const text = String(alias || '').trim();
        if (!text) return;
        const key = normalize(text);
        if (!owners.has(key)) owners.set(key, new Map());
        owners.get(key).set(character.id, text);
      });
    });
    return [...owners.entries()]
      .filter(([, entries]) => entries.size === 1)
      .map(([key, entries]) => {
        const [[characterId, alias]] = entries;
        return { alias, normalizedAlias: key, characterId };
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

  function segmentCharacterMentions(text, aliasEntries, protectedTerms = []) {
    const original = String(text || '');
    if (!original || !aliasEntries?.length) return [{ text: original, characterId: null }];
    const normalized = normalize(original);
    const protectedIndexes = new Uint8Array(original.length);
    protectedTerms.forEach((term) => {
      const needle = normalize(term);
      if (!needle) return;
      let start = normalized.indexOf(needle);
      while (start !== -1) {
        for (let index = start; index < start + needle.length && index < protectedIndexes.length; index += 1) protectedIndexes[index] = 1;
        start = normalized.indexOf(needle, start + Math.max(needle.length, 1));
      }
    });
    const segments = [];
    const append = (value, characterId = null) => {
      if (!value) return;
      const previous = segments.at(-1);
      if (previous?.characterId === characterId) previous.text += value;
      else segments.push({ text: value, characterId });
    };
    let index = 0;
    while (index < original.length) {
      const match = !protectedIndexes[index] && aliasEntries.find((entry) => {
        if (!normalized.startsWith(entry.normalizedAlias, index)) return false;
        if (!hasSafeBoundaries(normalized, index, entry.normalizedAlias)) return false;
        for (let cursor = index; cursor < index + entry.normalizedAlias.length; cursor += 1) if (protectedIndexes[cursor]) return false;
        return true;
      });
      if (match) {
        append(original.slice(index, index + match.normalizedAlias.length), match.characterId);
        index += match.normalizedAlias.length;
      } else {
        append(original[index]);
        index += 1;
      }
    }
    return segments;
  }

  global.MakenCharacters = { buildCharacterAliasEntries, segmentCharacterMentions };
})(typeof window === 'undefined' ? globalThis : window);
