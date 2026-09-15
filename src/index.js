const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const REMOTE_BASE = 'https://stats.pokevagos.com';
const TARGET_URL = `${REMOTE_BASE}/_dash-update-component`;
const ASSET_PREFIX = '/assets/pokemon_icons/';
const ASSET_CACHE_DIR = path.join(__dirname, 'assets', 'pokemon');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function proxyRequest(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const target = new URL(TARGET_URL);
    const proxyReq = https.request(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, proxyRes => {
      let responseBody = '';
      proxyRes.on('data', chunk => { responseBody += chunk; });
      proxyRes.on('end', () => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(responseBody);
      });
    });

    proxyReq.on('error', err => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    proxyReq.write(body);
    proxyReq.end();
  });
}

function assetCachePath(urlPath) {
  return path.join(ASSET_CACHE_DIR, urlPath.slice(ASSET_PREFIX.length));
}

function fetchAndCacheAsset(urlPath, filePath, res) {
  https.get(REMOTE_BASE + urlPath, remoteRes => {
    if (remoteRes.statusCode !== 200) {
      res.writeHead(remoteRes.statusCode || 502);
      res.end('Not found');
      remoteRes.resume();
      return;
    }

    const chunks = [];
    remoteRes.on('data', chunk => chunks.push(chunk));
    remoteRes.on('end', () => {
      const buffer = Buffer.concat(chunks);
      fs.mkdir(path.dirname(filePath), { recursive: true }, () => {
        fs.writeFile(filePath, buffer, () => {});
      });

      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(buffer);
    });
  }).on('error', err => {
    res.writeHead(502);
    res.end('Bad gateway: ' + err.message);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/proxy') {
    proxyRequest(req, res);
    return;
  }

  const urlPath = req.url === '/' ? '/index.html' : req.url;

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
