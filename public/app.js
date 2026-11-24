'use strict';
let DATA = null;
const $ = (id) => document.getElementById(id);

function pctSpan(v) {
  const cls = v == null ? '' : v >= 0 ? 'up' : 'down';
  return '<span class="' + cls + '">' + Brief.fmtPct(v) + '</span>';
}
function row(c, right) {
  return '<li><span><strong>' + c.symbol + '</strong> ' + c.name + '</span><span>' + right + '</span></li>';
}
function render(d) {
  DATA = d;
  const badge = $('sourceBadge');
  const isLive = d.source === 'live';
  badge.textContent = isLive ? '● LIVE CoinMarketCap data' : 'Demo data — add a CMC API key for live';
  badge.classList.toggle('live', isLive);
  $('dateLine').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
    (d.fetchedAt ? ' · fetched ' + new Date(d.fetchedAt).toLocaleTimeString() : '');
  $('moodValue').textContent = d.mood && d.mood.value != null ? d.mood.value + ' · ' + d.mood.label : '—';
  $('moodLine').textContent = Brief.moodLine(d.mood);
  $('regimeValue').textContent = d.regime && d.regime.altcoinSeasonIndex != null ? 'Altcoin Season ' + d.regime.altcoinSeasonIndex + '/100' : '—';
  $('regimeLine').textContent = Brief.regimeLine(d.regime);
  $('gainers').innerHTML = (d.gainers || []).map((c) => row(c, pctSpan(c.percentChange24h))).join('') || '<li>No data</li>';
  $('losers').innerHTML = (d.losers || []).map((c) => row(c, pctSpan(c.percentChange24h))).join('') || '<li>No data</li>';
  $('watchlist').innerHTML = (d.watchlist || []).map((c) =>
    row(c, Brief.fmtMoney(c.price) + ' &nbsp; ' + pctSpan(c.percentChange24h))).join('') || '<li>No data</li>';
  $('evidence').innerHTML = (d.evidence || []).map((e) =>
    '<details><summary>' + e.endpoint + ' — ' + e.status + '</summary>' +
    (e.sample ? '<pre>' + e.sample.replace(/</g, '&lt;') + '</pre>' : '<pre>No sample in demo mode — connect a live key.</pre>') +
    '</details>').join('');
}
function generate() {
  if (!DATA) return;
  const brief = Brief.generateBrief(DATA, {});
  $('thread').innerHTML = brief.thread.map((p) =>
    '<div class="post"><textarea rows="3">' + p.replace(/</g, '&lt;') + '</textarea><div class="count">' + p.length + '/280</div></div>').join('');
  $('paragraph').value = brief.paragraph;
  $('briefSection').hidden = false;
  $('briefSection').scrollIntoView({ behavior: 'smooth' });
}
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => { const old = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => btn.textContent = old, 1500); });
}
$('generateBtn').addEventListener('click', generate);
$('copyThread').addEventListener('click', (e) => copyText([...document.querySelectorAll('#thread textarea')].map((t) => t.value).join('\n\n'), e.target));
$('copyParagraph').addEventListener('click', (e) => copyText($('paragraph').value, e.target));

fetch('/api/brief-data').then((r) => r.json()).then(render).catch(() => {
  $('sourceBadge').textContent = 'Could not load data';
});
