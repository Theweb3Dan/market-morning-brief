/* Market Morning Brief — server.
   - Serves the static app from /public
   - Proxies CoinMarketCap server-side so the API key NEVER reaches the
     browser or the public repo (hackathon rules count a committed/leaked
     key against code quality).
   - Aggregates 7 CMC endpoints into one normalized payload at /api/brief-data
   - Falls back to clearly-labelled demo data when no key is configured or
     an endpoint fails, so the demo always works. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- tiny .env loader (no dependencies) ---
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envFile.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (_) { /* no .env is fine — demo mode */ }

const PORT = process.env.PORT || 4173;
const API_KEY = process.env.CMC_API_KEY || '';
const CMC = 'https://pro-api.coinmarketcap.com';
const demoData = require('./lib/demo-data.json');

const ENDPOINTS = [
  { key: 'mood', path: '/v3/fear-and-greed/latest', cacheMs: 15 * 60 * 1000 },
  { key: 'altseason', path: '/v1/altcoin-season-index/latest', cacheMs: 15 * 60 * 1000 },
  { key: 'global', path: '/v1/global-metrics/quotes/latest', cacheMs: 5 * 60 * 1000 },
  { key: 'gainersLosers', path: '/v1/cryptocurrency/trending/gainers-losers?time_period=24h', cacheMs: 10 * 60 * 1000 },
  { key: 'trending', path: '/v1/cryptocurrency/trending/latest', cacheMs: 10 * 60 * 1000 },
  { key: 'quotes', path: '/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL', cacheMs: 60 * 1000 },
  { key: 'listings', path: '/v1/cryptocurrency/listings/latest?limit=20&sort=market_cap', cacheMs: 60 * 1000 },
];
const cache = new Map();

async function cmcFetch(ep) {
  const hit = cache.get(ep.key);
  if (hit && Date.now() - hit.at < ep.cacheMs) return { data: hit.data, status: 'live (cached)' };
  const res = await fetch(CMC + ep.path, {
    headers: { 'X-CMC_PRO_API_KEY': API_KEY, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(ep.path + ' -> HTTP ' + res.status);
  const json = await res.json();
  cache.set(ep.key, { at: Date.now(), data: json });
  return { data: json, status: 'live' };
}

function usdQuote(obj) {
  if (!obj) return {};
  const q = obj.quote;
  if (Array.isArray(q)) return q.find((x) => x.symbol === 'USD') || q[0] || {};
  if (q && q.USD) return q.USD;
  return {};
}
function coinRow(c) {
  const q = usdQuote(c);
  return {
    name: c.name, symbol: c.symbol, price: q.price != null ? q.price : c.price,
    percentChange1h: q.percent_change_1h, percentChange24h: q.percent_change_24h,
    percentChange7d: q.percent_change_7d, marketCap: q.market_cap != null ? q.market_cap : c.market_cap,
  };
}
function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return Object.values(data).flatMap((v) => (Array.isArray(v) ? v : [v]));
  return [];
}

function normalize(raw) {
  const out = JSON.parse(JSON.stringify(demoData));
  out.source = 'live';
  out.fetchedAt = new Date().toISOString();
  out.evidence = [];
  for (const ep of ENDPOINTS) {
    const r = raw[ep.key];
    if (!r) { out.evidence.push({ endpoint: ep.path, status: 'unavailable — demo fallback for this section' }); continue; }
    out.evidence.push({ endpoint: ep.path, status: r.status, sample: JSON.stringify(r.data).slice(0, 400) });
    const d = r.data.data;
    try {
      if (ep.key === 'mood') out.mood = { value: d.value != null ? d.value : d[0] && d[0].value, label: d.value_classification || (d[0] && d[0].value_classification) || out.mood.label };
      if (ep.key === 'altseason') out.regime.altcoinSeasonIndex = d.value != null ? d.value : out.regime.altcoinSeasonIndex;
      if (ep.key === 'global') { const q = usdQuote(d); out.regime.totalMarketCap = q.total_market_cap; out.regime.totalVolume24h = q.total_volume_24h; out.regime.btcDominance = d.btc_dominance; }
      if (ep.key === 'gainersLosers') {
        const rows = asArray(d).map(coinRow).filter((c) => c.percentChange24h != null);
        out.gainers = rows.filter((c) => c.percentChange24h > 0).sort((a, b) => b.percentChange24h - a.percentChange24h).slice(0, 5);
        out.losers = rows.filter((c) => c.percentChange24h < 0).sort((a, b) => a.percentChange24h - b.percentChange24h).slice(0, 5);
      }
      if (ep.key === 'trending') out.trending = asArray(d).slice(0, 10).map((c) => ({ name: c.name, symbol: c.symbol }));
      if (ep.key === 'quotes') out.watchlist = asArray(d).map(coinRow);
      if (ep.key === 'listings' && (!out.gainers.length)) {
        const rows = asArray(d).map(coinRow).filter((c) => c.percentChange24h != null);
        out.gainers = rows.slice().sort((a, b) => b.percentChange24h - a.percentChange24h).slice(0, 5);
        out.losers = rows.slice().sort((a, b) => a.percentChange24h - b.percentChange24h).slice(0, 5);
      }
    } catch (e) { out.evidence[out.evidence.length - 1].status = 'live but unexpected shape — demo fallback for this section'; }
  }
  return out;
}

async function briefData() {
  if (!API_KEY) return { ...demoData, fetchedAt: new Date().toISOString() };
  const raw = {};
  await Promise.all(ENDPOINTS.map(async (ep) => {
    try { raw[ep.key] = await cmcFetch(ep); } catch (e) { raw[ep.key] = null; }
  }));
  if (!Object.values(raw).some(Boolean)) return { ...demoData, fetchedAt: new Date().toISOString(), source: 'demo (API unreachable)' };
  return normalize(raw);
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, mode: API_KEY ? 'live' : 'demo', endpoints: ENDPOINTS.map((e) => e.path) }));
  }
  if (url.pathname === '/api/brief-data') {
    try {
      const data = await briefData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: String(e) }));
    }
  }
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  const fp = path.join(__dirname, 'public', path.normalize(file).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(buf);
  });
});
server.listen(PORT, () => console.log('Market Morning Brief running at http://localhost:' + PORT + ' (mode: ' + (API_KEY ? 'live' : 'demo') + ')'));
