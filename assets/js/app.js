(() => {
  const basePath = document.documentElement.dataset.base || '.';
  const menuButton = document.querySelector('[data-menu-toggle]');
  const sidebar = document.querySelector('.sidebar');
  const themeButton = document.querySelector('[data-theme-toggle]');
  const contentTarget = document.querySelector('[data-content-file]');

  menuButton?.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeButton?.setAttribute('aria-label', theme === 'dark' ? '切換為淺色模式' : '切換為深色模式');
  }

  setTheme(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  themeButton?.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    setTheme(theme);
  });

  function characterDetailHref(id) {
    return `${basePath}/pages/characters/${encodeURIComponent(id)}.html`;
  }

  function mapHref(id) {
    return `${basePath}/pages/maps.html#record-${encodeURIComponent(id)}`;
  }

  let mapContextPromise;
  function getMapContext() {
    if (!mapContextPromise) {
      mapContextPromise = window.MakenData.loadJson(basePath, 'maps.json').then((maps) => ({
        maps,
        mapMap: new Map(maps.map((map) => [map.id, map])),
        aliases: window.MakenMaps.buildMapAliasEntries(maps)
      }));
    }
    return mapContextPromise;
  }

  function decorateMapLink(link, mapId) {
    link.classList.add('map-link');
    link.dataset.mapId = mapId;
    return link;
  }

  async function linkMapMentions(root) {
    if (!root || !window.MakenMaps) return;
    const context = await getMapContext();
    const excluded = 'a, button, input, select, textarea, script, style, code, pre, [data-no-map-links], [data-map-title]';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue.trim() && !node.parentElement?.closest(excluded)) nodes.push(node);
    }
    const textContextFor = (node) => {
      const root = node.parentElement;
      if (!root) return { text: node.nodeValue, offset: 0 };
      const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let offset = 0;
      while (textWalker.nextNode()) {
        const current = textWalker.currentNode;
        if (current === node) return { text: root.textContent, offset };
        offset += current.nodeValue.length;
      }
      return { text: node.nodeValue, offset: 0 };
    };
    nodes.forEach((node) => {
      const segments = window.MakenMaps.segmentMapMentions(node.nodeValue, context.aliases);
      if (!segments.some((segment) => segment.mapId)) return;
      const ownMapId = node.parentElement?.closest('.map-card[data-map-id]')?.dataset.mapId;
      const mentionContext = textContextFor(node);
      const fragment = document.createDocumentFragment();
      let offset = 0;
      segments.forEach((segment) => {
        const end = offset + segment.text.length;
        const contextStart = mentionContext.offset + offset;
        const contextEnd = mentionContext.offset + end;
        if (!window.MakenMaps.shouldLinkMapMention(mentionContext.text, segment.mapId, ownMapId, contextStart, contextEnd)) {
          fragment.append(segment.text);
          offset = end;
          return;
        }
        const link = document.createElement('a');
        link.href = mapHref(segment.mapId);
        link.textContent = segment.text;
        decorateMapLink(link, segment.mapId);
        fragment.append(link);
        offset = end;
      });
      node.replaceWith(fragment);
    });
  }

  let characterContextPromise;
  function getCharacterContext() {
    if (!characterContextPromise) {
      characterContextPromise = Promise.all([
        window.MakenData.loadJson(basePath, 'characters.json'),
        window.MakenData.loadJson(basePath, 'character-details.json')
      ]).then(([characters, details]) => ({
        characters,
        details,
        characterMap: new Map(characters.map((character) => [character.id, character])),
        aliases: window.MakenCharacters.buildCharacterAliasEntries(characters),
        protectedTerms: [...new Set([...details.flatMap((detail) => detail.techniques.map((technique) => technique.nameJa)), '魔剣爻', 'Maken Shao', 'Maken X', '魔剣X'])]
      }));
    }
    return characterContextPromise;
  }

  function decorateCharacterLink(link, characterId) {
    link.classList.add('character-link');
    link.dataset.characterId = characterId;
    return link;
  }

  async function linkCharacterMentions(root) {
    if (!root) return;
    const context = await getCharacterContext();
    const excluded = 'a, button, input, select, textarea, script, style, code, pre, .metadata, [data-no-character-links], [data-character-page-title], .technique-table';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue.trim() && !node.parentElement?.closest(excluded)) nodes.push(node);
    }
    nodes.forEach((node) => {
      const segments = window.MakenCharacters.segmentCharacterMentions(node.nodeValue, context.aliases, context.protectedTerms);
      if (!segments.some((segment) => segment.characterId)) return;
      const fragment = document.createDocumentFragment();
      segments.forEach((segment) => {
        if (!segment.characterId) {
          fragment.append(segment.text);
          return;
        }
        const link = document.createElement('a');
        link.href = characterDetailHref(segment.characterId);
        link.textContent = segment.text;
        decorateCharacterLink(link, segment.characterId);
        fragment.append(link);
      });
      node.replaceWith(fragment);
    });
  }

  function initializeCharacterPreviews() {
    const preview = document.createElement('aside');
    preview.id = 'character-preview-card';
    preview.className = 'character-preview-card';
    preview.setAttribute('role', 'tooltip');
    preview.hidden = true;
    const image = document.createElement('img');
    const body = document.createElement('div');
    const title = document.createElement('strong');
    const names = document.createElement('span');
    const summary = document.createElement('p');
    body.append(title, names, summary);
    preview.append(image, body);
    document.body.append(preview);
    let activeLink = null;
    let context;
    getCharacterContext().then((value) => { context = value; });

    const position = (link) => {
      const bounds = link.getBoundingClientRect();
      const width = Math.min(336, window.innerWidth - 24);
      preview.style.width = `${width}px`;
      const left = Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12));
      const estimatedHeight = 176;
      const top = bounds.bottom + estimatedHeight + 12 < window.innerHeight ? bounds.bottom + 8 : Math.max(12, bounds.top - estimatedHeight - 8);
      preview.style.left = `${Math.round(left)}px`;
      preview.style.top = `${Math.round(top)}px`;
    };
    const show = async (link) => {
      context ||= await getCharacterContext();
      const character = context.characterMap.get(link.dataset.characterId);
      if (!character || !character.imagePath) return;
      if (activeLink && activeLink !== link) activeLink.removeAttribute('aria-describedby');
      activeLink = link;
      image.src = `${basePath}/${character.imagePath}`;
      image.alt = character.imageAlt;
      title.textContent = character.nameZhHant;
      names.textContent = `${character.nameJa}｜${character.nameEn}`;
      summary.textContent = character.summary;
      preview.hidden = false;
      link.setAttribute('aria-describedby', preview.id);
      position(link);
    };
    const hide = (link) => {
      if (link && activeLink !== link) return;
      activeLink?.removeAttribute('aria-describedby');
      activeLink = null;
      preview.hidden = true;
      image.removeAttribute('src');
    };
    const characterLink = (event) => event.target.closest?.('a.character-link[data-character-id]');
    document.addEventListener('pointerenter', (event) => { const link = characterLink(event); if (link) show(link); }, true);
    document.addEventListener('pointerleave', (event) => { const link = characterLink(event); if (link) hide(link); }, true);
    document.addEventListener('focusin', (event) => { const link = characterLink(event); if (link) show(link); });
    document.addEventListener('focusout', (event) => { const link = characterLink(event); if (link) hide(link); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hide(); });
    window.addEventListener('scroll', () => { if (activeLink) position(activeLink); }, { passive: true });
    window.addEventListener('resize', () => { if (activeLink) position(activeLink); });
  }

  function initializeMapPreviews() {
    const preview = document.createElement('aside');
    preview.id = 'map-preview-card';
    preview.className = 'map-preview-card';
    preview.setAttribute('role', 'tooltip');
    preview.hidden = true;
    const image = document.createElement('img');
    const body = document.createElement('div');
    const title = document.createElement('strong');
    const names = document.createElement('span');
    const summary = document.createElement('p');
    body.append(title, names, summary);
    preview.append(image, body);
    document.body.append(preview);
    let activeLink = null;
    let context;
    getMapContext().then((value) => { context = value; }).catch((error) => console.warn(error));

    const position = (link) => {
      const bounds = link.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 24);
      preview.style.width = `${width}px`;
      preview.style.left = `${Math.round(Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)))}px`;
      const estimatedHeight = 196;
      const top = bounds.bottom + estimatedHeight + 12 < window.innerHeight ? bounds.bottom + 8 : Math.max(12, bounds.top - estimatedHeight - 8);
      preview.style.top = `${Math.round(top)}px`;
    };
    const show = async (link) => {
      context ||= await getMapContext();
      const map = context.mapMap.get(link.dataset.mapId);
      const media = map?.images?.[0];
      if (!map || !media) return;
      if (activeLink && activeLink !== link) activeLink.removeAttribute('aria-describedby');
      activeLink = link;
      image.src = `${basePath}/${media.path}`;
      image.alt = media.alt;
      title.textContent = map.nameZhHant;
      names.textContent = `${map.nameJa}｜${map.nameEn}`;
      summary.textContent = map.summary;
      preview.hidden = false;
      link.setAttribute('aria-describedby', preview.id);
      position(link);
    };
    const hide = (link) => {
      if (link && activeLink !== link) return;
      activeLink?.removeAttribute('aria-describedby');
      activeLink = null;
      preview.hidden = true;
      image.removeAttribute('src');
    };
    const mapLink = (event) => event.target.closest?.('a.map-link[data-map-id]');
    document.addEventListener('pointerenter', (event) => { const link = mapLink(event); if (link) show(link); }, true);
    document.addEventListener('pointerleave', (event) => { const link = mapLink(event); if (link) hide(link); }, true);
    document.addEventListener('focusin', (event) => { const link = mapLink(event); if (link) show(link); });
    document.addEventListener('focusout', (event) => { const link = mapLink(event); if (link) hide(link); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hide(); });
    window.addEventListener('scroll', () => { if (activeLink) position(activeLink); }, { passive: true });
    window.addEventListener('resize', () => { if (activeLink) position(activeLink); });
  }

  function badge(text) {
    const item = document.createElement('li');
    item.className = 'badge';
    item.textContent = text;
    return item;
  }

  function sourceLinks(item, sourceMap) {
    const sources = document.createElement('div');
    sources.className = 'card-source-strip';
    sources.setAttribute('aria-label', '來源');
    const label = document.createElement('span');
    label.className = 'card-strip-label';
    label.textContent = '來源';
    sources.append(label);
    item.sourceIds.forEach((id, index) => {
      const source = sourceMap.get(id);
      if (index) sources.append('｜');
      if (!source?.url) {
        sources.append(id);
        return;
      }
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title;
      sources.append(link);
    });
    return sources;
  }

  function tagStrip(item) {
    const tags = document.createElement('ul');
    tags.className = 'card-tag-strip';
    tags.setAttribute('aria-label', '標籤');
    if (!Array.isArray(item.tags) || !item.tags.length) {
      tags.hidden = true;
      return tags;
    }
    const label = document.createElement('li');
    label.className = 'card-strip-label';
    label.textContent = '標籤';
    tags.append(label);
    item.tags.forEach((tag) => tags.append(badge(`#${tag}`)));
    return tags;
  }

  function characterIdentity(item) {
    const identity = document.createElement('dl');
    identity.className = 'character-identity';
    const rows = [
      ['中文名', item.nameZhHant],
      ['日文名', item.nameJa],
      ['英文名', item.nameEn]
    ];
    rows.forEach(([label, value]) => {
      const term = document.createElement('dt');
      term.textContent = label;
      const definition = document.createElement('dd');
      definition.textContent = value;
      identity.append(term, definition);
    });
    return identity;
  }

  function characterImageAlt(item) {
    const assetUrl = item.imageFilePageUrl || item.imageOriginalUrl;
    const sourceNotice = item.imageKind === 'official-source'
      ? '圖像來源：Atlus《魔剣爻》官方角色介紹保存頁；© ATLUS，僅作來源識別與引用。'
      : '圖像來源：MegaTen Wiki / Fandom 角色頁的本地縮圖；本站不主張圖像著作權或自由再散布授權。';
    return [
      item.imageAlt || `${item.nameZhHant}（${item.nameJa}）角色圖`,
      sourceNotice,
      assetUrl && `來源資產：${assetUrl}。`,
      (item.imageUploader || item.imageUploadedAt) && `上傳記錄：${item.imageUploader || '未列'}／${item.imageUploadedAt || '未列'}。`,
      item.imageSourceMime && item.imageSourceWidth && item.imageSourceHeight && item.imageSourceBytes && `Wiki 原始資產：${item.imageSourceMime}、${item.imageSourceWidth}×${item.imageSourceHeight}、${item.imageSourceBytes.toLocaleString('zh-Hant')} bytes；本站下載縮圖：${item.imageLocalMime || '格式未列'}。`,
      item.imageSourceVerification && `原始資產驗證：${item.imageSourceVerification}。`,
      item.imageVersionNote && `版本註記：${item.imageVersionNote}`,
      item.imageRightsNote && `權利註記：${item.imageRightsNote}`
    ].filter(Boolean).join(' ');
  }

  function mapImageAlt(media, sourceMap) {
    const kindLabels = { 'globe-marker': '地球儀上的地圖點', 'map-structure': '地圖構造', 'landmark-gameplay': '標誌性遊戲畫面', 'location-card': '地點卡片' };
    const associationLabel = media.associationMethod === 'file-title-series' ? '檔名系列關聯頁' : '地圖關聯頁';
    return [
      media.alt,
      `${kindLabels[media.kind] || media.kind}；版本範圍：${media.gameVersionScope}。`,
      `來源：${sourceMap.get(media.sourceId)?.title || '圖片來源頁'}；${associationLabel}：${media.associationPageUrl}；revision ${media.associationPageRevisionId}。`,
      `Wiki 檔案頁：${media.filePageUrl}；${media.fileTitle}；revision ${media.fileRevisionId}；上傳者／時間：${media.sourceUploader}／${media.sourceUploadedAt}。`,
      `原始資產：${media.originalUrl}。`,
      `本地檔對應的 Wiki WebP 輸出：${media.derivativeUrl}。`,
      `本地 WebP：${media.width}×${media.height}；${media.bytes.toLocaleString('en-US')} bytes；SHA-256：${media.sha256}。`,
      `Wiki 原始資產：${media.sourceMime}；${media.sourceWidth}×${media.sourceHeight}；${media.sourceBytes.toLocaleString('en-US')} bytes；MediaWiki SHA-1：${media.sourceSha1}。`,
      `場景對應：${media.associationNote}`,
      `權利註記：${media.rightsNote}`
    ].join(' ');
  }

  function techniqueImageAlt(media, sourceMap) {
    return [
      media.alt,
      `來源關聯：${sourceMap.get(media.sourceId)?.title || '招式畫面來源'}（${media.kind}）。`,
      `來源頁：${media.sourcePageUrl}。`,
      `原始資產 URL：${media.originalUrl}。`,
      `Wayback 保存資產 URL：${media.archiveUrl}。`,
      `Wayback 保存檔案：${media.archiveBytes.toLocaleString('en-US')} bytes；SHA-256：${media.sha256}。`,
      `權利註記：${media.rightsNote}`
    ].join(' ');
  }

  function characterImage(item) {
    if (!item.imagePath) {
      const unavailable = document.createElement('p');
      unavailable.className = 'character-image-unavailable';
      unavailable.textContent = '目前未找到可合法下載且可對應此角色的來源圖像。';
      return unavailable;
    }
    const figure = document.createElement('figure');
    figure.className = 'character-portrait';
    const image = document.createElement('img');
    image.src = `${basePath}/${item.imagePath}`;
    image.alt = characterImageAlt(item);
    image.loading = 'lazy';
    image.decoding = 'async';
    figure.append(image);
    return figure;
  }

  function renderMapCard(item, sourceMap, mapMap, characterMap) {
    const article = document.createElement('article');
    article.className = 'card map-card';
    article.id = `record-${item.id}`;
    article.dataset.mapId = item.id;

    const title = document.createElement('h2');
    title.dataset.mapTitle = '';
    const titleLink = document.createElement('a');
    titleLink.href = mapHref(item.id);
    titleLink.textContent = item.title;
    decorateMapLink(titleLink, item.id);
    title.append(titleLink);
    const summary = document.createElement('p');
    summary.className = 'lead';
    summary.textContent = item.summary;
    const identity = document.createElement('dl');
    identity.className = 'character-identity map-identity';
    identity.dataset.noMapLinks = '';
    [['中文名', item.nameZhHant], ['日文名', item.nameJa], ['英文名', item.nameEn]].forEach(([label, value]) => {
      const term = document.createElement('dt');
      term.textContent = label;
      const definition = document.createElement('dd');
      definition.textContent = value;
      identity.append(term, definition);
    });
    const meta = document.createElement('ul');
    meta.className = 'metadata';
    const mapTypeLabels = { main: '主線', optional: '可選', ending: '終點' };
    meta.append(
      badge(`順序：${item.sequence}`),
      badge(`性質：${mapTypeLabels[item.mapType] || item.mapType}`),
      badge(item.isMainMap ? '主要地圖' : '非主要地圖'),
      badge(`版本：${item.gameVersion}`),
      badge(`可信度：${item.confidence}`),
      badge(`最後查證：${item.lastVerified}`)
    );
    article.append(title, summary, identity, meta);

    const gallery = document.createElement('div');
    gallery.className = 'map-media-gallery';
    item.images.forEach((media) => {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = `${basePath}/${media.path}`;
      image.alt = mapImageAlt(media, sourceMap);
      image.loading = 'lazy';
      image.decoding = 'async';
      figure.append(image);
      gallery.append(figure);
    });
    article.append(gallery);

    const appendTextSection = (headingText, text) => {
      const heading = document.createElement('h3');
      heading.textContent = headingText;
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      article.append(heading, paragraph);
    };
    appendTextSection('地圖性質與劇情', item.story);
    appendTextSection('地圖構造', item.structure);

    const appendMapList = (headingText, ids) => {
      if (!ids.length) return;
      const heading = document.createElement('h3');
      heading.textContent = headingText;
      const list = document.createElement('ul');
      ids.forEach((id) => {
        const map = mapMap.get(id);
        const row = document.createElement('li');
        if (map) {
          const link = document.createElement('a');
          link.href = mapHref(id);
          link.textContent = map.title;
          decorateMapLink(link, id);
          row.append(link);
        } else row.textContent = id;
        list.append(row);
      });
      article.append(heading, list);
    };
    appendMapList('前置地圖（全部必須完成）', item.requiredMapIds);
    appendMapList('前置地圖（符合其中之一）', item.anyOfRequiredMapIds);
    if (item.unlockNote) appendTextSection('解鎖條件', item.unlockNote);

    if (item.obtainableCharacterIds.length) {
      const heading = document.createElement('h3');
      heading.textContent = '可獲得角色';
      const list = document.createElement('ul');
      item.obtainableCharacterIds.forEach((id) => {
        const character = characterMap.get(id);
        const row = document.createElement('li');
        if (character) {
          const link = document.createElement('a');
          link.href = characterDetailHref(id);
          link.textContent = character.title;
          decorateCharacterLink(link, id);
          row.append(link);
        } else row.textContent = id;
        list.append(row);
      });
      article.append(heading, list);
    }

    if (item.enemies.length) {
      const heading = document.createElement('h3');
      heading.textContent = '敵人';
      const list = document.createElement('ul');
      const enemyTypeLabels = { 'standard-enemy': '一般敵', boss: 'Boss', 'brain-jack-target': 'Brain Jack 對象', hazard: '危險物' };
      item.enemies.forEach((enemy) => {
        const row = document.createElement('li');
        row.textContent = `${enemy.nameZhHant}｜${enemy.nameJa}${enemy.nameEn ? `｜${enemy.nameEn}` : ''}（${enemyTypeLabels[enemy.type] || enemy.type}）`;
        list.append(row);
      });
      article.append(heading, list);
    }
    article.append(tagStrip(item), sourceLinks(item, sourceMap));
    return article;
  }

  function renderContentCard(item, sourceMap, contentType) {
    const article = document.createElement('article');
    article.className = 'card';
    article.id = `record-${item.id}`;
    article.dataset.recordId = item.id;
    const isCharacter = contentType === 'characters';
    if (isCharacter && item.characterGroup) article.dataset.characterGroup = item.characterGroup;
    const title = document.createElement('h2');
    if (isCharacter) {
      const detailLink = document.createElement('a');
      detailLink.href = characterDetailHref(item.id);
      detailLink.textContent = item.title;
      decorateCharacterLink(detailLink, item.id);
      title.append(detailLink);
    } else {
      title.textContent = item.title;
    }
    const summary = document.createElement('p');
    summary.textContent = item.summary;
    const content = document.createElement('p');
    content.textContent = item.content;
    const meta = document.createElement('ul');
    meta.className = 'metadata';
    meta.append(
      badge(`版本：${item.gameVersion}`),
      badge(`可信度：${item.confidence}`),
      badge(`查證狀態：${item.verificationStatus}`),
      badge(`最後查證：${item.lastVerified}`)
    );
    if (item.characterGroup) meta.append(badge(`分類：${item.characterGroup}`));
    if (item.wikiNavigationGroup) meta.append(badge(`Wiki 導覽：${item.wikiNavigationGroup === 'playable' ? 'Playable' : 'Non-playable'}`));
    if (item.characterType) meta.append(badge(`角色類型：${item.characterType}`));
    if (item.brainJackStatus) meta.append(badge(`Brain Jack：${item.brainJackStatus}`));
    if (Number.isInteger(item.age)) meta.append(badge(`社群頁年齡：${item.age}`));
    if (item.occupation) meta.append(badge(`社群頁身分／職業：${item.occupation}`));
    if (Array.isArray(item.affiliations) && item.affiliations.length) meta.append(badge(`所屬：${item.affiliations.join('、')}`));
    if (Number.isInteger(item.sequence)) meta.prepend(badge(`順序：${item.sequence}`));
    if (item.area) meta.append(badge(`區域：${item.area}`));
    if (item.routeId) meta.append(badge(`路線：${item.routeTitle || item.routeId}`));
    if (item.missable === true) meta.append(badge('可錯過'));

    article.append(title, summary);
    if (isCharacter) article.append(characterImage(item));
    article.append(content, meta);
    if (Array.isArray(item.objectives) && item.objectives.length) {
      const heading = document.createElement('h3');
      heading.textContent = '已查證目標';
      const list = document.createElement('ul');
      item.objectives.forEach((objective) => {
        const row = document.createElement('li');
        row.textContent = objective;
        list.append(row);
      });
      article.append(heading, list);
    }
    article.append(tagStrip(item), sourceLinks(item, sourceMap));
    return article;
  }

  const searchPageMeta = {
    world: ['遊戲介紹', 'pages/introduction.html'], systems: ['系統', 'pages/systems.html'],
    walkthrough: ['流程攻略', 'pages/walkthrough.html'], characters: ['角色圖鑑', 'pages/characters.html'],
    maps: ['地圖圖鑑', 'pages/maps.html'], knowledge: ['Knowledge', 'pages/knowledge.html'],
    endings: ['結局', 'pages/endings.html'], bosses: ['Boss', 'pages/bosses.html']
  };

  function plainText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(plainText).join(' ');
    return Object.values(value).map(plainText).join(' ');
  }

  function searchHref(type, item) {
    if (type === 'character-details') return `${basePath}/pages/characters/${encodeURIComponent(item.id)}.html#main-content`;
    if (type === 'sources') return `${basePath}/pages/references.html#record-source-${encodeURIComponent(item.id)}`;
    const [, page] = searchPageMeta[type];
    return `${basePath}/${page}#record-${encodeURIComponent(item.id)}`;
  }

  function snippetFor(text, query) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const at = normalized.toLocaleLowerCase('zh-Hant').indexOf(query);
    if (at < 0) return normalized.slice(0, 180);
    return `${at > 55 ? '…' : ''}${normalized.slice(Math.max(0, at - 55), at + query.length + 110)}${at + query.length + 110 < normalized.length ? '…' : ''}`;
  }

  async function search(query) {
    const results = document.querySelector('[data-global-search-results]');
    if (!results) return;
    results.replaceChildren();
    results.hidden = false;
    if (!query) { results.textContent = '請輸入關鍵字。'; return; }
    try {
      const [data, details, sources] = await Promise.all([
        window.MakenData.loadAllContent(basePath),
        window.MakenData.loadJson(basePath, 'character-details.json'),
        window.MakenData.loadJson(basePath, 'sources.json')
      ]);
      const characterById = new Map(data.characters.map((item) => [item.id, item]));
      const records = [
        ...Object.entries(data).flatMap(([type, items]) => items.map((item) => ({ type, item, title: item.title, text: plainText(item) }))),
        ...details.map((item) => ({ type: 'character-details', item, title: `${characterById.get(item.id)?.title || item.id}｜角色詳細資料`, text: plainText(item) })),
        ...sources.filter((item) => item.id !== 'demo-source').map((item) => ({ type: 'sources', item, title: item.title, text: plainText(item) }))
      ];
      const normalizedQuery = query.toLocaleLowerCase('zh-Hant');
      const hits = records.filter((record) => record.text.toLocaleLowerCase('zh-Hant').includes(normalizedQuery)).slice(0, 50);
      const status = document.createElement('strong');
      status.className = 'global-search-status';
      status.textContent = hits.length === 50 ? '找到超過 50 筆結果，顯示前 50 筆。' : `找到 ${hits.length} 個頁面區塊。`;
      results.append(status);
      hits.forEach((record) => {
        const article = document.createElement('article');
        article.className = 'global-search-result';
        const heading = document.createElement('h2');
        const link = document.createElement('a');
        link.href = searchHref(record.type, record.item);
        link.textContent = record.title || record.item.id;
        heading.append(link);
        const pageLabel = document.createElement('div');
        pageLabel.className = 'search-page-label';
        pageLabel.textContent = record.type === 'character-details' ? '角色詳細頁' : (searchPageMeta[record.type]?.[0] || '參考資料');
        const description = document.createElement('p');
        description.textContent = snippetFor(record.text, normalizedQuery);
        article.append(heading, pageLabel, description);
        results.append(article);
      });
    } catch (error) {
      results.textContent = '搜尋資料無法載入。直接以 file:// 開啟時，請改用本機靜態伺服器。';
      console.warn(error);
    }
  }

  function initializeGlobalSearch() {
    const form = document.querySelector('[data-global-search]');
    const input = document.querySelector('[data-global-search-input]');
    const results = document.querySelector('[data-global-search-results]');
    if (!form || !input || !results) return;
    form.addEventListener('submit', (event) => { event.preventDefault(); search(input.value.trim()); });
    input.addEventListener('search', () => { if (!input.value) results.hidden = true; });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') results.hidden = true; });
    document.addEventListener('pointerdown', (event) => { if (!form.contains(event.target)) results.hidden = true; });
  }

  function scrollToHashTarget() {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({ block: 'start' });
  }

  async function loadCharacterSidebar() {
    const encyclopediaLink = [...document.querySelectorAll('.sidebar a')].find((link) => link.getAttribute('href')?.endsWith('characters.html'));
    if (!encyclopediaLink || encyclopediaLink.parentElement?.querySelector('[data-character-subnav]')) return;
    try {
      const { characters } = await getCharacterContext();
      const parent = encyclopediaLink.parentElement;
      const currentId = document.querySelector('[data-character-detail-id]')?.dataset.characterDetailId || null;
      const expanded = Boolean(currentId);
      const heading = document.createElement('div');
      heading.className = 'character-nav-heading';
      encyclopediaLink.before(heading);
      heading.append(encyclopediaLink);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-nav-toggle';
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-controls', 'character-detail-navigation');
      button.textContent = expanded ? '收合角色詳細頁' : '展開角色詳細頁';
      heading.append(button);
      const list = document.createElement('ul');
      list.id = 'character-detail-navigation';
      list.className = 'character-detail-navigation';
      list.dataset.characterSubnav = '';
      list.hidden = !expanded;
      [...characters].sort((a, b) => a.nameZhHant.localeCompare(b.nameZhHant, 'zh-Hant')).forEach((character) => {
        const row = document.createElement('li');
        const link = document.createElement('a');
        link.href = characterDetailHref(character.id);
        link.textContent = character.nameZhHant;
        decorateCharacterLink(link, character.id);
        if (character.id === currentId) link.setAttribute('aria-current', 'page');
        row.append(link);
        list.append(row);
      });
      parent.append(list);
      button.addEventListener('click', () => {
        const next = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(next));
        button.textContent = next ? '收合角色詳細頁' : '展開角色詳細頁';
        list.hidden = !next;
      });
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadCharacterDetail() {
    const target = document.querySelector('[data-character-detail-id]');
    if (!target) return;
    const id = target.dataset.characterDetailId;
    try {
      const [context, walkthrough, sources] = await Promise.all([
        getCharacterContext(),
        window.MakenData.loadJson(basePath, 'walkthrough.json'),
        window.MakenData.loadJson(basePath, 'sources.json')
      ]);
      const { characters, details } = context;
      const character = characters.find((item) => item.id === id);
      const detail = details.find((item) => item.id === id);
      if (!character || !detail) throw new Error(`Unknown character detail: ${id}`);
      const sourceMap = new Map(sources.map((source) => [source.id, source]));
      const walkthroughMap = new Map(walkthrough.map((step) => [step.id, step]));
      const pageTitle = document.querySelector('[data-character-page-title]');
      if (pageTitle) pageTitle.textContent = character.title;
      document.title = `${character.nameZhHant}｜角色詳細頁｜魔剣爻離線攻略`;
      target.replaceChildren();

      const overview = document.createElement('div');
      overview.className = 'card character-detail-overview';
      const summary = document.createElement('p');
      summary.className = 'lead';
      summary.textContent = character.summary;
      overview.append(summary, characterImage(character));
      const identity = characterIdentity(character);
      const profile = document.createElement('p');
      profile.className = 'character-profile';
      profile.textContent = character.content;
      overview.append(identity, profile, tagStrip(character), sourceLinks(character, sourceMap));
      target.append(overview);

      if (detail.acquisition) {
        const section = document.createElement('section');
        section.className = 'card character-detail-section';
        const heading = document.createElement('h2');
        heading.textContent = '獲取條件、方式與流程';
        const method = document.createElement('p');
        method.className = 'lead';
        method.textContent = detail.acquisition.method;
        const steps = document.createElement('ol');
        detail.acquisition.steps.forEach((text) => {
          const row = document.createElement('li');
          row.textContent = text;
          steps.append(row);
        });
        const routesHeading = document.createElement('h3');
        routesHeading.textContent = '對應流程節點';
        const routes = document.createElement('ul');
        detail.acquisition.walkthroughIds.forEach((walkthroughId) => {
          const step = walkthroughMap.get(walkthroughId);
          const row = document.createElement('li');
          const link = document.createElement('a');
          link.href = `${basePath}/pages/walkthrough.html#record-${encodeURIComponent(walkthroughId)}`;
          link.textContent = step?.title || walkthroughId;
          row.append(link);
          routes.append(row);
        });
        section.append(heading, method, steps, routesHeading, routes, tagStrip(detail.acquisition), sourceLinks(detail.acquisition, sourceMap));
        target.append(section);
      }

      const prerequisiteDependents = details.filter((candidate) => candidate.prerequisiteCharacterIds.includes(id));
      if (prerequisiteDependents.length) {
        const prerequisiteSection = document.createElement('section');
        prerequisiteSection.className = 'card character-detail-section';
        const prerequisiteHeading = document.createElement('h2');
        prerequisiteHeading.textContent = '需要此角色作為前置的角色';
        const prerequisiteExplanation = document.createElement('p');
        prerequisiteExplanation.textContent = '以下反向列出取得條件中明確把本角色列為直接前置的角色；只表示直接前置，不代表角色位於同一地圖。';
        prerequisiteSection.append(prerequisiteHeading, prerequisiteExplanation);
        const list = document.createElement('ul');
        prerequisiteDependents.forEach((dependentDetail) => {
          const dependentCharacter = characters.find((candidate) => candidate.id === dependentDetail.id);
          const row = document.createElement('li');
          if (dependentCharacter) {
            const link = document.createElement('a');
            link.href = characterDetailHref(dependentCharacter.id);
            link.textContent = dependentCharacter.title;
            decorateCharacterLink(link, dependentCharacter.id);
            row.append(link);
          } else row.textContent = dependentDetail.id;
          list.append(row);
        });
        prerequisiteSection.append(list);
        target.append(prerequisiteSection);
      }

      if (detail.techniques.length) {
        const section = document.createElement('section');
        section.className = 'card character-detail-section';
        const heading = document.createElement('h2');
        heading.textContent = '角色招式與取得同步率';
        const wrapper = document.createElement('div');
        wrapper.className = 'table-scroll';
        const table = document.createElement('table');
        table.className = 'technique-table';
        const caption = document.createElement('caption');
        caption.textContent = `${character.nameZhHant}招式取得率對照`;
        const head = document.createElement('thead');
        const headRow = document.createElement('tr');
        ['招式（日文）', '取得率／同步率', '類型', '指令'].forEach((label) => {
          const cell = document.createElement('th');
          cell.scope = 'col';
          cell.textContent = label;
          headRow.append(cell);
        });
        head.append(headRow);
        const body = document.createElement('tbody');
        detail.techniques.forEach((technique) => {
          const row = document.createElement('tr');
          [technique.nameJa, `${technique.acquisitionRatePercent}%`, technique.typeJa, technique.command || '—'].forEach((text, index) => {
            const cell = document.createElement(index === 0 ? 'th' : 'td');
            if (index === 0) cell.scope = 'row';
            cell.textContent = text;
            row.append(cell);
          });
          body.append(row);
        });
        table.append(caption, head, body);
        wrapper.append(table);
        const layout = document.createElement('div');
        layout.className = 'technique-layout';
        layout.append(wrapper);
        const techniquesWithMedia = detail.techniques.filter((technique) => technique.media.length);
        if (techniquesWithMedia.length) {
          const gallery = document.createElement('aside');
          gallery.className = 'technique-media-gallery';
          gallery.setAttribute('aria-label', `${character.nameZhHant}招式畫面`);
          techniquesWithMedia.forEach((technique) => {
            const figure = document.createElement('figure');
            const mediaHeading = document.createElement('h3');
            mediaHeading.textContent = technique.nameJa;
            const frames = document.createElement('div');
            frames.className = 'technique-media-frames';
            technique.media.forEach((media) => {
              const link = document.createElement('a');
              link.href = media.archiveUrl;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              const image = document.createElement('img');
              image.src = `${basePath}/${media.path}`;
              image.alt = techniqueImageAlt(media, sourceMap);
              image.loading = 'lazy';
              image.decoding = 'async';
              link.append(image);
              frames.append(link);
            });
            figure.append(mediaHeading, frames);
            gallery.append(figure);
          });
          layout.append(gallery);
        }
        section.append(heading, layout);
        detail.techniqueSources.forEach((source) => {
          const citation = document.createElement('p');
          citation.className = 'source-note';
          const link = document.createElement('a');
          link.href = source.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = sourceMap.get(source.sourceId)?.title || '招式資料來源';
          citation.append(link, `｜${source.scope}`);
          section.append(citation);
        });
        section.append(tagStrip(detail), sourceLinks(detail, sourceMap));
        target.append(section);
      }

      const navigation = document.createElement('nav');
      navigation.className = 'character-detail-pager';
      navigation.setAttribute('aria-label', '角色詳細頁導覽');
      const index = characters.findIndex((item) => item.id === id);
      const links = [[characters[(index - 1 + characters.length) % characters.length], '上一位'], [characters[(index + 1) % characters.length], '下一位']];
      links.forEach(([item, label]) => {
        const link = document.createElement('a');
        link.href = characterDetailHref(item.id);
        link.textContent = `${label}：${item.nameZhHant}`;
        decorateCharacterLink(link, item.id);
        navigation.append(link);
      });
      target.append(navigation);
      await linkCharacterMentions(target);
      await linkMapMentions(target);
      requestAnimationFrame(scrollToHashTarget);
    } catch (error) {
      target.replaceChildren();
      console.warn(error);
    }
  }

  async function loadPageContent() {
    if (!contentTarget) return;
    const file = contentTarget.dataset.contentFile;
    try {
      const [items, sources, characters] = await Promise.all([
        window.MakenData.loadJson(basePath, file),
        window.MakenData.loadJson(basePath, 'sources.json'),
        window.MakenData.loadJson(basePath, 'characters.json')
      ]);
      const sourceMap = new Map(sources.map((source) => [source.id, source]));
      const itemMap = new Map(items.map((item) => [item.id, item]));
      const characterMap = new Map(characters.map((character) => [character.id, character]));
      const contentType = file.replace(/\.json$/, '');
      const routeFilter = document.querySelector('[data-route-filter]');
      const statusFilter = document.querySelector('[data-status-filter]');
      const tabList = document.querySelector('[data-character-tabs]');
      const tagList = document.querySelector('[data-character-tag-list]');
      const characterQuery = document.querySelector('[data-character-query]');
      const characterReset = document.querySelector('[data-character-reset]');
      const resultStatus = document.querySelector('[data-character-result-status]');
      let activeGroup = 'all';
      const selectedTags = new Set();
      const routes = new Map();
      items.forEach((item) => {
        if (item.routeId) routes.set(item.routeId, item.routeTitle || item.routeId);
      });
      const populateRoutes = () => {
        if (!routeFilter) return;
        const selected = routeFilter.value;
        routeFilter.replaceChildren();
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = '全部路線';
        routeFilter.append(all);
        [...routes.entries()]
          .sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant'))
          .forEach(([routeId, label]) => {
            const option = document.createElement('option');
            option.value = routeId;
            option.textContent = label;
            routeFilter.append(option);
          });
        routeFilter.value = [...routeFilter.options].some((option) => option.value === selected) ? selected : 'all';
      };
      const setActiveTab = (group) => {
        activeGroup = group;
        let selectedTab = null;
        tabList?.querySelectorAll('[role="tab"]').forEach((tab) => {
          const selected = tab.dataset.characterGroup === group;
          tab.setAttribute('aria-selected', String(selected));
          tab.tabIndex = selected ? 0 : -1;
          if (selected) selectedTab = tab;
        });
        if (selectedTab) contentTarget.setAttribute('aria-labelledby', selectedTab.id);
      };
      const render = () => {
        const route = routeFilter?.value || 'all';
        const status = statusFilter?.value || 'all';
        const query = characterQuery?.value.trim().toLocaleLowerCase('zh-Hant') || '';
        const visible = items.filter((item) => {
          const searchable = [item.title, item.summary, item.content, item.nameZhHant, item.nameJa, item.nameEn, item.role, item.occupation, ...(item.affiliations || []), ...(item.tags || [])]
            .filter(Boolean).join(' ').toLocaleLowerCase('zh-Hant');
          return (route === 'all' || item.routeId === route)
            && (status === 'all' || item.verificationStatus === status)
            && (contentType !== 'characters' || activeGroup === 'all' || item.characterGroup === activeGroup)
            && (contentType !== 'characters' || [...selectedTags].every((tag) => item.tags?.includes(tag)))
            && (contentType !== 'characters' || !query || searchable.includes(query));
        }).sort((a, b) => {
          if (contentType === 'walkthrough' || contentType === 'maps') {
            const sequenceDifference = (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER);
            if (sequenceDifference) return sequenceDifference;
          }
          return a.title.localeCompare(b.title, 'zh-Hant');
        });
        contentTarget.replaceChildren();
        if (resultStatus) resultStatus.textContent = `顯示 ${visible.length}／${items.length} 名角色。`;
        if (!visible.length) {
          contentTarget.textContent = '沒有符合篩選條件的資料。';
          return;
        }
        visible.forEach((item) => contentTarget.append(contentType === 'maps'
          ? renderMapCard(item, sourceMap, itemMap, characterMap)
          : renderContentCard(item, sourceMap, contentType)));
        linkCharacterMentions(contentTarget).then(() => linkMapMentions(contentTarget)).then(() => requestAnimationFrame(scrollToHashTarget));
      };
      if (contentType === 'characters' && tabList) {
        const groupLabels = new Map([['all', '全部'], ['main', '主要角色'], ['fukenshi', '封劍士'], ['hakke', '八卦'], ['hostile', '敵對'], ['npc', 'NPC'], ['other', '其他']]);
        const groups = ['all', 'main', 'fukenshi', 'hakke', 'hostile', 'npc', 'other'].filter((group) => group === 'all' || items.some((item) => item.characterGroup === group));
        tabList.replaceChildren();
        groups.forEach((group, index) => {
          const tab = document.createElement('button');
          const count = group === 'all' ? items.length : items.filter((item) => item.characterGroup === group).length;
          tab.type = 'button';
          tab.setAttribute('role', 'tab');
          tab.id = `character-tab-${group}`;
          tab.dataset.characterGroup = group;
          tab.setAttribute('aria-controls', 'character-results');
          tab.setAttribute('aria-selected', String(index === 0));
          tab.tabIndex = index === 0 ? 0 : -1;
          tab.textContent = `${groupLabels.get(group)} ${count}`;
          tab.addEventListener('click', () => { setActiveTab(group); render(); });
          tabList.append(tab);
        });
        tabList.addEventListener('keydown', (event) => {
          const tabs = [...tabList.querySelectorAll('[role="tab"]')];
          const current = tabs.indexOf(document.activeElement);
          if (current < 0) return;
          let next = current;
          if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = tabs.length - 1;
          else return;
          event.preventDefault();
          tabs[next].click();
          tabs[next].focus();
        });
      }
      if (contentType === 'characters' && tagList) {
        const tags = [...new Set(items.flatMap((item) => item.tags || []))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
        tagList.replaceChildren();
        tags.forEach((tag) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'tag-filter';
          button.dataset.characterTag = tag;
          button.setAttribute('aria-pressed', 'false');
          button.textContent = `#${tag}`;
          button.addEventListener('click', () => {
            if (selectedTags.has(tag)) selectedTags.delete(tag); else selectedTags.add(tag);
            button.setAttribute('aria-pressed', String(selectedTags.has(tag)));
            render();
          });
          tagList.append(button);
        });
      }
      populateRoutes();
      [routeFilter, statusFilter].filter(Boolean).forEach((control) => control.addEventListener('change', render));
      characterQuery?.addEventListener('input', render);
      characterReset?.addEventListener('click', () => {
        selectedTags.clear();
        tagList?.querySelectorAll('[aria-pressed="true"]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
        if (characterQuery) characterQuery.value = '';
        setActiveTab('all');
        render();
      });
      render();
    } catch (error) {
      contentTarget.textContent = '資料無法載入。直接以 file:// 開啟時，請改用本機靜態伺服器。';
      console.warn(error);
    }
  }

  async function loadSourceList() {
    const sourceList = document.querySelector('[data-source-list]');
    if (!sourceList) return;
    try {
      const sources = await window.MakenData.loadJson(basePath, 'sources.json');
      sourceList.replaceChildren();
      sources.filter((source) => source.id !== 'demo-source').forEach((source) => {
        const article = document.createElement('article');
        article.className = 'card';
        article.id = `record-source-${source.id}`;
        const title = document.createElement('h2');
        const link = document.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.title;
        title.append(link);
        const metadata = document.createElement('ul');
        metadata.className = 'metadata';
        metadata.append(badge(`來源層級：${source.sourceLevel}`), badge(`最後查閱：${source.accessedDate}`));
        const description = document.createElement('p');
        description.textContent = source.notes;
        article.append(title, metadata, description);
        sourceList.append(article);
      });
      await linkCharacterMentions(sourceList);
      await linkMapMentions(sourceList);
      requestAnimationFrame(scrollToHashTarget);
    } catch (error) {
      sourceList.textContent = '來源清單無法載入。直接以 file:// 開啟時，請改用本機靜態伺服器。';
      console.warn(error);
    }
  }

  initializeCharacterPreviews();
  initializeMapPreviews();
  initializeGlobalSearch();
  requestAnimationFrame(scrollToHashTarget);
  linkCharacterMentions(document.querySelector('main')).then(() => linkMapMentions(document.querySelector('main')));
  loadCharacterSidebar();
  loadCharacterDetail();
  loadPageContent();
  loadSourceList();
  document.querySelector('[data-back-to-top]')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
