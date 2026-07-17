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
    article.dataset.recordId = item.id;
    const isCharacter = contentType === 'characters';
    if (isCharacter && item.characterGroup) article.dataset.characterGroup = item.characterGroup;
    const title = document.createElement('h2');
    title.textContent = item.title;
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
        row.textContent = target ? `${target.nameZhHant}｜${target.nameEn}` : id;
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
    } catch (error) {
      results.textContent = '資料無法載入。直接以 file:// 開啟時，請改用本機靜態伺服器。';
      console.warn(error);
    }
  }

  document.querySelector('[data-search-submit]')?.addEventListener('click', search);
  document.querySelector('[data-search-input]')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') search();
  });

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
    } catch (error) {
      sourceList.textContent = '來源清單無法載入。直接以 file:// 開啟時，請改用本機靜態伺服器。';
      console.warn(error);
    }
  }

  loadPageContent();
  loadSourceList();
  document.querySelector('[data-back-to-top]')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
