/* Market Morning Brief — deterministic brief generation.
   Pure functions: same data in, same brief out. No LLM, no network.
   Works in the browser (window.Brief) and in Node (module.exports) so the
   exact code that renders the demo can be unit-tested. */
(function (global) {
  'use strict';

  function fmtMoney(n) {
    if (n == null || isNaN(n)) return 'n/a';
    if (Math.abs(n) >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return '$' + Number(n).toFixed(4);
  }
  function fmtPct(n) {
    if (n == null || isNaN(n)) return 'n/a';
    return (n > 0 ? '+' : '') + Number(n).toFixed(1) + '%';
  }
  function moodLine(mood) {
    if (!mood || mood.value == null) return 'Market mood is unavailable today.';
    var v = mood.value;
    var plain = v <= 24 ? 'people are fearful and prices have been beaten down'
      : v <= 44 ? 'people are cautious'
      : v <= 55 ? 'the market is undecided'
      : v <= 74 ? 'people are optimistic and leaning in'
      : 'people are chasing — historically a time to be careful, not excited';
    return 'Market mood is ' + mood.label + ' (' + v + '/100) — in plain English, ' + plain + '.';
  }
  function regimeLine(regime) {
    if (!regime) return 'Market regime is unavailable today.';
    var idx = regime.altcoinSeasonIndex;
    var regimeText = idx == null ? 'unclear'
      : idx >= 75 ? 'Altcoin Season — alts are outperforming Bitcoin'
      : idx <= 25 ? 'Bitcoin Season — Bitcoin is outperforming most alts'
      : 'in between — capital is favouring Bitcoin over alts, but not exclusively';
    var dom = regime.btcDominance != null ? ' BTC dominance is ' + Number(regime.btcDominance).toFixed(1) + '%.' : '';
    var cap = regime.totalMarketCap != null ? ' Total crypto market cap: ' + fmtMoney(regime.totalMarketCap) + '.' : '';
    return 'Regime: ' + regimeText + '.' + dom + cap;
  }
  function moversLine(list, label) {
    if (!list || !list.length) return null;
    var top = list.slice(0, 3).map(function (c) {
      return c.name + ' (' + c.symbol + ') ' + fmtPct(c.percentChange24h);
    }).join(', ');
    return label + ': ' + top + '.';
  }
  function watchlistLine(watchlist) {
    if (!watchlist || !watchlist.length) return null;
    var parts = watchlist.slice(0, 6).map(function (c) {
      return c.symbol + ' ' + fmtMoney(c.price) + ' (' + fmtPct(c.percentChange24h) + ' 24h)';
    }).join(' · ');
    return 'Watchlist: ' + parts + '.';
  }

  /* Split text into <=280-char numbered thread posts. */
  function toThread(lines, footer) {
    var posts = [];
    var current = '';
    lines.forEach(function (line) {
      if (!line) return;
      if ((current + ' ' + line).trim().length > 260 && current) { posts.push(current.trim()); current = line; }
      else { current = (current + ' ' + line).trim(); }
    });
    if (current) posts.push(current.trim());
    if (footer) posts.push(footer);
    return posts.map(function (p, i) { return (i + 1) + '/' + posts.length + ' ' + p; });
  }

  function generateBrief(data, opts) {
    opts = opts || {};
    var dateStr = opts.dateStr || new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var intro = 'GM. Your market morning brief for ' + dateStr + ' — 60 seconds, plain English, live data from CoinMarketCap.';
    var lines = [intro, moodLine(data.mood), regimeLine(data.regime),
      moversLine(data.gainers, 'Biggest gainers (24h)'), moversLine(data.losers, 'Biggest losers (24h)'),
      watchlistLine(data.watchlist)];
    var paragraph = lines.filter(Boolean).join(' ') +
      ' Not financial advice — just what the data says this morning.';
    var footer = 'Built with live @CoinMarketCap API data. Full dashboard + sources in the demo. #BuildwithCMC';
    return { thread: toThread(lines, footer), paragraph: paragraph };
  }

  var api = { generateBrief: generateBrief, fmtMoney: fmtMoney, fmtPct: fmtPct, moodLine: moodLine, regimeLine: regimeLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Brief = api;
})(typeof window !== 'undefined' ? window : globalThis);
