/* Netlify Function version of the CMC aggregation proxy (server.js is the
   local-dev equivalent). The API key lives in the CMC_API_KEY environment
   variable set in the Netlify site settings — never in code or the repo. */
'use strict';
const demoData = require('../../lib/demo-data.json');
const CMC = 'https://pro-api.coinmarketcap.com';
const ENDPOINTS = [
  { key: 'mood', path: '/v3/fear-and-greed/latest' },
  { key: 'altseason', path: '/v1/altcoin-season-index/latest' },
  { key: 'global', path: '/v1/global-metrics/quotes/latest' },
  { key: 'gainersLosers', path: '/v1/cryptocurrency/trending/gainers-losers?time_period=24h' },
  { key: 'trending', path: '/v1/cryptocurrency/trending/latest' },
  { key: 'quotes', path: '/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,SOL' },
  { key: 'listings', path: '/v1/cryptocurrency/listings/latest?limit=100&sort=market_cap' },
];
function usdQuote(obj) {
  if (!obj) return {};
  const q = obj.quote;
  if (Array.isArray(q)) return q.find((x) => x.symbol === 'USD') || q[0] || {};
  if (q && q.USD) return q.USD;
  return {};
}
function coinRow(c) {
  const q = usdQuote(c);
  return { name: c.name, symbol: c.symbol, price: q.price != null ? q.price : c.price,
    percentChange1h: q.percent_change_1h, percentChange24h: q.percent_change_24h,
    percentChange7d: q.percent_change_7d, marketCap: q.market_cap != null ? q.market_cap : c.market_cap };
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
    out.evidence.push({ endpoint: ep.path, status: 'live', sample: JSON.stringify(r).slice(0, 400) });
    const d = r.data;
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
      if (ep.key === 'listings') {
        const rows = asArray(d).map(coinRow).filter((c) => c.percentChange24h != null);
        if (!raw.gainersLosers) {
          const STABLES = ['USDT', 'USDC', 'DAI', 'USDE', 'FDUSD', 'TUSD', 'USDD', 'PYUSD', 'GUSD', 'FRAX', 'LUSD', 'USD1', 'RLUSD', 'USDS', 'USDX', 'EURC', 'USDG', 'USDP', 'EURT', 'XUSD', 'AUSD', 'USDB'];
          const movers = rows.filter((c) => STABLES.indexOf(c.symbol) === -1);
          out.gainers = movers.filter((c) => c.percentChange24h > 0.1).sort((a, b) => b.percentChange24h - a.percentChange24h).slice(0, 5);
          out.losers = movers.filter((c) => c.percentChange24h < -0.1).sort((a, b) => a.percentChange24h - b.percentChange24h).slice(0, 5);
          const ev = out.evidence.find((e) => e.endpoint.indexOf('gainers-losers') !== -1);
          if (ev) ev.status = 'unavailable on current plan — top movers derived live from listings/latest';
        }
        if (!raw.trending) {
          out.trending = rows.slice(0, 10).map((c) => ({ name: c.name, symbol: c.symbol }));
          const ev = out.evidence.find((e) => e.endpoint.indexOf('trending/latest') !== -1);
          if (ev) ev.status = 'unavailable on current plan — top coins by market cap from listings/latest shown instead';
        }
      }
    } catch (e) { out.evidence[out.evidence.length - 1].status = 'live but unexpected shape — demo fallback for this section'; }
  }
  return out;
}
exports.handler = async (event) => {
  const key = process.env.CMC_API_KEY || '';
  if (event.queryStringParameters && event.queryStringParameters.health) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, mode: key ? 'live' : 'demo', endpoints: ENDPOINTS.map((e) => e.path) }) };
  }
  if (!key) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...demoData, fetchedAt: new Date().toISOString() }) };
  }
  const raw = {};
  await Promise.all(ENDPOINTS.map(async (ep) => {
    try {
      const res = await fetch(CMC + ep.path, { headers: { 'X-CMC_PRO_API_KEY': key, Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      raw[ep.key] = await res.json();
    } catch (e) { raw[ep.key] = null; }
  }));
  if (!Object.values(raw).some(Boolean)) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...demoData, fetchedAt: new Date().toISOString(), source: 'demo (API unreachable)' }) };
  }
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalize(raw)) };
};
