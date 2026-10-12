import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../dist/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') { res.writeHead(302, { Location: '/preview/' }).end(); return; }
  if (!url.pathname.startsWith('/preview/')) { res.writeHead(404).end(); return; }
  const relative = decodeURIComponent(url.pathname.slice('/preview/'.length)) || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body); }
  catch { res.writeHead(404).end('Not found'); }
});
const port = Number(process.env.HIVE_PREVIEW_PORT ?? 4173);
server.listen(port, '127.0.0.1', () => console.log(`Static export: http://127.0.0.1:${port}/preview/`));
process.on('SIGTERM', () => server.close());
