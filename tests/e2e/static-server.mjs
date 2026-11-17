// Tiny static server for the exported site, with Firebase-Hosting-style clean URLs (/app/exam -> /app/exam.html). Local tests only.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
const root = join(process.cwd(), process.argv[2] ?? 'apps/web/.next-mock'); const port = Number(process.argv[3] ?? 3100);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.map': 'application/json' };

const fileMap = new Map();
async function buildMap(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      await buildMap(full);
    } else {
      const rel = relative(root, full).split(sep).join('/');
      fileMap.set('/' + rel, full);
      fileMap.set(rel, full);
      if (rel.endsWith('.html')) {
        const clean = rel.slice(0, -5);
        fileMap.set('/' + clean, full);
        fileMap.set(clean, full);
        if (clean === 'index' || clean.endsWith('/index')) {
          const rootSlash = clean === 'index' ? '/' : '/' + clean.slice(0, -6);
          fileMap.set(rootSlash, full);
          fileMap.set(rootSlash.slice(1), full);
        }
      }
      const ni = rel.indexOf('__next');
      if (ni !== -1) {
        const pre = rel.slice(0, ni);
        const post = rel.slice(ni).split('/').join('.');
        fileMap.set('/' + pre + post, full);
        fileMap.set(pre + post, full);
      }
    }
  }
}

await buildMap(root);

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = fileMap.get(pathname) ?? fileMap.get(pathname.replace(/\/$/, '')) ?? fileMap.get(pathname + '/index.html') ?? fileMap.get(pathname + '.html');
  const status = file ? 200 : 404; file ??= fileMap.get('/404.html') ?? join(root, '404.html');
  try { const body = await readFile(file); res.writeHead(status, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`static ${root} on http://127.0.0.1:${port}`));
