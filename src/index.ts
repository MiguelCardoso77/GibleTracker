import http from 'http';
import fs from 'fs';
import path from 'path';
import { transform } from 'esbuild';

const PORT = 3000;
const REMOTE_BASE = 'https://stats.pokevagos.com';
const TARGET_URL = `${REMOTE_BASE}/_dash-update-component`;
const ASSET_PREFIX = '/assets/pokemon_icons/';
const ASSET_CACHE_DIR = path.join(__dirname, 'assets', 'pokemon');

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function proxyRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    try {
      const proxyRes = await fetch(TARGET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      const responseBody = await proxyRes.text();
      res.writeHead(proxyRes.status, { 'Content-Type': 'application/json' });
      res.end(responseBody);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });
}

function serveScript(res: http.ServerResponse): void {
  fs.readFile(path.join(__dirname, 'script.ts'), 'utf8', (err, source) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    transform(source, { loader: 'ts', target: 'es2020' })
      .then(result => {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        res.end(result.code);
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Transform error: ' + err.message);
      });
  });
}

function assetCachePath(urlPath: string): string {
  return path.join(ASSET_CACHE_DIR, urlPath.slice(ASSET_PREFIX.length));
}

async function fetchAndCacheAsset(urlPath: string, filePath: string, res: http.ServerResponse): Promise<void> {
  try {
    const remoteRes = await fetch(REMOTE_BASE + urlPath);
    if (!remoteRes.ok) {
      res.writeHead(remoteRes.status || 502);
      res.end('Not found');
      return;
    }

    const buffer = Buffer.from(await remoteRes.arrayBuffer());
    fs.mkdir(path.dirname(filePath), { recursive: true }, () => {
      fs.writeFile(filePath, buffer, () => {});
    });

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buffer);
  } catch (err) {
    res.writeHead(502);
    res.end('Bad gateway: ' + (err as Error).message);
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/proxy') {
    proxyRequest(req, res);
    return;
  }

  const urlPath = req.url === '/' ? '/index.html' : (req.url ?? '/index.html');

  if (req.method === 'GET' && urlPath === '/script.js') {
    serveScript(res);
    return;
  }

  // cache-on-demand: pokemon icons aren't shipped with the repo, so fetch
  // once from pokevagos and save locally (under assets/pokemon/) for every request after
  if (req.method === 'GET' && urlPath.startsWith(ASSET_PREFIX) && !urlPath.includes('..')) {
    const cachePath = assetCachePath(urlPath);
    fs.readFile(cachePath, (err, content) => {
      if (err) {
        fetchAndCacheAsset(urlPath, cachePath, res);
        return;
      }
      const ext = path.extname(cachePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(content);
    });
    return;
  }

  const filePath = path.join(__dirname, urlPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`GibleTracker a correr em http://localhost:${PORT}`);
});
