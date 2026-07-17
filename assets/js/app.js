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

  function badge(text) {
    const item = document.createElement('li');
    item.className = 'badge';
    item.textContent = text;
    return item;
  }

  function sourceLinks(item, sourceMap) {
    const sources = document.createElement('p');
    sources.append('來源：');
    item.sourceIds.forEach((id, index) => {
      const source = sourceMap.get(id);
      if (index) sources.append('；');
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
    const note = document.createElement('p');
    note.className = 'name-source-note';
    const nameNotes = {
      official: '英文名：官方角色圖可讀的拉丁字樣。',
      romanized: '英文名：依日文名整理的羅馬字／英文字形，並非已查得的官方英語在地化名稱。',
      community: '英文名：MegaTen Wiki 社群頁名；不是已查得的 PS2 日版官方英文名。'
    };
    note.textContent = nameNotes[item.nameEnStatus] || nameNotes.community;
    return { identity, note };
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
    image.alt = item.imageAlt || `${item.nameZhHant}（${item.nameJa}）角色圖`;
    image.loading = 'lazy';
    image.decoding = 'async';
    const caption = document.createElement('figcaption');
    if (item.imageKind === 'official-source') {
      caption.append('圖像：Atlus《魔剣爻》官方角色介紹保存頁；© ATLUS，僅作本離線資料庫的來源識別與引用。');
    } else {
      caption.append('圖像：MegaTen Wiki / Fandom 角色頁的本地縮圖；本站不主張圖像著作權或自由再散布授權。');
    }
    const assetUrl = item.imageFilePageUrl || item.imageOriginalUrl;
    if (assetUrl) {
      caption.append(' ');
      const sourceAsset = document.createElement('a');
      sourceAsset.href = assetUrl;
      sourceAsset.target = '_blank';
      sourceAsset.rel = 'noopener noreferrer';
      sourceAsset.textContent = item.imageFilePageUrl ? '圖片檔案頁與來源資訊' : '原始圖片資產';
      caption.append(sourceAsset);
    }
    if (item.imageUploader || item.imageUploadedAt) caption.append(` 上傳記錄：${item.imageUploader || '未列'}／${item.imageUploadedAt || '未列'}。`);
    if (item.imageSourceMime && item.imageSourceWidth && item.imageSourceHeight && item.imageSourceBytes) caption.append(` Wiki 原始資產：${item.imageSourceMime}、${item.imageSourceWidth}×${item.imageSourceHeight}、${item.imageSourceBytes.toLocaleString('zh-Hant')} bytes；本站下載縮圖：${item.imageLocalMime || '格式未列'}。`);
    if (item.imageSourceVerification) caption.append(` 原始資產驗證：${item.imageSourceVerification}。`);
    if (item.imageVersionNote) caption.append(` 版本註記：${item.imageVersionNote}`);
    if (item.imageRightsNote) caption.append(` 權利註記：${item.imageRightsNote}`);
    figure.append(image, caption);
    return figure;
  }

  function renderContentCard(item, sourceMap, contentType, itemMap) {
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
    if (Array.isArray(item.tags)) item.tags.forEach((tag) => meta.append(badge(`#${tag}`)));
    if (Number.isInteger(item.sequence)) meta.prepend(badge(`順序：${item.sequence}`));
    if (item.area) meta.append(badge(`區域：${item.area}`));
    if (item.routeId) meta.append(badge(`路線：${item.routeTitle || item.routeId}`));
    if (item.missable === true) meta.append(badge('可錯過'));

    article.append(title, summary);
    if (isCharacter) article.append(characterImage(item));
    if (isCharacter && item.nameJa && item.nameZhHant && item.nameEn) {
      const { identity, note } = characterIdentity(item);
      article.append(identity, note);
    }
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
    if (isCharacter && Array.isArray(item.wikiLinkedCharacterIds) && item.wikiLinkedCharacterIds.length) {
      const heading = document.createElement('h3');
      heading.textContent = 'Wiki 內文明示連結角色';
      const list = document.createElement('ul');
      item.wikiLinkedCharacterIds.forEach((id) => {
        const target = itemMap?.get(id);
        const row = document.createElement('li');
        if (target) {
          const link = document.createElement('a');
          link.href = characterDetailHref(target.id);
          link.textContent = `${target.nameZhHant}｜${target.nameEn}`;
          decorateCharacterLink(link, target.id);
          row.append(link);
        } else row.textContent = id;
        list.append(row);
      });
      article.append(heading, list);
    }
    if (isCharacter && Array.isArray(item.communityReferences) && item.communityReferences.length) {
      const heading = document.createElement('h3');
      heading.textContent = '角色頁交叉參考';
      const list = document.createElement('ul');
      list.className = 'community-reference-list';
      item.communityReferences.forEach((reference) => {
        const row = document.createElement('li');
        const link = document.createElement('a');
        link.href = reference.pageUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `${reference.pageTitle}（revision ${reference.revisionId}）`;
        row.append(link, `；查閱 ${reference.accessedDate}。${reference.note}`);
        list.append(row);
      });
      article.append(heading, list);
    }
    article.append(sourceLinks(item, sourceMap));
    if (item.verificationNote) {
      const verification = document.createElement('p');
      verification.className = 'verification-note';
      verification.textContent = `查證註記：${item.verificationNote}`;
      article.append(verification);
    }
    return article;
  }

  async function search() {
    const searchInput = document.querySelector('[data-search-input]');
    const results = document.querySelector('[data-search-results]');
    if (!searchInput || !results) return;
    const query = searchInput.value.trim().toLocaleLowerCase('zh-Hant');
    results.replaceChildren();
    if (!query) {
      results.textContent = '請輸入關鍵字。';
      return;
    }
    try {
      const data = await window.MakenData.loadAllContent(basePath);
      const hits = Object.entries(data).flatMap(([type, items]) => items
        .filter((item) => `${item.title} ${item.summary} ${item.content} ${item.nameZhHant || ''} ${item.nameJa || ''} ${item.nameEn || ''}`.toLocaleLowerCase('zh-Hant').includes(query))
        .map((item) => [type, item]));
      results.textContent = `找到 ${hits.length} 筆結果。`;
      hits.forEach(([type, item]) => {
        const article = document.createElement('article');
        article.className = 'card';
        const heading = document.createElement('h3');
        const description = document.createElement('p');
        heading.textContent = `[${type}｜${item.gameVersion}] ${item.title}`;
        description.textContent = item.summary;
        article.append(heading, description);
        results.append(article);
      });
      await linkCharacterMentions(results);
    } catch (error) {
      results.textContent = '資料無法載入。直接以 file:// 開啟時，請改用本機靜態伺服器。';
      console.warn(error);
    }
  }

  document.querySelector('[data-search-submit]')?.addEventListener('click', search);
  document.querySelector('[data-search-input]')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') search();
  });

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
      const { identity, note } = characterIdentity(character);
      overview.append(identity, note);
      const profile = document.createElement('p');
      profile.textContent = character.content;
      overview.append(profile, sourceLinks(character, sourceMap));
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
        section.append(heading, method, steps, routesHeading, routes, sourceLinks(detail.acquisition, sourceMap));
        target.append(section);
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
              image.alt = media.alt;
              image.loading = 'lazy';
              image.decoding = 'async';
              link.append(image);
              frames.append(link);
            });
            const caption = document.createElement('figcaption');
            const media = technique.media[0];
            const appendProvenanceLink = (label, url) => {
              const line = document.createElement('div');
              line.append(`${label}：`);
              const link = document.createElement('a');
              link.href = url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.textContent = url;
              line.append(link);
              caption.append(line);
            };
            const sourceTitle = document.createElement('div');
            const source = document.createElement('a');
            source.href = media.sourcePageUrl;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            source.textContent = sourceMap.get(media.sourceId)?.title || '招式畫面來源';
            sourceTitle.append('來源關聯：', source, `（${media.kind}）`);
            caption.append(sourceTitle);
            appendProvenanceLink('來源頁', media.sourcePageUrl);
            appendProvenanceLink('原始資產 URL', media.originalUrl);
            appendProvenanceLink('Wayback 保存資產 URL', media.archiveUrl);
            const integrity = document.createElement('div');
            integrity.textContent = `Wayback 保存檔案：${media.archiveBytes.toLocaleString('en-US')} bytes｜SHA-256：${media.sha256}`;
            const rights = document.createElement('div');
            rights.textContent = `權利註記：${media.rightsNote}`;
            caption.append(integrity, rights);
            figure.append(mediaHeading, frames, caption);
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
    } catch (error) {
      target.replaceChildren();
      console.warn(error);
    }
  }

  async function loadPageContent() {
    if (!contentTarget) return;
    const file = contentTarget.dataset.contentFile;
    try {
      const [items, sources] = await Promise.all([
        window.MakenData.loadJson(basePath, file),
        window.MakenData.loadJson(basePath, 'sources.json')
      ]);
      const sourceMap = new Map(sources.map((source) => [source.id, source]));
      const itemMap = new Map(items.map((item) => [item.id, item]));
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
          if (contentType === 'walkthrough') {
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
        visible.forEach((item) => contentTarget.append(renderContentCard(item, sourceMap, contentType, itemMap)));
        linkCharacterMentions(contentTarget);
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
    } catch (error) {
      sourceList.textContent = '來源清單無法載入。直接以 file:// 開啟時，請改用本機靜態伺服器。';
      console.warn(error);
    }
  }

  initializeCharacterPreviews();
  linkCharacterMentions(document.querySelector('main'));
  loadCharacterSidebar();
  loadCharacterDetail();
  loadPageContent();
  loadSourceList();
  document.querySelector('[data-back-to-top]')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
