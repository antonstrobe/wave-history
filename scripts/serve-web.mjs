import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('web-dist');
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
    response.setHeader('Content-Type', mime[path.extname(file)] || 'text/plain; charset=utf-8');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end('Not found'); }
});
server.listen(8077, '127.0.0.1', () => console.log('Wave History: http://127.0.0.1:8077/'));
