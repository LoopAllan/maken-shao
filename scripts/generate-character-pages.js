import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const characters = JSON.parse(fs.readFileSync(path.join(root, 'data', 'characters.json'), 'utf8'));
const details = JSON.parse(fs.readFileSync(path.join(root, 'data', 'character-details.json'), 'utf8'));
const outputDirectory = path.join(root, 'pages', 'characters');
const characterIds = new Set(characters.map((character) => character.id));
const detailById = new Map(details.map((detail) => [detail.id, detail]));

for (const detail of details) {
  for (const prerequisiteId of detail.prerequisiteCharacterIds || []) {
    if (prerequisiteId === detail.id) throw new Error(`Character ${detail.id} cannot require itself.`);
    if (!characterIds.has(prerequisiteId)) throw new Error(`Character ${detail.id} has unknown prerequisite character ${prerequisiteId}.`);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function page(character) {
  const name = escapeHtml(character.nameZhHant);
  const id = escapeHtml(character.id);
  return `<!doctype html>
<html lang="zh-Hant" data-base="../..">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${name}的角色介紹、故事背景、人物個性、PS2 日版取得條件與來源。">
  <title>${name}｜角色詳細頁｜Maken Shao Complete Guide</title>
  <link rel="stylesheet" href="../../assets/css/style.css">
</head>
<body>
  <a class="skip-link" href="#main-content">跳至主要內容</a>
  <header class="site-header"><button class="menu-button" type="button" data-menu-toggle aria-controls="site-nav" aria-expanded="false">選單</button><a class="brand" href="../../index.html">Maken Shao Complete Guide</a><form class="global-search" role="search" data-global-search><label class="visually-hidden" for="global-search-input">全站搜尋</label><input id="global-search-input" data-global-search-input type="search" placeholder="搜尋攻略、角色、地圖…" autocomplete="off"><button type="submit" class="global-search-submit">搜尋</button><div class="global-search-results" data-global-search-results aria-live="polite" hidden></div></form><div class="header-actions"><button class="icon-button" type="button" data-theme-toggle aria-label="切換深色模式">◐</button></div></header>
  <div class="layout">
    <nav class="sidebar" id="site-nav" aria-label="主要導覽"><h2>目錄</h2><ul><li><a href="../../index.html">首頁</a></li><li><a href="../introduction.html">遊戲介紹</a></li><li><a href="../systems.html">系統</a></li><li><a href="../walkthrough.html">流程攻略</a></li><li><a href="../characters.html" aria-current="location">角色圖鑑</a></li><li><a href="../maps.html">地圖圖鑑</a></li><li><a href="../knowledge.html">Knowledge</a></li><li><a href="../endings.html">結局</a></li><li><a href="../references.html">參考資料</a></li></ul></nav>
    <main id="main-content">
      <nav class="breadcrumbs" aria-label="麵包屑"><a href="../../index.html">首頁</a><span aria-hidden="true">›</span><a href="../characters.html">角色圖鑑</a><span aria-hidden="true">›</span><span>${name}</span></nav>
      <p class="eyebrow">完整人物檔案｜混合版本資料附來源界線</p>
      <h1 data-character-page-title>${name}</h1>
      <div class="character-detail" data-character-detail-id="${id}"><p>正在載入角色資料…</p></div>
    </main>
  </div>
  <button class="back-to-top" type="button" data-back-to-top aria-label="返回頁面頂端">↑ 頂端</button>
  <footer class="site-footer">完整角色介紹與故事背景｜混合版本資料附 Fandom revision；PS2 日版取得流程另附攻略來源。</footer>
  <script defer src="../../assets/js/data-loader.js"></script><script defer src="../../assets/js/validator.js"></script><script defer src="../../assets/js/character-links.js"></script><script defer src="../../assets/js/map-links.js"></script><script defer src="../../assets/js/app.js"></script>
</body>
</html>
`;
}

fs.mkdirSync(outputDirectory, { recursive: true });
const expected = new Set();
for (const character of characters) {
  if (!detailById.has(character.id)) throw new Error(`Missing character detail for ${character.id}.`);
  const fileName = `${character.id}.html`;
  expected.add(fileName);
  fs.writeFileSync(path.join(outputDirectory, fileName), page(character));
}
for (const entry of fs.readdirSync(outputDirectory)) {
  if (entry.endsWith('.html') && !expected.has(entry)) fs.unlinkSync(path.join(outputDirectory, entry));
}
console.log(`Generated ${characters.length} character detail pages.`);
