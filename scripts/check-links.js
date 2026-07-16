import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function files(directory) { return fs.readdirSync(directory,{withFileTypes:true}).flatMap((entry) => entry.isDirectory() ? files(path.join(directory,entry.name)) : [path.join(directory,entry.name)]); }
const htmlFiles = files(root).filter((file) => file.endsWith('.html'));
const errors=[];
for (const file of htmlFiles) {
  const html=fs.readFileSync(file,'utf8');
  if (!/<html[^>]*lang=["']zh-Hant["']/i.test(html)) errors.push(`${path.relative(root,file)}: missing zh-Hant html language`);
  if (!/<main[\s>]/i.test(html)) errors.push(`${path.relative(root,file)}: missing main landmark`);
  if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${path.relative(root,file)}: missing title`);
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const target=match[1]; if (/^(#|https?:|mailto:|data:)/.test(target)) continue;
    const diskPath=path.resolve(path.dirname(file),target.split('#')[0]);
    if (!fs.existsSync(diskPath)) errors.push(`${path.relative(root,file)}: broken local reference ${target}`);
  }
}
if (errors.length) { console.error(`Link/HTML check failed (${errors.length} error(s)):`); errors.forEach((error)=>console.error(`- ${error}`)); process.exitCode=1; }
else console.log(`Link/HTML check passed: ${htmlFiles.length} HTML files checked.`);
