import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const maxBytes = 512 * 1024;
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' });
      response.end('Method Not Allowed');
      return;
    }
    const pathname = new URL(request.url || '/', `http://${host}:${port}`).pathname;
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['index.html', 'styles.css', 'app.js'].includes(relative)) {
      response.writeHead(404); response.end('Not Found'); return;
    }
    const file = normalize(join(root, relative));
    if (!file.startsWith(root)) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Bad Request');
      return;
    }
    const body = await readFile(file);
    if (body.byteLength > maxBytes) {
      response.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('File Too Large');
      return;
    }
    response.writeHead(200, { 'content-type': contentTypes[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    if (request.method === 'HEAD') response.end(); else response.end(body);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 500;
    response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(status === 404 ? 'Not Found' : 'Internal Server Error');
  }
});

server.listen(port, host, () => console.log(`lab listening on http://${host}:${port}`));
const shutdown = () => { server.close(() => process.exit(0)); server.closeAllConnections(); };
server.requestTimeout = 5000;
server.headersTimeout = 5000;
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
