# Market Morning Brief

**Turns live CoinMarketCap data into a plain-English morning brief — and a ready-to-post X thread.**

Built for the **Build with CMC: API Hackathon, Round 2** · Track: **AI Agents and Automation** · Entrant: Daniel Okeke ([@theweb3dan_](https://x.com/theweb3dan_))

## The problem

Crypto moves overnight. Creators and community leads wake up to dozens of charts and still have to spend 30–60 minutes working out what actually happened before they can post. Market Morning Brief answers three questions in 60 seconds, in plain English:

1. Is the market scared or greedy today?
2. Is this Bitcoin's market or altcoins' market?
3. What actually moved?

Then it drafts the post for you.

## What it does

- **Mood panel** — Fear & Greed score translated into plain English
- **Regime panel** — Altcoin Season Index, BTC dominance and total market cap, explained in one line
- **Movers** — top gainers and losers (24h)
- **Watchlist** — BTC, ETH, SOL live quotes
- **Brief generator** — one click produces an editable X thread draft (≤280 chars per post) and a paragraph version for Telegram/Discord. Generation is deterministic (templates over the live data), so every number in the brief is a number the API actually returned — nothing is invented, and it works with no LLM dependency
- **Evidence panel** — every endpoint used, with a live response sample, in the UI itself

## CoinMarketCap API endpoints used

| Endpoint | Used for |
|---|---|
| `GET /v3/fear-and-greed/latest` | Market mood |
| `GET /v1/altcoin-season-index/latest` | Market regime |
| `GET /v1/global-metrics/quotes/latest` | Total market cap, BTC dominance |
| `GET /v1/cryptocurrency/trending/gainers-losers` | Top movers (Startup tier) |
| `GET /v1/cryptocurrency/trending/latest` | Trending coins (Startup tier) |
| `GET /v1/cryptocurrency/quotes/latest` | Watchlist quotes |
| `GET /v1/cryptocurrency/listings/latest` | Listings / movers fallback |

Caching follows CMC's own intervals (quotes 60s, Fear & Greed / Altcoin Season 15 min) to stay well inside rate limits.

## Run it

```bash
cp .env.example .env   # add your CMC API key (free at coinmarketcap.com/api)
npm start              # http://localhost:4173
npm test               # verifies the brief generator against sample data
```

No key? The app runs in **clearly-labelled demo mode** with sample data in the same response shapes, so the full flow can be reviewed. Add a key and the same screens go live — hackathon participants get a free Startup-tier upgrade after registering on DoraHacks with the same email as their CMC account.

**Security:** the API key is only ever read by the server (`server.js`) from `.env`, which is git-ignored. It is never sent to the browser and must never be committed.

## What the API made possible — and where it got in the way

*Made possible:* combining sentiment (Fear & Greed), regime (Altcoin Season + dominance) and movers in a single aggregated call gives a *narrative*, not just numbers — that combination is the whole product. The trending/gainers-losers endpoint on the Startup tier removed the need to page through full listings to find movers.

*Got in the way:* (to be completed from live build notes before submission — e.g. response-shape differences between v1 quotes (object keyed by symbol) and v3 quotes (quote as a list) require defensive normalisation, which lives in `server.js`.)

## Submission checklist (hackathon)

- [x] Public repository
- [ ] Working deployed demo
- [ ] Screen recording of it running
- [x] Endpoints named explicitly (above)
- [x] Visible evidence of real API calls (evidence panel + code in `server.js`)
- [x] Note on what the API made possible / where it got in the way (above)
- [ ] X post with DoraHacks submission link + demo video + **#BuildwithCMC**
- [x] No API key in the repo

Not financial advice. The brief describes what the data says; it never recommends buying or selling.
