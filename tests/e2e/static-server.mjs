// Tiny static server for the exported site, with Firebase-Hosting-style clean URLs (/app/exam -> /app/exam.html). Local tests only.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = join(process.cwd(), process.argv[2] ?? 'apps/web/out-mock'); const port = Number(process.argv[3] ?? 3100);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.map': 'application/json' };
const exists = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const cands = [join(root, path), join(root, path + '.html'), join(root, path, 'index.html')];
  let file = null; for (const c of cands) if (c.startsWith(root) && (await exists(c))) { file = c; break; }
  const status = file ? 200 : 404; file ??= join(root, '404.html');
  try { const body = await readFile(file); res.writeHead(status, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`static ${root} on http://127.0.0.1:${port}`));
