// Source inventory only: candidates include comments; runtime review is separate.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const rows = [];
for (const name of fs.readdirSync(path.join(root, 'dist')).sort()) {
  if (!/\.(html|js|json|css)$/.test(name)) continue;
  fs.readFileSync(path.join(root, 'dist', name), 'utf8').split(/\r?\n/).forEach((text, i) => {
    if (/[\u3400-\u9fff]/.test(text)) rows.push({file: `dist/${name}`, line: i + 1, text, status: 'needs-review'});
  });
}
fs.writeFileSync(path.join(root, 'CONTENT_CANDIDATES.json'), JSON.stringify(rows, null, 2) + '\n');
console.log(`${rows.length} Chinese-containing source lines indexed; not a runtime coverage count.`);
