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

  if (html !== original) {
    fs.writeFileSync(file, html);
    changed += 1;
  }
}
console.log(`Updated ${changed} HTML shell(s).`);
