import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['.git', 'node_modules'].includes(entry.name)) return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(target);
    return entry.isFile() && entry.name.endsWith('.html') ? [target] : [];
  });
}

let changed = 0;
for (const file of htmlFiles(root)) {
  let html = fs.readFileSync(file, 'utf8');
  const original = html;
  const base = html.match(/<html[^>]+data-base="([^"]+)"/)?.[1];
  if (!base) throw new Error(`${path.relative(root, file)}: missing html[data-base]`);

  if (!/>地圖圖鑑<\/a>/.test(html)) {
    const characterItem = /(<li><a href="[^"]*characters\.html"[^>]*>角色圖鑑<\/a><\/li>)/;
    if (!characterItem.test(html)) throw new Error(`${path.relative(root, file)}: missing character navigation item`);
    const mapHref = `${base}/pages/maps.html`;
    html = html.replace(characterItem, `$1<li><a href="${mapHref}">地圖圖鑑</a></li>`);
  }

  if (!/map-links\.js/.test(html)) {
    const appScript = /(<script defer src="([^"]*)app\.js"><\/script>)/;
    const match = html.match(appScript);
    if (!match) throw new Error(`${path.relative(root, file)}: missing app.js script`);
    html = html.replace(appScript, `<script defer src="${match[2]}map-links.js"></script>$1`);
  }

  if (!/data-global-search/.test(html)) {
    const headerSearch = `<form class="global-search" role="search" data-global-search><label class="visually-hidden" for="global-search-input">全站搜尋</label><input id="global-search-input" data-global-search-input type="search" placeholder="搜尋攻略、角色、地圖…" autocomplete="off"><button type="submit" class="global-search-submit">搜尋</button><div class="global-search-results" data-global-search-results aria-live="polite" hidden></div></form>`;
    const headerAnchor = /(<a class="brand"[^>]*>Maken Shao Complete Guide<\/a>)(<div class="header-actions">)/;
    if (!headerAnchor.test(html)) throw new Error(`${path.relative(root, file)}: missing standard header brand`);
    html = html.replace(headerAnchor, `$1${headerSearch}$2`);
  }

  if (file === path.join(root, 'index.html')) {
    html = html.replace(/<section class="search-panel"[\s\S]*?<\/section>/, '');
  }

  if (html !== original) {
    fs.writeFileSync(file, html);
    changed += 1;
  }
}
console.log(`Updated ${changed} HTML shell(s).`);
