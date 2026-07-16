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

  document.querySelectorAll('[data-spoiler-toggle]').forEach((button) => button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.spoilerToggle);
    if (!target) return;
    const hidden = target.hidden;
    target.hidden = !hidden;
    button.setAttribute('aria-expanded', String(hidden));
    button.textContent = hidden ? '收合劇透內容' : '展開劇透內容';
  }));

  function badge(text) {
    const item = document.createElement('li');
    item.className = 'badge';
    item.textContent = text;
    return item;
  }

  function sourceLinks(item, sourceMap, isMajor) {
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
      link.textContent = isMajor && source.sourceLevel === 'community' ? `社群流程來源 ${index + 1}` : source.title;
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
    note.textContent = item.nameEnStatus === 'official'
      ? '英文名：官方角色圖可讀的拉丁字樣。'
      : '英文名：依日文名整理的羅馬字／英文字形，並非已查得的官方英語在地化名稱。';
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
    caption.textContent = '圖像：Atlus《魔剣爻》官方角色介紹保存頁；僅作本離線資料庫的來源識別與引用。';
    figure.append(image, caption);
    return figure;
  }

  function renderContentCard(item, sourceMap) {
    const article = document.createElement('article');
    article.className = 'card';
    const isMajor = item.spoilerLevel === 'major';
    const isMinor = item.spoilerLevel === 'minor';
    const title = document.createElement(isMajor ? 'h3' : 'h2');
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
    if (item.characterType) meta.append(badge(`角色類型：${item.characterType}`));
    if (item.brainJackStatus) meta.append(badge(`Brain Jack：${item.brainJackStatus}`));
    if (Array.isArray(item.affiliations) && item.affiliations.length) meta.append(badge(`所屬：${item.affiliations.join('、')}`));
    if (Number.isInteger(item.sequence)) meta.prepend(badge(`順序：${item.sequence}`));
    if (item.area) meta.append(badge(`區域：${item.area}`));
    if (item.routeId) meta.append(badge(`路線：${item.routeTitle || item.routeId}`));
    if (item.missable === true) meta.append(badge('可錯過'));

    const details = document.createElement('details');
    details.className = 'spoiler-content';
    if (!isMajor) details.open = true;
    const control = document.createElement('summary');
    control.textContent = isMajor ? '展開角色細節與查證資料（重大劇透）' : (isMinor ? '展開角色細節與查證資料（輕微劇透）' : '收合角色細節與查證資料');
    const body = document.createElement('div');
    body.className = 'card-detail-body';
    body.append(summary, characterImage(item));
    if (item.nameJa && item.nameZhHant && item.nameEn) {
      const { identity, note } = characterIdentity(item);
      body.append(identity, note);
    }
    body.append(content, meta, sourceLinks(item, sourceMap, isMajor));
    if (item.verificationNote) {
      const verification = document.createElement('p');
      verification.className = 'verification-note';
      verification.textContent = `查證註記：${item.verificationNote}`;
      body.append(verification);
    }
    details.append(control, body);
    article.append(title, details);
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
        if (item.spoiler === true) {
          heading.textContent = `[${type}｜${item.gameVersion}] 劇透結果（標題已隱藏）`;
          description.textContent = '此結果包含劇透；標題、摘要與內容已隱藏，請至對應頁面主動展開。';
        } else {
          heading.textContent = `[${type}｜${item.gameVersion}] ${item.title}`;
          description.textContent = item.summary;
        }
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
      const routeFilter = document.querySelector('[data-route-filter]');
      const spoilerRouteToggle = document.querySelector('[data-spoiler-route-toggle]');
      const statusFilter = document.querySelector('[data-status-filter]');
      const characterTypeFilter = document.querySelector('[data-character-type-filter]');
      const brainJackFilter = document.querySelector('[data-brain-jack-filter]');
      const routes = new Map();
      items.forEach((item) => {
        if (!item.routeId) return;
        const current = routes.get(item.routeId);
        routes.set(item.routeId, { label: item.routeTitle || item.routeId, isMajor: (current?.isMajor ?? true) && item.spoilerLevel === 'major' });
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
          .filter(([, route]) => spoilerRouteToggle?.checked || !route.isMajor)
          .sort((a, b) => a[1].label.localeCompare(b[1].label, 'zh-Hant'))
          .forEach(([routeId, route]) => {
            const option = document.createElement('option');
            option.value = routeId;
            option.textContent = route.label;
            routeFilter.append(option);
          });
        routeFilter.value = [...routeFilter.options].some((option) => option.value === selected) ? selected : 'all';
      };
      const render = () => {
        const route = routeFilter?.value || 'all';
        const status = statusFilter?.value || 'all';
        const characterType = characterTypeFilter?.value || 'all';
        const brainJackStatus = brainJackFilter?.value || 'all';
        const visible = items.filter((item) => (
          (route === 'all' || item.routeId === route)
          && (status === 'all' || item.verificationStatus === status)
          && (characterType === 'all' || item.characterType === characterType)
          && (brainJackStatus === 'all' || item.brainJackStatus === brainJackStatus)
        )).sort((a, b) => a.title.localeCompare(b.title, 'zh-Hant'));
        contentTarget.replaceChildren();
        if (!visible.length) {
          contentTarget.textContent = '沒有符合篩選條件的資料。';
          return;
        }
        visible.forEach((item) => contentTarget.append(renderContentCard(item, sourceMap)));
      };
      populateRoutes();
      [routeFilter, spoilerRouteToggle, statusFilter, characterTypeFilter, brainJackFilter]
        .filter(Boolean)
        .forEach((control) => control.addEventListener('change', () => {
          if (control === spoilerRouteToggle) populateRoutes();
          render();
        }));
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
      sources.filter((source) => source.id !== 'demo-source').forEach((source, index) => {
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
        if (source.sourceLevel === 'community') {
          const hiddenTitle = document.createElement('h2');
          hiddenTitle.textContent = `社群流程來源 ${index + 1}（書目資訊已隱藏）`;
          const disclosure = document.createElement('details');
          const control = document.createElement('summary');
          control.textContent = '展開可能包含流程劇透的來源名稱與說明';
          disclosure.append(control, title, metadata, description);
          article.append(hiddenTitle, disclosure);
        } else {
          article.append(title, metadata, description);
        }
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
