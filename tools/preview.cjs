// Local-only static preview. No deployment or filesystem writes.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = fs.realpathSync(path.resolve(__dirname, '../dist'));
const port = Number(process.argv[2] || 4174);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('Use a port between 1024 and 65535.');
  process.exit(1);
}
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.cif':'text/plain', '.txt':'text/plain', '.woff2':'font/woff2'};
const inside = p => {const rel = path.relative(root, p); return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);};
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {res.writeHead(405);res.end();return;}
  let file;
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!inside(file)) throw new Error('Outside root');
    file = fs.realpathSync(file);
    if (!inside(file) || !fs.statSync(file).isFile()) throw new Error('Not a file');
  } catch {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(file, (err, data) => {
    if (err) {res.writeHead(500);res.end('Cannot read file');return;}
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.on('error', err => {console.error('Preview failed:', err.message);process.exitCode = 1;});
server.listen(port, '127.0.0.1', () => console.log(`BioLens local preview: http://127.0.0.1:${port}/ (Ctrl+C to stop)`));
