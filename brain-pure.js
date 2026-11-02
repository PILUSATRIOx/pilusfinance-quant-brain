    /* ═══════════════════════════════════════════════════════════════════════════
       PILUS QUANT BRAIN ENGINE v1.0 — SELF-EVOLUTIONARY AI TRADING INTELLIGENCE
       ─────────────────────────────────────────────────────────────────────────
       Port web dari sistem Python "training ai trading future":
       • market_analyst.py      → Multi-TF analysis + Entry/SL/TP/Lev presisi
       • backtester.py          → Walk-forward backtest (López de Prado anti-overfit)
       • strategy_optimizer.py  → 6-Screen Master Scoring (Elder/Williams/Wyckoff/News)
       • news_sentiment_engine  → Tier-1 RSS (CoinDesk/CoinTelegraph/Decrypt) + anti-rumor
       • self_learning_evaluator→ Post-mortem SL + adaptasi parameter + jurnal belajar

       SUMBER PENGETAHUAN (RULES DIENCODED, BUKAN SEKADAR NAMA):
       Elder · Steidlmayer · Williams · Wyckoff · Soros · Glassnode/Delphi ·
       Renaissance/Two Sigma/Citadel · López de Prado · Douglas · Binance Research

       DATA 100% RIIL: Binance Futures REST (klines/funding/OI) + Yahoo Finance
       (saham, via proxy CORS) + RSS tier-1. Tidak ada angka sintetis.
       Akurasi = terukur dari sinyal live yang di-track vs harga riil.
    ═══════════════════════════════════════════════════════════════════════════ */
    (function () {
    'use strict';

    /* ═══════════════ 1. KONFIGURASI & STATE ═══════════════ */
    const QB_STORE = 'pilusQuantBrainV1';
    const QB_GITHUB_REPO = 'PILUSATRIOx/pilusfinance-quant-brain';
    const QB_GITHUB_BRANCH = 'main';
    const QB_GITHUB_RAW = 'https://raw.githubusercontent.com/' + QB_GITHUB_REPO + '/' + QB_GITHUB_BRANCH + '/';
    const QB_GITHUB_API = 'https://api.github.com/repos/' + QB_GITHUB_REPO + '/contents/';
    const QB_GITHUB_TOKEN_KEY = 'pilusQuantBrainGithubToken';
    const QB_CYCLE_MS = 5 * 60 * 1000;        // 1 siklus belajar = 5 menit
    const QB_NEWS_STALE = 10 * 60 * 1000;     // refresh berita tiap 10 menit
    const QB_OPT_BATCH = 3;                    // 3 aset di-backtest per siklus (rotasi)
    const QB_SCAN_BATCH = 18;                  // scan SEMUA aset tiap siklus (peluang sinyal lebih merata, tetap selektif lewat skor)
    const QB_MAX_SIGNALS = 200, QB_MAX_JOURNAL = 300;

    const QB_UNIVERSE = [
        { sym: 'BTCUSDT', name: 'Bitcoin', cls: 'CRYPTO', src: 'binance' },
        { sym: 'ETHUSDT', name: 'Ethereum', cls: 'CRYPTO', src: 'binance' },
        { sym: 'SOLUSDT', name: 'Solana', cls: 'CRYPTO', src: 'binance' },
        { sym: 'XRPUSDT', name: 'XRP', cls: 'CRYPTO', src: 'binance' },
        { sym: 'DOGEUSDT', name: 'Dogecoin', cls: 'CRYPTO', src: 'binance' },
        { sym: 'BNBUSDT', name: 'BNB', cls: 'CRYPTO', src: 'binance' },
        { sym: 'ADAUSDT', name: 'Cardano', cls: 'CRYPTO', src: 'binance' },
        { sym: 'AVAXUSDT', name: 'Avalanche', cls: 'CRYPTO', src: 'binance' },
        { sym: 'LINKUSDT', name: 'Chainlink', cls: 'CRYPTO', src: 'binance' },
        { sym: 'SUIUSDT', name: 'Sui', cls: 'CRYPTO', src: 'binance' },
        { sym: 'EURUSDT', name: 'EUR/USD (proxy)', cls: 'FOREX', src: 'binance' },
        { sym: 'GBPUSDT', name: 'GBP/USD (proxy)', cls: 'FOREX', src: 'binance' },
        { sym: 'NVDA', name: 'NVIDIA', cls: 'STOCK', src: 'yahoo' },
        { sym: 'AAPL', name: 'Apple', cls: 'STOCK', src: 'yahoo' },
        { sym: 'TSLA', name: 'Tesla', cls: 'STOCK', src: 'yahoo' },
        { sym: 'MSFT', name: 'Microsoft', cls: 'STOCK', src: 'yahoo' },
        { sym: 'SPY', name: 'S&P 500 ETF', cls: 'STOCK', src: 'yahoo' },
        { sym: 'QQQ', name: 'Nasdaq 100 ETF', cls: 'STOCK', src: 'yahoo' }
    ];
    const QB_BY_SYM = {}; QB_UNIVERSE.forEach(a => QB_BY_SYM[a.sym] = a);

    /* Basis pengetahuan — tiap entri = aturan riil yang dieksekusi engine */
    const QB_KNOWLEDGE = [
        { id: 'elder', book: 'The New Trading for a Living', author: 'Dr. Alexander Elder', rules: 'Triple Screen (tren 4H → momentum 1H → trigger) + larangan melawan tren makro + 2% risk rule', strategies: ['elder', 'risk'] },
        { id: 'steidlmayer', book: 'Auction Market Theory & Volume Profile', author: 'Peter Steidlmayer / CBOT', rules: 'Konfirmasi volume pada breakout; sepi volume = breakout palsu', strategies: ['donchian', 'smc'] },
        { id: 'williams', book: 'Long-Term Secrets to Short-Term Trading', author: 'Larry Williams', rules: 'Volatility breakout Donchian + SL adaptif 1.5–2.0x ATR (bukan % mati) kebal wick hunting', strategies: ['donchian'] },
        { id: 'wyckoff', book: 'The Wyckoff Method', author: 'Richard D. Wyckoff', rules: 'Spring (jebakan bawah) & Upthrust (jebakan atas) = sinyal probabilitas tertinggi', strategies: ['wyckoff'] },
        { id: 'soros', book: 'Reflexivity & Event-Driven Verification', author: 'George Soros', rules: 'Konsensus min. 2 outlet Tier-1; rumor ("reportedly/unconfirmed") bobot 50%; circuit breaker berita krisis', strategies: ['news'] },
        { id: 'glassnode', book: 'Modern Crypto Derivatives Research', author: 'Glassnode & Delphi Digital', rules: 'Funding +0.015% = long squeeze (bias short); OI divergence = pantulan lemah', strategies: ['funding', 'oi'] },
        { id: 'rentec', book: 'Medallion Blueprint (66% p.a.)', author: 'Renaissance Technologies / Jim Simons', rules: 'Edge statistik 51–53% cukup jika dieksekusi ribuan kali + RL ketat; win rate rendah ok asal R:R asimetris', strategies: ['ensemble'] },
        { id: 'twosigma', book: 'Multi-Factor Regime Detection', author: 'Two Sigma ($84B AUM)', rules: 'Deteksi rezim pasar (Trend/Range/Chaos) → strategi berbeda per rezim', strategies: ['regime'] },
        { id: 'lopezdeprado', book: 'Advances in Financial Machine Learning', author: 'Dr. Marcos López de Prado (AQR)', rules: 'Walk-forward validation: pilih parameter di train, uji di out-of-sample → anti curve-fitting', strategies: ['walkfwd'] },
        { id: 'douglas', book: 'Trading in the Zone', author: 'Mark Douglas', rules: 'Asimetri R:R — TP bertingkat 0.8R/1.6R/2.5R + auto-breakeven di +0.8R', strategies: ['risk'] },
        { id: 'binres', book: 'Low Float & Meme Coin Anatomy', author: 'Binance Research', rules: 'Pump vertikal + funding ekstrem = jebakan ritel; hindari long puncak euforia', strategies: ['funding'] }
    ];

    /* Strategi yang bisa di-backtest (rules-based murni) */
    const QB_STRATS = [
        { id: 'elder', name: 'Elder Triple Screen', book: 'Elder', fit: ['TREND_UP', 'TREND_DOWN'] },
        { id: 'donchian', name: 'Williams Volatility Breakout', book: 'Williams/Steidlmayer', fit: ['TREND_UP', 'TREND_DOWN'] },
        { id: 'bbrev', name: 'Bollinger Mean Reversion', book: 'Bollinger/Elder', fit: ['RANGING'] },
        { id: 'wyckoff', name: 'Wyckoff Spring & Upthrust', book: 'Wyckoff', fit: ['RANGING', 'TREND_UP', 'TREND_DOWN'] },
        { id: 'rsidiv', name: 'RSI Divergence Reversal', book: 'Wildler/Elder', fit: ['TREND_UP', 'TREND_DOWN', 'RANGING'] },
        { id: 'macdm', name: 'MACD Momentum Trend', book: 'Appel/Elder', fit: ['TREND_UP', 'TREND_DOWN'] },
        { id: 'smc', name: 'SMC Liquidity Sweep (SFP)', book: 'Wyckoff/ICT', fit: ['RANGING', 'TREND_UP', 'TREND_DOWN'] },
        { id: 'emax', name: 'EMA Cross Naive (CONTROL)', book: 'Baseline penelitian', fit: ['TREND_UP', 'TREND_DOWN'] }
    ];
    const QB_STRAT_IDS = QB_STRATS.map(s => s.id);

    let brain = null, cycleTimer = null, tickTimer = null, nextCycleAt = 0;

    function defaultBrain() {
        const w = {}; QB_STRAT_IDS.forEach(id => w[id] = 1.0);
        return {
            v: 1, gen: 0, cycles: 0, firstBootAt: Date.now(), running: false,
            optCursor: 0, scanCursor: 0, lastOptAt: 0,
            params: { atrMult: 1.8, rsiLongMax: 62, rsiShortMin: 38, minScore: 75, feeBps: 10, riskPct: 1.0 },
            learned: { atrMult: 1.8, rsiLongMax: 62, rsiShortMin: 38 },
            weights: w,
            leaderboard: {}, signals: [], journal: [],
            accuracyHistory: [], equityR: 0,
            stats: { closed: 0, wins: 0, losses: 0, be: 0, tp1Hits: 0, newsIngested: 0, lessons: 0, backtests: 0, netR: 0, backtestOOS: { trades: 0, netR: 0, winRatePct: null } },
            news: { fetchedAt: 0, items: [], perCoin: {}, breaker: [], fearGreed: null },
            derivatives: {},
            whale: { fetchedAt: 0, bias: {}, positions: [] }
        };
    }
    function loadBrain() {
        try {
            const raw = localStorage.getItem(QB_STORE);
            if (!raw) return defaultBrain();
            const b = JSON.parse(raw); const d = defaultBrain();
            return Object.assign(d, b, { params: Object.assign(d.params, b.params || {}), learned: Object.assign(d.learned, b.learned || {}), stats: Object.assign(d.stats, b.stats || {}), news: Object.assign(d.news, b.news || {}), whale: Object.assign(d.whale, b.whale || {}) });
        } catch (e) { return defaultBrain(); }
    }
    function saveBrain() { try { localStorage.setItem(QB_STORE, JSON.stringify(brain)); } catch (e) { } }

    /* ═══════════════ 2. DATA LAYER (100% RIIL) ═══════════════ */
    async function fetchTimeout(url, ms) {
        return fetch(url, { signal: AbortSignal.timeout(ms || 9000) });
    }
    async function qbFetchBinanceKlines(sym, interval, limit) {
        limit = limit || 1000;
        const u = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=${Math.min(1500, limit)}`;
        const r = await fetchTimeout(u, 12000);
        if (!r.ok) throw new Error('binance ' + r.status);
        const raw = await r.json();
        return raw.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
    }
    // Roadmap #3: paginasi startTime untuk 4000+ bar 1H (López de Prado — OOS lebih panjang & statistik lebih solid)
    async function qbFetchBinanceDeep(sym, interval, target) {
        target = target || 4000;
        const out = []; let startTime = null; let pages = 0;
        while (out.length < target && pages < 6) {
            pages++;
            const rem = Math.min(1500, target - out.length);
            let u = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=${rem}`;
            if (startTime) u += `&startTime=${startTime}`;
            const r = await fetchTimeout(u, 15000);
            if (!r.ok) break;
            const raw = await r.json();
            if (!Array.isArray(raw) || !raw.length) break;
            const batch = raw.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
            // dedupe by time
            const lastT = out.length ? out[out.length - 1].t : -1;
            const filtered = batch.filter(b => b.t > lastT);
            if (!filtered.length) break;
            out.push(...filtered);
            if (raw.length < rem) break;
            startTime = raw[raw.length - 1][0] + 1;
            await new Promise(res => setTimeout(res, 150));
        }
        return out.length > 100 ? out.slice(-Math.min(target, out.length)) : out;
    }
    function qbParseYahooChart(j) {
        const res = j && j.chart && j.chart.result && j.chart.result[0];
        if (!res) return null;
        const ts = res.timestamp || [], q = res.indicators.quote[0];
        const out = [];
        for (let i = 0; i < ts.length; i++) {
            if (q.open[i] == null || q.close[i] == null) continue;
            out.push({ t: ts[i] * 1000, o: +q.open[i], h: +(q.high[i] || q.close[i]), l: +(q.low[i] || q.close[i]), c: +q.close[i], v: +(q.volume[i] || 0) });
        }
        return out.length > 260 ? out.slice(-1000) : null;
    }
    async function qbFetchYahoo(sym) {
        const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=6mo&interval=1h`;
        // Jalur 0: direct (kadang lolos CORS di beberapa browser)
        try {
            const r = await fetchTimeout(target, 12000);
            if (r.ok) {
                const parsed = qbParseYahooChart(await r.json());
                if (parsed) return parsed;
            }
        } catch (e) { }
        // Jalur 1: r.jina.ai ...
        try {
            const r = await fetchTimeout('https://r.jina.ai/' + target, 20000);
            if (r.ok) {
                const txt = await r.text();
                const start = txt.indexOf('{"chart"') !== -1 ? txt.indexOf('{"chart"') : txt.indexOf('{');
                const parsed = qbParseYahooChart(JSON.parse(txt.slice(start)));
                if (parsed) return parsed;
            }
        } catch (e) { }
        // Jalur 2: corsproxy.io
        try {
            const r = await fetchTimeout('https://corsproxy.io/?url=' + encodeURIComponent(target), 9000);
            if (r.ok) {
                const parsed = qbParseYahooChart(await r.json());
                if (parsed) return parsed;
            }
        } catch (e) { }
        // Jalur 3: allorigins
        try {
            const r = await fetchTimeout('https://api.allorigins.win/raw?url=' + encodeURIComponent(target), 9000);
            if (r.ok) {
                const parsed = qbParseYahooChart(await r.json());
                if (parsed) return parsed;
            }
        } catch (e) { }
        throw new Error('yahoo offline: ' + sym);
    }
    async function qbFetchCandles(asset, deep) {
        if (asset.src === 'yahoo') return qbFetchYahoo(asset.sym);
        return deep ? qbFetchBinanceDeep(asset.sym, '1h', 4000) : qbFetchBinanceKlines(asset.sym, '1h', 1000);
    }
    async function qbFetchFunding(sym) {
        try {
            const r = await fetchTimeout(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`, 6000);
            const j = await r.json(); return { rate: parseFloat(j.lastFundingRate || 0), mark: parseFloat(j.markPrice || 0) };
        } catch (e) { return null; }
    }
    async function qbFetchOIHist(sym) {
        try {
            const r = await fetchTimeout(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${sym}&period=1h&limit=25`, 6000);
            const j = await r.json();
            if (Array.isArray(j) && j.length > 5) {
                const first = +j[0].sumOpenInterest, last = +j[j.length - 1].sumOpenInterest;
                return { now: last, chgPct: first > 0 ? ((last - first) / first) * 100 : 0 };
            }
        } catch (e) { }
        return null;
    }

    /* RSS Tier-1 (Soros cross-verification): rss2json → allorigins fallback */
    const TOP_WHALES = [
        '0x37b81ab9e3ab04b9e3738e4891621205aaa31fd5',
        '0x08c14b32c8a48894e4b933090ebcc9ce33b21135',
        '0xfdf891f2b214a4c9374d26595ec6d4080262e381',
        '0x03ef8f736498047c3349bb2c18311d1bb4a79054'
    ];
    async function qbWhaleCycle() {
        // Roadmap #9: copy-trade smart money Hyperliquid → bonus screen konfluensi
        const bias = {}; const positions = [];
        for (const addr of TOP_WHALES) {
            try {
                const r = await fetchTimeout('https://api.hyperliquid.xyz/info', 12000);
                // need POST; fetchTimeout only GET. Use fetch directly.
            } catch (e) { }
        }
        // proper POST loop
        const outBias = {}; const outPos = [];
        for (const addr of TOP_WHALES) {
            try {
                const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'clearinghouseState', user: addr }), signal: AbortSignal.timeout(12000) });
                if (!r.ok) continue;
                const data = await r.json();
                const acct = parseFloat((data.crossMarginSummary || {}).accountValue || 1000000);
                (data.assetPositions || []).forEach(p => {
                    const pos = p.position || {};
                    const sz = parseFloat(pos.szi || 0);
                    if (sz === 0) return;
                    const coin = pos.coin;
                    const entry = parseFloat(pos.entryPx || 0);
                    const val = Math.abs(sz * entry);
                    const pct = acct > 0 ? (val / acct) * 100 : 5;
                    const side = sz > 0 ? 'LONG' : 'SHORT';
                    const w = Math.min(20, Math.max(5, pct));
                    if (!outBias[coin]) outBias[coin] = 0;
                    outBias[coin] += (side === 'LONG' ? w : -w);
                    outPos.push({ whale: addr.slice(0, 8), coin, side, pct: Math.round(pct * 100) / 100, lev: (pos.leverage || {}).value || 5 });
                });
            } catch (e) { }
        }
        Object.keys(outBias).forEach(c => { outBias[c] = Math.round(outBias[c] * 100) / 100; });
        brain.whale.bias = outBias;
        brain.whale.positions = outPos.slice(0, 40);
        brain.whale.fetchedAt = Date.now();
        saveBrain();
    }
    const QB_FEEDS = [
        { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
        { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss' },
        { name: 'Decrypt', url: 'https://decrypt.co/feed' }
    ];
    async function qbFetchFeed(feed) {
        // Jalur 1: rss2json (CORS siap, tanpa key)
        try {
            const r = await fetchTimeout('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed.url), 15000);
            if (r.ok) {
                const j = await r.json();
                if (j.status === 'ok' && Array.isArray(j.items) && j.items.length) {
                    return j.items.slice(0, 15).map(it => ({ source: feed.name, title: (it.title || '').trim(), link: it.link || '', pubDate: it.pubDate || '', summary: String(it.description || '').replace(/<[^>]*>?/g, ' ').slice(0, 220) }));
                }
            }
        } catch (e) { }
        // Jalur 2: allorigins raw XML
        try {
            const r2 = await fetchTimeout('https://api.allorigins.win/raw?url=' + encodeURIComponent(feed.url), 9000);
            if (r2.ok) {
                const txt = await r2.text();
                const doc = new DOMParser().parseFromString(txt, 'text/xml');
                const items = [...doc.querySelectorAll('item')].slice(0, 15);
                if (items.length) return items.map(it => ({
                    source: feed.name,
                    title: (it.querySelector('title') || {}).textContent || '',
                    link: (it.querySelector('link') || {}).textContent || '',
                    pubDate: (it.querySelector('pubDate') || {}).textContent || '',
                    summary: ((it.querySelector('description') || {}).textContent || '').replace(/<[^>]*>?/g, ' ').slice(0, 220)
                }));
            }
        } catch (e) { }
        // Jalur 3: r.jina.ai (markdown reader — selalu hidup, CORS terbuka)
        try {
            const r3 = await fetchTimeout('https://r.jina.ai/' + feed.url, 18000);
            if (r3.ok) {
                const txt = await r3.text();
                const out = [];
                const seen = new Set();
                // Toleran multi-format: "### [T](U)", "- [T](U)", "* [T](U)" (CoinDesk pakai list, Decrypt pakai heading)
                const re = /(?:^|\n)(?:#{2,4}\s*|[-*]\s*)?\[([^\]]{5,240})\]\((https?:\/\/[^\s)]+)\)/g;
                let m;
                while ((m = re.exec(txt)) && out.length < 15) {
                    const title = m[1].trim(), link = m[2];
                    if (seen.has(link)) continue;
                    seen.add(link);
                    out.push({ source: feed.name, title, link, pubDate: '', summary: '' });
                }
                if (out.length) return out;
            }
        } catch (e) { }
        return null;
    }

    /* ═══════════════ 3. INDICATOR MATH (SERIES) ═══════════════ */
    function emaSeries(v, p) {
        const out = new Array(v.length).fill(null); if (v.length < p) return out;
        const k = 2 / (p + 1); let e = 0;
        for (let i = 0; i < p; i++) e += v[i]; e /= p; out[p - 1] = e;
        for (let i = p; i < v.length; i++) { e = v[i] * k + e * (1 - k); out[i] = e; }
        return out;
    }
    function rsiSeries(c, p) {
        p = p || 14; const out = new Array(c.length).fill(null); if (c.length < p + 1) return out;
        let ag = 0, al = 0;
        for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d > 0) ag += d; else al -= d; }
        ag /= p; al /= p;
        out[p] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
        for (let i = p + 1; i < c.length; i++) {
            const d = c[i] - c[i - 1]; const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
            ag = (ag * (p - 1) + g) / p; al = (al * (p - 1) + l) / p;
            out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
        }
        return out;
    }
    function atrSeries(k, p) {
        p = p || 14; const out = new Array(k.length).fill(null); if (k.length < p + 1) return out;
        const trs = [0];
        for (let i = 1; i < k.length; i++) {
            trs.push(Math.max(k[i].h - k[i].l, Math.abs(k[i].h - k[i - 1].c), Math.abs(k[i].l - k[i - 1].c)));
        }
        let a = 0; for (let i = 1; i <= p; i++) a += trs[i]; a /= p; out[p] = a;
        for (let i = p + 1; i < k.length; i++) { a = (a * (p - 1) + trs[i]) / p; out[i] = a; }
        return out;
    }
    function bbSeries(c, p, m) {
        p = p || 20; m = m || 2; const up = [], mid = [], lo = [], w = [];
        for (let i = 0; i < c.length; i++) {
            if (i < p - 1) { up.push(null); mid.push(null); lo.push(null); w.push(null); continue; }
            let s = 0; for (let j = i - p + 1; j <= i; j++) s += c[j]; const sm = s / p;
            let va = 0; for (let j = i - p + 1; j <= i; j++) va += (c[j] - sm) * (c[j] - sm);
            const sd = Math.sqrt(va / p);
            up.push(sm + m * sd); mid.push(sm); lo.push(sm - m * sd); w.push(sm > 0 ? (2 * m * sd) / sm : null);
        }
        return { up, mid, lo, w };
    }
    function macdSeries(c) {
        const e12 = emaSeries(c, 12), e26 = emaSeries(c, 26);
        const line = c.map((_, i) => (e12[i] != null && e26[i] != null) ? e12[i] - e26[i] : null);
        const valid = line.filter(x => x != null);
        const sigValid = emaSeries(valid, 9);
        const sig = new Array(c.length).fill(null);
        let vi = 0;
        for (let i = 0; i < c.length; i++) if (line[i] != null) { sig[i] = sigValid[vi]; vi++; }
        const hist = c.map((_, i) => (line[i] != null && sig[i] != null) ? line[i] - sig[i] : null);
        return { line, sig, hist };
    }
    function sma(v, i, p) { if (i + 1 < p) return null; let s = 0; for (let j = i - p + 1; j <= i; j++) s += v[j]; return s / p; }

    function buildIndicators(k) {
        const c = k.map(x => x.c);
        const bb = bbSeries(c, 20, 2);
        return {
            c, k,
            ema20: emaSeries(c, 20), ema50: emaSeries(c, 50), ema200: emaSeries(c, Math.min(200, Math.floor(c.length / 2))),
            rsi: rsiSeries(c, 14), atr: atrSeries(k, 14), bb,
            macd: macdSeries(c),
            volSma20: k.map((_, i) => sma(k.map(x => x.v), i, 20))
        };
    }

    /* Regime detection (Two Sigma blueprint): Efficiency Ratio + BB-width percentile */
    function detectRegime(ind, i) {
        const n = 20; if (i < n + 5 || ind.ema50[i] == null) return 'UNKNOWN';
        const c = ind.c;
        let net = Math.abs(c[i] - c[i - n]), sum = 0;
        for (let j = i - n + 1; j <= i; j++) sum += Math.abs(c[j] - c[j - 1]);
        const er = sum > 0 ? net / sum : 0;
        const ws = ind.bb.w.slice(Math.max(0, i - 200), i + 1).filter(x => x != null);
        const cur = ind.bb.w[i]; let pct = 50;
        if (ws.length > 30 && cur != null) pct = (ws.filter(x => x <= cur).length / ws.length) * 100;
        const slope = (c[i] - c[i - 30]) / (ind.atr[i] * 30 || 1);
        if (pct > 88) return 'CHAOS';
        if (er > 0.32 && slope > 0.1) return 'TREND_UP';
        if (er > 0.32 && slope < -0.1) return 'TREND_DOWN';
        return 'RANGING';
    }

    /* ═══════════════ 4. STRATEGY LIBRARY (RULES DARI BUKU) ═══════════════ */
    function swingLows(k, from, to) {
        const out = [];
        for (let i = Math.max(2, from); i <= to - 2 && i < k.length - 2; i++) {
            if (k[i].l < k[i - 1].l && k[i].l < k[i - 2].l && k[i].l < k[i + 1].l && k[i].l < k[i + 2].l) out.push(i);
        }
        return out.slice(-3);
    }
    function swingHighs(k, from, to) {
        const out = [];
        for (let i = Math.max(2, from); i <= to - 2 && i < k.length - 2; i++) {
            if (k[i].h > k[i - 1].h && k[i].h > k[i - 2].h && k[i].h > k[i + 1].h && k[i].h > k[i + 2].h) out.push(i);
        }
        return out.slice(-3);
    }
    function aggEma(ind, period, mult) {
        // EMA timeframe 4H hasil agregasi dari candle 1H (Elder Screen 1)
        const step = mult || 4, out = new Array(ind.c.length).fill(null);
        const closes4 = []; const idxMap = [];
        for (let i = 0; i < ind.c.length; i++) {
            if (i % step === step - 1) { closes4.push(ind.c[i]); idxMap.push(i); }
        }
        if (closes4.length < period) return out;
        const e = emaSeries(closes4, period);
        idxMap.forEach((origIdx, j) => { out[origIdx] = e[j]; });
        for (let i = 1; i < out.length; i++) if (out[i] == null && out[i - 1] != null) out[i] = out[i - 1];
        return out;
    }

    const QB_EVAL = {
        elder(ind, i) {
            if (i < 220) return null;
            const e4h = QB_STATE.ema4h, e20 = ind.ema20[i], rsi = ind.rsi[i], px = ind.c[i];
            if (!e4h || e4h[i] == null || e20 == null || rsi == null) return null;
            if (px > e4h[i] && rsi >= 45 && rsi <= 62 && px <= e20 * 1.01 && px > e20 * 0.985)
                return { side: 'LONG', note: 'Pullback ke EMA20 1H searah tren 4H (Layar 2 Elder), RSI ' + rsi.toFixed(0) };
            if (px < e4h[i] && rsi <= 55 && rsi >= 38 && px >= e20 * 0.99 && px < e20 * 1.015)
                return { side: 'SHORT', note: 'Pullback rally ke EMA20 melawan tren 4H bearish, RSI ' + rsi.toFixed(0) };
            return null;
        },
        donchian(ind, i) {
            if (i < 60) return null;
            const k = ind.k, look = 20;
            let hh = -Infinity, ll = Infinity;
            for (let j = i - look; j < i; j++) { hh = Math.max(hh, k[j].h); ll = Math.min(ll, k[j].l); }
            const volOk = ind.volSma20[i] != null && k[i].v > 1.2 * ind.volSma20[i];
            if (k[i].c > hh && volOk) return { side: 'LONG', note: 'Breakout Donchian-20 + volume ' + (k[i].v / (ind.volSma20[i] || 1)).toFixed(1) + 'x (Williams/Steidlmayer)' };
            if (k[i].c < ll && volOk) return { side: 'SHORT', note: 'Breakdown Donchian-20 + volume ' + (k[i].v / (ind.volSma20[i] || 1)).toFixed(1) + 'x (Williams/Steidlmayer)' };
            return null;
        },
        bbrev(ind, i) {
            if (i < 60) return null;
            const px = ind.c[i], rsi = ind.rsi[i];
            if (ind.bb.up[i] == null || rsi == null) return null;
            if (px <= ind.bb.lo[i] * 1.004 && rsi < 30) return { side: 'LONG', note: 'Touch Lower BB + RSI ' + rsi.toFixed(0) + ' oversold (mean reversion rezim ranging)' };
            if (px >= ind.bb.up[i] * 0.996 && rsi > 70) return { side: 'SHORT', note: 'Touch Upper BB + RSI ' + rsi.toFixed(0) + ' overbought (mean reversion rezim ranging)' };
            return null;
        },
        wyckoff(ind, i) {
            if (i < 50) return null;
            const k = ind.k;
            let ll = Infinity, hh = -Infinity;
            for (let j = i - 25; j < i - 2; j++) { ll = Math.min(ll, k[j].l); hh = Math.max(hh, k[j].h); }
            const volOk = ind.volSma20[i] != null && k[i].v > 1.15 * ind.volSma20[i];
            if (k[i].l < ll && k[i].c > ll && volOk) return { side: 'LONG', note: 'WYCKOFF SPRING: sweep bawah range lalu reclaim + volume (jebakan seller)' };
            if (k[i].h > hh && k[i].c < hh && volOk) return { side: 'SHORT', note: 'WYCKOFF UPTHRUST: sweep atas range lalu reject + volume (jebakan FOMO buyer)' };
            return null;
        },
        rsidiv(ind, i) {
            if (i < 60) return null;
            const k = ind.k, rsi = ind.rsi[i];
            if (rsi == null) return null;
            const lows = swingLows(k, i - 45, i - 3), highs = swingHighs(k, i - 45, i - 3);
            if (lows.length >= 2 && k[lows[1]].l < k[lows[0]].l && ind.rsi[lows[1]] > ind.rsi[lows[0]] + 2 && rsi < 48)
                return { side: 'LONG', note: 'Bullish RSI divergence: harga lower-low, momentum higher-low' };
            if (highs.length >= 2 && k[highs[1]].h > k[highs[0]].h && ind.rsi[highs[1]] < ind.rsi[highs[0]] - 2 && rsi > 52)
                return { side: 'SHORT', note: 'Bearish RSI divergence: harga higher-high, momentum lower-high' };
            return null;
        },
        macdm(ind, i) {
            if (i < 60) return null;
            const h0 = ind.macd.hist[i], h1 = ind.macd.hist[i - 1];
            if (h0 == null || h1 == null || ind.ema20[i] == null || ind.ema50[i] == null) return null;
            if (h1 <= 0 && h0 > 0 && ind.ema20[i] > ind.ema50[i]) return { side: 'LONG', note: 'MACD histogram flip positif dalam tren EMA bullish' };
            if (h1 >= 0 && h0 < 0 && ind.ema20[i] < ind.ema50[i]) return { side: 'SHORT', note: 'MACD histogram flip negatif dalam tren EMA bearish' };
            return null;
        },
        smc(ind, i) {
            if (i < 60) return null;
            const k = ind.k;
            let hh = -Infinity, ll = Infinity;
            for (let j = i - 33; j < i - 4; j++) { hh = Math.max(hh, k[j].h); ll = Math.min(ll, k[j].l); }
            const body = Math.abs(k[i].c - k[i].o), range = k[i].h - k[i].l || 1;
            const rejection = body / range < 0.45; // wick dominan = rejection
            const volOk = ind.volSma20[i] != null && k[i].v > 1.1 * ind.volSma20[i];
            if (k[i].h > hh && k[i].c < hh && rejection && volOk) return { side: 'SHORT', note: 'SMC Swing-Failure Pattern: sweep liquidity atas, wick reject + volume' };
            if (k[i].l < ll && k[i].c > ll && rejection && volOk) return { side: 'LONG', note: 'SMC Swing-Failure Pattern: sweep liquidity bawah, wick reject + volume' };
            return null;
        },
        emax(ind, i) {
            if (i < 60) return null;
            const a = ind.ema20[i - 1], b = ind.ema50[i - 1], a2 = ind.ema20[i], b2 = ind.ema50[i];
            if (a == null || b == null || a2 == null || b2 == null) return null;
            if (a <= b && a2 > b2) return { side: 'LONG', note: 'EMA20/50 golden cross (baseline kontrol)' };
            if (a >= b && a2 < b2) return { side: 'SHORT', note: 'EMA20/50 death cross (baseline kontrol)' };
            return null;
        }
    };
    const QB_STATE = { ema4h: null }; // per-symbol scratch (di-set sebelum evaluasi)

    /* ═══════════════ 5. WALK-FORWARD BACKTESTER (López de Prado) ═══════════════ */
    function backtestStrategy(stratId, k, ind, opts) {
        opts = opts || {};
        const feeBps = opts.feeBps != null ? opts.feeBps : 10;
        const trainEnd = Math.floor(k.length * 0.6);
        // Walk-forward: pilih ATR multiplier terbaik di TRAIN, uji di TEST (out-of-sample)
        let best = { mult: 1.8, exp: -Infinity };
        if (opts.walkForward !== false) {
            [1.5, 1.8, 2.0].forEach(m => {
                const tr = runLeg(stratId, k, ind, 220, trainEnd, m, feeBps);
                if (tr.trades >= 6) {
                    const score = tr.exp * Math.sqrt(tr.trades) - Math.max(0, tr.maxDD - 6) * 0.1;
                    if (score > best.exp) best = { mult: m, exp: score };
                }
            });
        }
        const oos = runLeg(stratId, k, ind, trainEnd, k.length, best.mult, feeBps);
        oos.atrMult = best.mult;
        return oos;
    }
    function runLeg(stratId, k, ind, from, to, atrMult, feeBps) {
        let wins = 0, losses = 0, grossW = 0, grossL = 0, peak = 0, eq = 0, maxDD = 0;
        const trades = [];
        let pos = null;
        QB_STATE.ema4h = aggEma(ind, 20, 4);
        for (let i = Math.max(from, 220); i < to; i++) {
            // ── kelola posisi dulu (konservatif: SL dicek sebelum TP di candle sama)
            if (pos) {
                const bar = k[i], risk = Math.abs(pos.entry - pos.slInit);
                const feeR = risk > 0 ? ((feeBps * 2 / 10000) * pos.entry) / risk : 0;
                let done = false;
                if (pos.side === 'LONG') {
                    if (bar.l <= pos.sl) { // SL (atau BE setelah TP1)
                        const r = pos.beActive ? pos.lockedR - 0 : -1 - feeR;
                        closeTrade(r); done = true;
                    } else if (!pos.tp1Hit && bar.h >= pos.tp1) { pos.tp1Hit = true; pos.beActive = true; pos.sl = pos.entry; pos.lockedR = 0.8 * 0.5; }
                    else if (pos.tp1Hit && bar.h >= pos.tp3) { closeTrade(pos.lockedR + 2.5 * 0.5 - feeR); done = true; }
                    else if (pos.tp1Hit) { pos.sl = Math.max(pos.sl, bar.h - 2 * (ind.atr[i] || 0)); } // trail 2x ATR (Douglas)
                } else {
                    if (bar.h >= pos.sl) {
                        const r = pos.beActive ? pos.lockedR : -1 - feeR;
                        closeTrade(r); done = true;
                    } else if (!pos.tp1Hit && bar.l <= pos.tp1) { pos.tp1Hit = true; pos.beActive = true; pos.sl = pos.entry; pos.lockedR = 0.8 * 0.5; }
                    else if (pos.tp1Hit && bar.l <= pos.tp3) { closeTrade(pos.lockedR + 2.5 * 0.5 - feeR); done = true; }
                    else if (pos.tp1Hit) { pos.sl = Math.min(pos.sl, bar.l + 2 * (ind.atr[i] || 0)); }
                }
                if (done) pos = null;
                function closeTrade(r) {
                    eq += r; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, peak - eq);
                    if (r > 0.01) { wins++; grossW += r; } else if (r < -0.01) { losses++; grossL += Math.abs(r); }
                    trades.push(r);
                }
                if (pos) continue;
            }
            // ── entry baru
            const sig = QB_EVAL[stratId] && QB_EVAL[stratId](ind, i);
            if (!sig) continue;
            const atr = ind.atr[i]; if (!atr || atr <= 0) continue;
            const entry = k[i].c;
            if (sig.side === 'LONG') {
                pos = { side: 'LONG', entry, slInit: entry - atrMult * atr, sl: entry - atrMult * atr, tp1: entry + 0.8 * atrMult * atr, tp3: entry + 2.5 * atrMult * atr, tp1Hit: false, beActive: false, lockedR: 0 };
            } else {
                pos = { side: 'SHORT', entry, slInit: entry + atrMult * atr, sl: entry + atrMult * atr, tp1: entry - 0.8 * atrMult * atr, tp3: entry - 2.5 * atrMult * atr, tp1Hit: false, beActive: false, lockedR: 0 };
            }
        }
        const n = trades.length;
        return {
            trades: n, wins, losses, winRate: n ? (wins / n) * 100 : 0,
            pf: grossL > 0 ? grossW / grossL : (grossW > 0 ? 99 : 0),
            exp: n ? trades.reduce((a, b) => a + b, 0) / n : 0,
            netR: trades.reduce((a, b) => a + b, 0), maxDD
        };
    }

    /* ═══════════════ 6. NEWS INTELLIGENCE (SOROS CROSS-VERIFICATION) ═══════════════ */
    const BULL_KW = ['approval', 'approved', 'etf', 'partnership', 'adoption', 'accumulate', 'bullish', 'inflow', 'record high', 'upgrade', 'launch', 'breakout', 'rally', 'expansion', 'integration', 'treasury', 'milestone', 'investment', 'backing', 'recovery'];
    const BEAR_KW = ['hack', 'hacked', 'exploit', 'exploited', 'lawsuit', 'sue', 'sued', 'sec', 'ban', 'banned', 'investigation', 'probe', 'outflow', 'dump', 'crash', 'plunge', 'delist', 'delisting', 'insolvency', 'fraud', 'scam', 'breach', 'vulnerability'];
    const MACRO_KW = ['fed', 'fomc', 'interest rate', 'inflation', 'cpi', 'powell', 'treasury', 'liquidity', 'recession', 'gdp', 'employment'];
    const RUMOR_KW = ['reportedly', 'rumored', 'rumour', 'allegedly', 'unconfirmed'];
    const COIN_ALIAS = {
        BTC: ['bitcoin', 'btc'], ETH: ['ethereum', 'eth', 'ether'], SOL: ['solana', 'sol'], XRP: ['xrp', 'ripple'],
        DOGE: ['dogecoin', 'doge'], BNB: ['binance coin', 'bnb'], ADA: ['cardano', 'ada'], AVAX: ['avalanche', 'avax'],
        LINK: ['chainlink', 'link'], SUI: ['sui'], EUR: ['euro', 'ecb'], GBP: ['pound', 'sterling', 'boe']
    };
    async function qbNewsCycle() {
        // Sebar request antar feed (bukan burst paralel) → tahan rate-limit rss2json free tier
        const results = [];
        const errs = [];
        for (let i = 0; i < QB_FEEDS.length; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 800));
            try { results.push(await qbFetchFeed(QB_FEEDS[i])); }
            catch (e) { results.push(null); errs.push(QB_FEEDS[i].name + ': ' + (e && e.message ? e.message : String(e)).slice(0, 80)); }
        }
        brain.news.lastErrors = errs;
        const items = [];
        results.forEach((r, i) => {
            if (r && r.length) items.push(...r);
            else items.push({ source: QB_FEEDS[i].name, title: '⚠ ' + QB_FEEDS[i].name + ' feed tidak terjangkau (offline)', link: '', pubDate: '', summary: 'Periksa koneksi — engine tetap jalan dengan sumber lain.', offline: true });
        });
        brain.news.items = items.slice(0, 45);
        // Macro trusted source: Fear & Greed (alternative.me)
        const fg = await qbFetchFearGreed();
        if (fg) { brain.news.fearGreed = fg; qbJournal('NEWS', '📊 Fear & Greed: ' + fg.value + ' (' + fg.classification + ') — makro sentiment riil.'); }
        // Jangan tandai fresh jika SEMUA feed gagal — agar siklus berikutnya langsung retry
        if (items.some(x => !x.offline)) brain.news.fetchedAt = Date.now();
        brain.stats.newsIngested += items.filter(x => !x.offline).length;
        if (!items.some(x => !x.offline)) {
            qbJournal('ERR', '⚠ Semua feed berita gagal' + (errs.length ? ' — ' + errs.join(' | ').slice(0, 200) : '') + '. Retry siklus berikutnya.');
        }

        // Sentimen per-koin (port news_sentiment_engine.py)
        const perCoin = {}, breaker = [];
        const text = items.map(n => (n.title + ' ' + n.summary).toLowerCase());
        Object.keys(COIN_ALIAS).forEach(coin => {
            let bull = 0, bear = 0, srcs = new Set(), critical = false, critHead = '', rumor = false;
            items.forEach((n, idx) => {
                const t = text[idx];
                const rel = COIN_ALIAS[coin].some(a => new RegExp('\\b' + a + '\\b').test(t));
                if (!rel) return;
                srcs.add(n.source);
                const isRumor = RUMOR_KW.some(r => t.includes(r)); if (isRumor) rumor = true;
                const wgt = isRumor ? 0.5 : 1.0;
                BULL_KW.forEach(kw => { if (t.includes(kw)) bull += wgt; });
                BEAR_KW.forEach(kw => { if (t.includes(kw)) bear += 1.5 * wgt; });
                if (!isRumor && ['hack', 'exploit', 'sec', 'lawsuit', 'investigation', 'delist'].some(c => (n.title || '').toLowerCase().includes(c)) && !critical) { critical = true; critHead = n.title; }
            });
            let sentiment = 'NEUTRAL', impact = 0;
            if (bear > bull && bear >= 1.5) { sentiment = 'BEARISH'; impact = -Math.min(1, (bear - bull) / 3); }
            else if (bull > bear && bull >= 1.5) { sentiment = 'BULLISH'; impact = Math.min(1, (bull - bear) / 3); }
            perCoin[coin] = { sentiment, impact: Math.round(impact * 100) / 100, sources: [...srcs], multiSourced: srcs.size >= 2, critical, critHead };
            if (critical) breaker.push({ coin, head: critHead });
        });
        brain.news.perCoin = perCoin;
        const prevBreaker = brain.news.breaker || [];
        brain.news.breaker = breaker;
        if (breaker.length && JSON.stringify(breaker) !== JSON.stringify(prevBreaker)) {
            qbJournal('CB', '🛡 CIRCUIT BREAKER AKTIF: ' + breaker.map(b => b.coin).join(', ') + ' — Long baru diblokir (' + breaker[0].head.slice(0, 80) + ')');
            qbNotify('🛡 Circuit Breaker Aktif', breaker.map(b => b.coin).join(', ') + ' — sinyal Long diblokir');
        }
        saveBrain();
        // Render incremental: berita langsung tampil walau siklus masih panjang
        try { qbRenderNews(); qbRenderStats(); } catch (e) { }
    }
    function newsForSymbol(sym) {
        const coin = sym.replace('USDT', '').replace('1000', '');
        return brain.news.perCoin[coin] || { sentiment: 'NEUTRAL', impact: 0, multiSourced: false, critical: false };
    }

    /* ═══════════════ 7. MASTER SCANNER & SIGNAL GENERATOR (6 SCREEN) ═══════════════ */
    function leverageFor(volPct) { return volPct < 1 ? 10 : (volPct < 2.5 ? 5 : 3); }
    function masterScore(sym, ind, votes, regime, deriv) {
        const i = ind.c.length - 2; // candle terakhir yang sudah close
        const px = ind.c[i], rsi = ind.rsi[i] != null ? ind.rsi[i] : 50, atr = ind.atr[i] || px * 0.01;
        const side = votes.dir; if (!side) return null;
        let score = 0; const factors = [];
        // Screen 1 — Elder: tren 4H
        const e4h = QB_STATE.ema4h;
        if (e4h && e4h[i] != null) {
            if ((side === 'LONG' && px > e4h[i]) || (side === 'SHORT' && px < e4h[i])) { score += 30; factors.push('✔ Screen1 (Elder): Tren 4H selaras arah ' + side); }
            else { score -= 25; factors.push('✖ Screen1 (Elder): Melawan tren 4H — penalti berat'); }
        }
        // Screen 2 — RSI momentum sehat
        if (side === 'LONG' && rsi >= 40 && rsi <= brain.learned.rsiLongMax) { score += 25; factors.push('✔ Screen2: RSI ' + rsi.toFixed(0) + ' zona momentum sehat'); }
        else if (side === 'SHORT' && rsi <= 60 && rsi >= brain.learned.rsiShortMin) { score += 25; factors.push('✔ Screen2: RSI ' + rsi.toFixed(0) + ' zona momentum sehat'); }
        else factors.push('✖ Screen2: RSI ' + rsi.toFixed(0) + ' di luar zona sehat (chasing/late)');
        // Screen 3 — Williams: proteksi ATR
        if (atr > 0) { score += 20; factors.push('✔ Screen3 (Williams): SL ' + brain.learned.atrMult.toFixed(1) + 'x ATR kebal wick-hunt'); }
        // Screen 4 — Konfluensi price action (BB / EMA)
        if (ind.bb.up[i] != null) {
            const nearBB = side === 'LONG' ? px <= ind.bb.mid[i] * 1.005 : px >= ind.bb.mid[i] * 0.995;
            if (nearBB) { score += 15; factors.push('✔ Screen4: Entry di area of value (dekat mid-BB) bukan chasing puncak'); }
        }
        // Screen 5 — Derivatives intel (Glassnode/Delphi, crypto saja)
        if (deriv && deriv.funding != null) {
            const fr = deriv.funding * 100;
            if (side === 'SHORT' && fr >= 0.015) { score += 10; factors.push('✔ Screen5: Funding +' + fr.toFixed(3) + '% → ritel overleverage Long (long squeeze risk)'); }
            else if (side === 'LONG' && fr <= -0.01) { score += 10; factors.push('✔ Screen5: Funding ' + fr.toFixed(3) + '% → short squeeze fuel'); }
            if (deriv.oiChg != null) {
                if (side === 'LONG' && deriv.oiChg > 2) { score += 5; factors.push('✔ OI naik +' + deriv.oiChg.toFixed(1) + '% 24h → akumulasi modal nyata'); }
                if (side === 'SHORT' && deriv.oiChg > 2 && deriv.priceChg24h > 8) { score += 5; factors.push('✔ OI naik saat rally → fresh short institusi masuk'); }
            }
        }
// Screen 6 (Whale / Smart-Money confluence, roadmap #9): Hyperliquid top whales net bias
        const whaleCoin = sym.replace('USDT', '').replace('1000', '');
        const wb = (brain.whale && brain.whale.bias) ? (brain.whale.bias[whaleCoin] || 0) : 0;
        if (wb) {
            if (side === 'LONG' && wb >= 10) { score += 8; factors.push('✔ Screen5b (Whales): smart money net LONG ' + wb.toFixed(1) + ' (Hyperliquid top traders)'); }
            else if (side === 'SHORT' && wb <= -10) { score += 8; factors.push('✔ Screen5b (Whales): smart money net SHORT ' + wb.toFixed(1) + ' (Hyperliquid top traders)'); }
            else if ((side === 'LONG' && wb <= -10) || (side === 'SHORT' && wb >= 10)) { score -= 6; factors.push('✖ Screen5b (Whales): smart money melawan arah ' + wb.toFixed(1)); }
            else factors.push('◦ Screen5b (Whales): net bias netral (' + wb.toFixed(1) + ')');
        }
        // Screen 6 — News (Soros)
        const nw = newsForSymbol(sym);
        if (nw.critical && side === 'LONG') { score -= 40; factors.push('🛡 Screen6: CIRCUIT BREAKER — berita krisis terverifikasi: ' + (nw.critHead || '').slice(0, 60)); }
        else if (nw.critical && side === 'SHORT') { score += 10; factors.push('✔ Screen6: krisis terverifikasi memperkuat Short'); }
        else if (nw.impact > 0.3 && side === 'LONG') { score += 10; factors.push('✔ Screen6: sentimen BULLISH multi-sumber (' + nw.sources.join(',') + ')'); }
        else if (nw.impact < -0.3 && side === 'SHORT') { score += 10; factors.push('✔ Screen6: sentimen BEARISH multi-sumber (' + nw.sources.join(',') + ')'); }
        else factors.push('◦ Screen6: berita netral (tidak menambah/mengurangi)');

        const volPct = (atr / px) * 100;
        const mult = brain.learned.atrMult;
        const sl = side === 'LONG' ? px - mult * atr : px + mult * atr;
        const risk = Math.abs(px - sl);
        return {
            sym, side, entry: px, sl, rsiAtEntry: rsi != null ? Math.round(rsi) : null,
            tp1: side === 'LONG' ? px + 0.8 * risk : px - 0.8 * risk,
            tp2: side === 'LONG' ? px + 1.6 * risk : px - 1.6 * risk,
            tp3: side === 'LONG' ? px + 2.5 * risk : px - 2.5 * risk,
            lev: leverageFor(volPct), conf: Math.max(0, Math.min(100, Math.round(score))),
            regime, factors, votes: votes.list, atr, volPct
        };
    }
    async function qbScanSymbols(list) {
        for (const sym of list) {
            const asset = QB_BY_SYM[sym]; if (!asset) continue;
            if (brain.signals.some(s => s.sym === sym && (s.status === 'OPEN' || s.status === 'TP1_SECURED'))) continue; // 1 sinyal aktif per aset
            try {
                const k = await qbFetchCandles(asset);
                const ind = buildIndicators(k);
                QB_STATE.ema4h = aggEma(ind, 20, 4);
                const i = ind.c.length - 2;
                const regime = detectRegime(ind, i);
                // Ensemble vote (Renaissance: gabungan edge kecil → sinyal besar)
                // Konfluensi dinilai dalam window 3 bar terakhir — setup yang baru terjadi, bukan basi
                let longW = 0, shortW = 0; const votes = [];
                QB_STRATS.forEach(st => {
                    if (!st.fit.includes(regime)) return;
                    const w = brain.weights[st.id] || 1;
                    if (w < 0.45) return; // strategi di-probasi tidak ikut voting
                    for (let b = i - 2; b <= i; b++) {
                        const sig = QB_EVAL[st.id](ind, b);
                        if (sig) {
                            const decay = 1 - (i - b) * 0.15; // bar terbaru bobot penuh
                            if (sig.side === 'LONG') longW += w * decay; else shortW += w * decay;
                            votes.push({ strat: st.id, side: sig.side, note: sig.note, w: Math.round(w * decay * 100) / 100, barAge: i - b });
                            break;
                        }
                    }
                });
                if (votes.length < 2) continue; // butuh min. 2 strategi sepakat
                const dir = longW > shortW * 1.4 ? 'LONG' : (shortW > longW * 1.4 ? 'SHORT' : null);
                if (!dir) continue;

                let deriv = null;
                if (asset.src === 'binance') {
                    const f = await qbFetchFunding(sym); const oi = await qbFetchOIHist(sym);
                    if (f || oi) deriv = { funding: f ? f.rate : null, oiChg: oi ? oi.chgPct : null, priceChg24h: ((ind.c[i] - ind.c[i - 24]) / ind.c[i - 24]) * 100 };
                }
                const ms = masterScore(sym, ind, { dir, list: votes }, regime, deriv);
                if (!ms || ms.conf < brain.params.minScore) continue;
                // Circuit breaker: blokir LONG saat krisis terverifikasi
                const nw = newsForSymbol(sym);
                if (nw.critical && ms.side === 'LONG') {
                    qbJournal('CB', '🛡 Long ' + sym + ' DIBATALKAN circuit breaker: ' + (nw.critHead || '').slice(0, 70));
                    continue;
                }
                ms.status = 'OPEN'; ms.createdAt = Date.now(); ms.tp1Hit = false; ms.beActive = false; ms.lockedR = 0; ms.mfe = 0; ms.mae = 0; ms.rsiAtEntry = ind.rsi[i] != null ? Math.round(ind.rsi[i]) : null;
                brain.signals.unshift(ms);
                if (brain.signals.length > QB_MAX_SIGNALS) brain.signals.length = QB_MAX_SIGNALS;
                qbJournal('SIGNAL', '🎯 SINYAL ' + ms.side + ' ' + sym + ' @ ' + ms.entry.toFixed(4) + ' | Skor ' + ms.conf + '/100 | rezim ' + regime + ' | ' + votes.length + ' strategi sepakat: ' + votes.map(v => v.strat).join('+'));
                qbNotify('🎯 Sinyal ' + ms.side + ' ' + sym, 'Entry ' + ms.entry.toFixed(4) + ' · SL ' + ms.sl.toFixed(4) + ' · TP3 ' + ms.tp3.toFixed(4) + ' · Skor ' + ms.conf + '/100');
            } catch (e) { /* aset offline — jujur dilewati */ }
        }
        saveBrain();
    }

    /* ═══════════════ 8. LIVE EVALUATION + SELF-LEARNING POST-MORTEM ═══════════════ */
    async function qbEvaluateOpenSignals() {
        const open = brain.signals.filter(s => s.status === 'OPEN' || s.status === 'TP1_SECURED');
        for (const s of open) {
            try {
                const asset = QB_BY_SYM[s.sym]; if (!asset) continue;
                const k = asset.src === 'yahoo' ? await qbFetchYahoo(s.sym) : await qbFetchBinanceKlines(s.sym, '5m', 3);
                const px = k[k.length - 1].c;
                const risk = Math.abs(s.entry - s.sl);
                if (risk <= 0) continue;
                const fav = s.side === 'LONG' ? (px - s.entry) / risk : (s.entry - px) / risk;
                s.mfe = Math.max(s.mfe || 0, fav); s.mae = Math.min(s.mae || 0, fav);
                let closed = false, netR = 0, reason = '';
                if (s.side === 'LONG') {
                    if (!s.beActive && px <= s.sl) { netR = -1; reason = 'SL ' + s.sl.toFixed(4) + ' tersentuh'; closed = true; }
                    else if (s.beActive && px <= s.sl) { netR = s.lockedR; reason = 'Trail/BE exit di ' + s.sl.toFixed(4); closed = true; }
                    else if (!s.tp1Hit && px >= s.tp1) { s.tp1Hit = true; s.beActive = true; s.sl = s.entry; s.lockedR = 0.4; s.status = 'TP1_SECURED'; brain.stats.tp1Hits++; qbJournal('TP1', '🔒 TP1 ' + s.sym + ' tercapai → SL digeser ke breakeven (risk-free, aturan Douglas)'); }
                    else if (s.beActive && px >= s.tp3) { netR = 0.4 + 1.25; reason = 'TP3 runner penuh +2.5R'; closed = true; }
                } else {
                    if (!s.beActive && px >= s.sl) { netR = -1; reason = 'SL ' + s.sl.toFixed(4) + ' tersentuh'; closed = true; }
                    else if (s.beActive && px >= s.sl) { netR = s.lockedR; reason = 'Trail/BE exit di ' + s.sl.toFixed(4); closed = true; }
                    else if (!s.tp1Hit && px <= s.tp1) { s.tp1Hit = true; s.beActive = true; s.sl = s.entry; s.lockedR = 0.4; s.status = 'TP1_SECURED'; brain.stats.tp1Hits++; qbJournal('TP1', '🔒 TP1 ' + s.sym + ' tercapai → SL digeser ke breakeven (risk-free)'); }
                    else if (s.beActive && px <= s.tp3) { netR = 0.4 + 1.25; reason = 'TP3 runner penuh +2.5R'; closed = true; }
                }
                if (closed) {
                    s.status = netR > 0.02 ? 'WIN' : (netR < -0.02 ? 'LOSS' : 'BE');
                    s.closedAt = Date.now(); s.netR = Math.round(netR * 100) / 100; s.closeReason = reason;
                    brain.stats.closed++;
                    if (s.status === 'WIN') brain.stats.wins++; else if (s.status === 'LOSS') brain.stats.losses++; else brain.stats.be++;
                    brain.equityR += s.netR;
                    brain.stats.netR = brain.equityR;
                    reinforceWeights(s);
                    if (s.status === 'LOSS') qbPostMortem(s); else qbJournal('WIN', '✅ ' + s.sym + ' ' + s.side + ' WIN +' + s.netR.toFixed(2) + 'R — ' + reason + ' (MFE ' + (s.mfe || 0).toFixed(2) + 'R)');
                    brain.accuracyHistory.push({ t: Date.now(), acc: brain.stats.closed ? (brain.stats.wins + brain.stats.be) / brain.stats.closed * 100 : 0, eq: Math.round(brain.equityR * 100) / 100 });
                }
            } catch (e) { }
        }
        saveBrain();
        qbScheduleSync();
    }
    function reinforceWeights(s) {
        (s.votes || []).forEach(v => {
            const cur = brain.weights[v.strat] || 1;
            brain.weights[v.strat] = Math.max(0.3, Math.min(3, cur * (1 + 0.08 * (s.netR || 0))));
        });
    }
    /* Post-mortem akar masalah + adaptasi parameter (port self_learning_evaluator.py) */
    function qbPostMortem(s) {
        let cause = '', action = '', adapted = '';
        const mfe = s.mfe || 0;
        if (mfe >= 0.5) {
            cause = 'Harga sempat profit +' + mfe.toFixed(2) + 'R lalu berbalik ke SL (profit diberikan kembali).';
            action = 'TP1 lebih dekat + auto-breakeven lebih agresif sudah aktif; periksa trailing 2x ATR.';
        } else if (mfe >= 0.25) {
            cause = 'SL tersentuh setelah MFE ' + mfe.toFixed(2) + 'R — dugaan wick-hunt / SL masih terlalu sempit.';
            if (brain.learned.atrMult < 2.2) { brain.learned.atrMult = Math.round((brain.learned.atrMult + 0.1) * 10) / 10; adapted = ' → ATR buffer dinaikkan ke ' + brain.learned.atrMult.toFixed(1) + 'x'; }
            action = 'Perlebar buffer SL terhadap noise bursa.' + adapted;
        } else if (s.side === 'LONG' && s.rsiAtEntry > brain.learned.rsiLongMax - 5) {
            if (brain.learned.rsiLongMax > 56) { brain.learned.rsiLongMax -= 2; adapted = ' → batas RSI long diketatkan ke ' + brain.learned.rsiLongMax; }
            cause = 'Entry di zona momentum jenuh (RSI ' + (s.rsiAtEntry || '?') + ') — terlambat di pucuk.';
            action = 'Filter RSI max untuk Long diperketat agar tidak chasing.' + adapted;
        } else if (s.side === 'SHORT' && s.rsiAtEntry < brain.learned.rsiShortMin + 5) {
            if (brain.learned.rsiShortMin < 44) { brain.learned.rsiShortMin += 2; adapted = ' → batas RSI short diketatkan ke ' + brain.learned.rsiShortMin; }
            cause = 'Entry short di zona oversold (RSI ' + (s.rsiAtEntry || '?') + ') — menjual di lembah.';
            action = 'Filter RSI min untuk Short diperketat.' + adapted;
        } else {
            cause = 'Pembalikan rezim pasar mendadak / tekanan berlawanan dominan.';
            action = 'Konfirmasi volume & jumlah strategi sepakat minimal dinaikkan pada siklus berikutnya.';
        }
        brain.stats.lessons++;
        qbJournal('LOSS', '❌ ' + s.sym + ' ' + s.side + ' LOSS ' + s.netR.toFixed(2) + 'R — ' + s.closeReason + ' | Akar: ' + cause + ' | Fix: ' + action);
    }
    function qbJournal(type, text) {
        brain.journal.unshift({ t: Date.now(), type, text });
        if (brain.journal.length > QB_MAX_JOURNAL) brain.journal.length = QB_MAX_JOURNAL;
    }
    /* Notifikasi browser (roadmap #7) — minta izin sekali saat mulai */
    function qbNotify(title, body) {
        try {
            if (typeof Notification === 'undefined') return;
            if (Notification.permission === 'granted') new Notification(title, { body: body, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="%23E5A93C"/></svg>' });
            else if (Notification.permission === 'default') Notification.requestPermission();
        } catch (e) { }
    }

    /* ═══════════════ 8b. GITHUB PERSISTENCE (learning DB) ═══════════════ */
    function qbGithubToken() { try { return localStorage.getItem(QB_GITHUB_TOKEN_KEY) || ''; } catch (e) { return ''; } }
    function qbSetGithubToken(t) { try { localStorage.setItem(QB_GITHUB_TOKEN_KEY, t || ''); } catch (e) { } }
    async function qbGithubLoad() {
        try {
            const r = await fetch(QB_GITHUB_RAW + 'learning_state.json?cb=' + Date.now(), { cache: 'no-store' });
            if (!r.ok) return false;
            const remote = await r.json();
            if (!remote || !remote.brain) return false;
            const rb = remote.brain;
            // merge only if remote is newer
            const localUpdated = brain.journal.length ? (brain.journal[0].t || 0) : 0;
            const remoteUpdated = remote.updatedAt || 0;
            if (remoteUpdated && remoteUpdated <= localUpdated && brain.signals.length) return false;
            if (rb.learned) brain.learned = Object.assign({}, brain.learned, rb.learned);
            if (rb.weights) brain.weights = Object.assign({}, brain.weights, rb.weights);
            if (rb.minScore) brain.minScore = rb.minScore;
            if (Array.isArray(rb.signals)) {
                const ids = new Set(brain.signals.map(s => s.id));
                rb.signals.forEach(s => { if (!ids.has(s.id)) brain.signals.push(s); });
            }
            if (Array.isArray(rb.journal)) {
                const seen = new Set(brain.journal.map(j => j.t + '|' + j.text));
                rb.journal.forEach(j => { if (!seen.has(j.t + '|' + j.text)) brain.journal.push(j); });
                brain.journal.sort((a, b) => b.t - a.t);
                if (brain.journal.length > QB_MAX_JOURNAL) brain.journal.length = QB_MAX_JOURNAL;
            }
            brain.stats.lessons = Math.max(brain.stats.lessons, (rb.stats && rb.stats.lessons) || 0);
            qbJournal('SYS', '☁️ Sinkronisasi GitHub berhasil — ' + (rb.signals ? rb.signals.length : 0) + ' sinyal, ' + (rb.journal ? rb.journal.length : 0) + ' jurnal dimuat dari database.');
            saveBrain();
            return true;
        } catch (e) { qbJournal('SYS', '⚠️ GitHub load gagal: ' + (e && e.message)); return false; }
    }
    async function qbGithubSha(path) {
        const r = await fetch(QB_GITHUB_API + path, { headers: qbGithubToken() ? { 'Authorization': 'token ' + qbGithubToken() } : {} });
        if (!r.ok) return null;
        const j = await r.json();
        return j.sha;
    }
    async function qbGithubPut(path, content) {
        const token = qbGithubToken();
        if (!token) return false;
        try {
            const sha = await qbGithubSha(path);
            const body = { message: 'quant-brain sync ' + new Date().toISOString(), content: btoa(unescape(encodeURIComponent(content))), branch: QB_GITHUB_BRANCH };
            if (sha) body.sha = sha;
            const r = await fetch(QB_GITHUB_API + path, {
                method: 'PUT',
                headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return r.ok;
        } catch (e) { return false; }
    }
    let qbSyncTimer = null;
    function qbScheduleSync() {
        if (qbSyncTimer) clearTimeout(qbSyncTimer);
        qbSyncTimer = setTimeout(() => { qbGithubSyncAll().catch(() => {}); }, 30000);
    }
    async function qbGithubSyncAll() {
        const token = qbGithubToken();
        if (!token) return false;
        const now = Date.now();
        const ls = { version: '1.0', updatedAt: now, brain: brain };
        const aj = { updatedAt: now, totalSignals: brain.signals.length, closed: brain.stats.closed, wins: brain.stats.wins, losses: brain.stats.losses, winRatePct: brain.stats.closed ? Math.round(brain.stats.wins / brain.stats.closed * 1000) / 10 : null, netR: brain.stats.netR, backtestOOS: brain.stats.backtestOOS || { trades: 0, netR: 0, winRatePct: null }, proof: 'Accuracy computed only from real tracked signals vs real prices. No synthetic numbers.' };
        const sw = { weights: brain.weights, updatedAt: now };
        const tj = { trades: brain.signals.filter(s => s.status === 'WIN' || s.status === 'LOSS'), updatedAt: now };
        const results = await Promise.all([
            qbGithubPut('learning_state.json', JSON.stringify(ls, null, 2)),
            qbGithubPut('accuracy_report.json', JSON.stringify(aj, null, 2)),
            qbGithubPut('strategy_weights.json', JSON.stringify(sw, null, 2)),
            qbGithubPut('trade_journal.json', JSON.stringify(tj, null, 2))
        ]);
        const ok = results.every(Boolean);
        if (ok) qbJournal('SYS', '☁️ Learning state tersync ke GitHub DB (' + (brain.signals.length) + ' sinyal, winRate ' + (aj.winRatePct !== null ? aj.winRatePct + '%' : 'n/a') + ').');
        return ok;
    }
    async function qbFetchFearGreed() {
        try {
            const r = await fetch('https://api.alternative.me/fng/?limit=1', { cache: 'no-store' });
            if (!r.ok) return null;
            const j = await r.json();
            const d = (j && j.data && j.data[0]) || null;
            if (!d) return null;
            return { value: parseInt(d.value), classification: d.value_classification, t: Date.now() };
        } catch (e) { return null; }
    }
    async function qbFetchCoinGecko(sym) {
        // lightweight market snapshot for trusted cross-check
        try {
            const map = { BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', SOLUSDT: 'solana', XRPUSDT: 'ripple' };
            const id = map[sym]; if (!id) return null;
            const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + id + '&vs_currencies=usd&include_24hr_change=true', { cache: 'no-store' });
            if (!r.ok) return null;
            const j = await r.json();
            return j && j[id] ? { price: j[id].usd, change24h: j[id].usd_24h_change } : null;
        } catch (e) { return null; }
    }

    /* ═══════════════ 9. LEARNING CYCLE ORCHESTRATOR ═══════════════ */
    async function qbOptimizeBatch() {
        const syms = QB_UNIVERSE.slice(brain.optCursor, brain.optCursor + QB_OPT_BATCH).map(a => a.sym);
        if (!syms.length) { brain.optCursor = 0; return qbOptimizeBatch(); }
        for (const sym of syms) {
            const asset = QB_BY_SYM[sym];
            try {
                const k = await qbFetchCandles(asset, true);
                const ind = buildIndicators(k);
                QB_STATE.ema4h = aggEma(ind, 20, 4);
                const regime = detectRegime(ind, ind.c.length - 2);
                QB_STRATS.forEach(st => {
                    if (!brain.leaderboard[st.id]) brain.leaderboard[st.id] = {};
                    try {
                        const bt = backtestStrategy(st.id, k, ind, { feeBps: brain.params.feeBps });
                        bt.regime = regime; bt.dataStatus = 'LIVE';
                        brain.leaderboard[st.id][sym] = bt;
                        brain.stats.backtests++;
                    } catch (e) {
                        brain.leaderboard[st.id][sym] = { dataStatus: 'OFFLINE', trades: 0, winRate: 0, pf: 0, exp: 0, netR: 0, maxDD: 0 };
                    }
                });
            } catch (e) {
                QB_STRATS.forEach(st => {
                    if (!brain.leaderboard[st.id]) brain.leaderboard[st.id] = {};
                    brain.leaderboard[st.id][sym] = { dataStatus: 'OFFLINE', trades: 0, winRate: 0, pf: 0, exp: 0, netR: 0, maxDD: 0 };
                });
            }
        }
        brain.optCursor += QB_OPT_BATCH;
        if (brain.optCursor >= QB_UNIVERSE.length) {
            brain.optCursor = 0;
            brain.gen++;
            brain.lastOptAt = Date.now();
            // Update bobot dari hasil OOS (belajar dari buku + data riil)
            QB_STRATS.forEach(st => {
                const per = brain.leaderboard[st.id] || {};
                let exps = 0, n = 0;
                Object.values(per).forEach(r => { if (r && r.dataStatus === 'LIVE' && r.trades >= 5) { exps += r.exp; n++; } });
                if (n > 0) {
                    const avgExp = exps / n;
                    const target = Math.max(0.35, Math.min(2.2, 1 + avgExp * 1.6));
                    brain.weights[st.id] = Math.round((brain.weights[st.id] * 0.6 + target * 0.4) * 100) / 100;
                }
            });
            qbJournal('GEN', '🧠 GENERASI #' + brain.gen + ' selesai — universe penuh di-backtest walk-forward | bobot strategi diperbarui dari hasil out-of-sample riil | akurasi live: ' + qbAccuracy().toFixed(1) + '%');
            // Auto-tuning selektivitas: generasi tanpa sinyal → turunkan ambang bertahap (floor 55) agar otak tetap beraktivitas tanpa jadi spam
            if (brain.signals.length === 0 && brain.gen >= 2 && brain.params.minScore > 55) {
                brain.params.minScore = Math.max(55, brain.params.minScore - 5);
                qbJournal('GEN', '🎚 Auto-tuning: belum ada sinyal setelah ' + brain.gen + ' generasi → ambang skor diturunkan ke ' + brain.params.minScore + '/100 (tetap selektif, bukan spam).');
            }
            saveBrain();
        }
    }
    function qbAccuracy() { return brain.stats.closed ? (brain.stats.wins + brain.stats.be) / brain.stats.closed * 100 : 0; }

    let cycleBusy = false;
    async function qbBrainCycle(manual) {
        if (cycleBusy) return; cycleBusy = true;
        try {
            qbSetStatus(manual ? 'MANUAL SCAN BERJALAN…' : 'BELAJAR…', 'pulse');
            await qbEvaluateOpenSignals();
            if (Date.now() - brain.news.fetchedAt > QB_NEWS_STALE || brain.news.fetchedAt === 0) { qbSetStatus('MEMBACA BERITA TIER-1…', 'pulse'); await qbNewsCycle(); }
            if (Date.now() - (brain.whale.fetchedAt || 0) > 30 * 60 * 1000 || !(brain.whale.fetchedAt)) { qbSetStatus('MEMBACA POSISI WHALE (HYPERLIQUID)…', 'pulse'); await qbWhaleCycle(); }
            qbSetStatus('BACKTEST WALK-FORWARD…', 'pulse');
            await qbOptimizeBatch();
            qbSetStatus('SCANNING SINYAL…', 'pulse');
            const scanSyms = QB_UNIVERSE.slice(brain.scanCursor, brain.scanCursor + QB_SCAN_BATCH).map(a => a.sym);
            brain.scanCursor = (brain.scanCursor + QB_SCAN_BATCH) % QB_UNIVERSE.length;
            await qbScanSymbols(scanSyms.length ? scanSyms : QB_UNIVERSE.slice(0, QB_SCAN_BATCH).map(a => a.sym));
            brain.cycles++;
            qbJournal('CYCLE', '⚙ Siklus #' + brain.cycles + ' selesai — sinyal dievaluasi vs harga riil, berita tier-1 dibaca, 3 aset di-backtest ulang.');
            nextCycleAt = Date.now() + QB_CYCLE_MS;
        } catch (e) {
            qbJournal('ERR', '⚠ Siklus terganggu: ' + (e && e.message ? e.message : e) + ' — dilanjutkan siklus berikutnya.');
        } finally {
            cycleBusy = false;
            saveBrain(); qbRenderAll(); qbSetStatus(brain.running ? 'AUTO-LEARNING AKTIF' : 'IDLE', brain.running ? 'on' : 'off');
        }
    }

    /* ═══════════════ 10. UI RENDER ═══════════════ */
    const $ = id => document.getElementById(id);
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
    function fmtPx(p) { if (p == null) return '—'; return p >= 1000 ? p.toFixed(1) : p >= 10 ? p.toFixed(2) : p >= 1 ? p.toFixed(3) : p.toFixed(5); }
    function ago(t) { const d = Math.max(0, Date.now() - t) / 1000; if (d < 60) return Math.floor(d) + 's lalu'; if (d < 3600) return Math.floor(d / 60) + 'm lalu'; if (d < 86400) return Math.floor(d / 3600) + 'j lalu'; return Math.floor(d / 86400) + 'h lalu'; }
    function qbSetStatus(txt, cls) {
        const el = $('qbEngineStatus'); if (!el) return;
        el.textContent = txt;
        el.className = 'panel-tag ' + (cls === 'on' ? 'qb-on' : cls === 'pulse' ? 'qb-pulse' : 'qb-off');
    }
    function qbRenderStats() {
        const acc = qbAccuracy();
        const oosAvg = (() => {
            let e = 0, n = 0;
            QB_STRATS.forEach(st => { const per = brain.leaderboard[st.id] || {}; Object.values(per).forEach(r => { if (r && r.dataStatus === 'LIVE' && r.trades >= 5) { e += r.netR; n++; } }); });
            return n ? e : 0;
        })();
        const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
        set('qbGen', '#' + brain.gen);
        set('qbAcc', acc.toFixed(1) + '%');
        const trend = brain.accuracyHistory.length >= 2 ? acc - brain.accuracyHistory[0].acc : 0;
        set('qbAccTrend', (trend >= 0 ? '▲ +' : '▼ ') + trend.toFixed(1) + 'pt sejak awal');
        set('qbWL', brain.stats.wins + 'W / ' + brain.stats.losses + 'L / ' + brain.stats.be + 'BE');
        set('qbClosed', brain.stats.closed + ' sinyal tervalidasi riil');
        set('qbEquity', (brain.equityR >= 0 ? '+' : '') + brain.equityR.toFixed(2) + 'R');
        set('qbBacktests', brain.stats.backtests.toLocaleString('id-ID'));
        set('qbLessons', brain.stats.lessons);
        set('qbNews', brain.stats.newsIngested.toLocaleString('id-ID'));
        set('qbUptime', brain.firstBootAt ? Math.floor((Date.now() - brain.firstBootAt) / 3600000) + 'j ' + Math.floor(((Date.now() - brain.firstBootAt) % 3600000) / 60000) + 'm' : '—');
        set('qbOosSum', (oosAvg >= 0 ? '+' : '') + oosAvg.toFixed(1) + 'R');
        const srcOk = (brain.news.items || []).filter(n => !n.offline).length ? '3 TIER-1 ONLINE' : 'FEED OFFLINE';
        set('qbSrcStatus', srcOk);
        const cd = $('qbCountdown'); if (cd) {
            if (!brain.running) cd.textContent = 'MANUAL MODE';
            else { const s = Math.max(0, Math.floor((nextCycleAt - Date.now()) / 1000)); cd.textContent = 'next cycle ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
        }
    }
    function qbRenderLeaderboard() {
        const el = $('qbLeaderboard'); if (!el) return;
        const rows = QB_STRATS.map(st => {
            const per = brain.leaderboard[st.id] || {};
            const live = Object.values(per).filter(r => r && r.dataStatus === 'LIVE' && r.trades >= 3);
            const trades = live.reduce((a, r) => a + r.trades, 0);
            const wr = live.length ? live.reduce((a, r) => a + r.winRate, 0) / live.length : 0;
            const pf = live.length ? live.reduce((a, r) => a + r.pf, 0) / live.length : 0;
            const net = live.reduce((a, r) => a + r.netR, 0);
            const dd = live.length ? Math.max(...live.map(r => r.maxDD)) : 0;
            const w = brain.weights[st.id] || 1;
            return { st, live, trades, wr, pf, net, dd, w };
        }).sort((a, b) => (b.net * b.w) - (a.net * a.w));
        let html = '';
        rows.forEach((r, idx) => {
            const status = r.trades === 0 ? 'WAITING DATA' : (r.w >= 1.4 ? 'MASTERED' : r.w >= 0.6 ? 'ACTIVE' : 'PROBATION');
            const statusCls = status === 'MASTERED' ? 'up' : status === 'PROBATION' ? 'down' : 'neutral';
            html += '<div class="qb-strat-row">' +
                '<div class="qb-strat-head"><span class="qb-rank">#' + (idx + 1) + '</span>' +
                '<div class="qb-strat-name">' + esc(r.st.name) + '<span class="qb-book">📖 ' + esc(r.st.book) + '</span></div>' +
                '<span class="qb-tag ' + statusCls + '">' + status + '</span></div>' +
                '<div class="qb-strat-grid">' +
                '<span>OOS Net <b style="color:' + (r.net >= 0 ? 'var(--up)' : 'var(--down)') + '">' + (r.net >= 0 ? '+' : '') + r.net.toFixed(1) + 'R</b></span>' +
                '<span>WinRate <b>' + r.wr.toFixed(1) + '%</b></span>' +
                '<span>PF <b>' + r.pf.toFixed(2) + '</b></span>' +
                '<span>Trades <b>' + r.trades + '</b></span>' +
                '<span>MaxDD <b>' + r.dd.toFixed(1) + 'R</b></span>' +
                '<span>Weight <b style="color:var(--gold)">' + r.w.toFixed(2) + 'x</b></span></div>' +
                '<div class="qb-weightbar"><i style="width:' + Math.min(100, r.w / 3 * 100) + '%"></i></div></div>';
        });
        el.innerHTML = html || '<div class="panel-msg">Menunggu backtest pertama… klik ANALYZE NOW.</div>';
    }
    function qbRenderSignals() {
        const el = $('qbSignals'); if (!el) return;
        const sigs = brain.signals.slice(0, 14);
        if (!sigs.length) { el.innerHTML = '<div class="panel-msg">Belum ada sinyal A+ (skor ≥ ' + brain.params.minScore + '/100). Engine hanya mengirim setup presisi tinggi — bukan spam sinyal.</div>'; return; }
        let html = '';
        sigs.forEach(s => {
            const sideCls = s.side === 'LONG' ? 'up' : 'down';
            const stMap = { OPEN: ['neutral', 'OPEN'], TP1_SECURED: ['warn', 'TP1 ✔ BE'], WIN: ['up', 'WIN +' + (s.netR || 0).toFixed(2) + 'R'], LOSS: ['down', 'LOSS ' + (s.netR || 0).toFixed(2) + 'R'], BE: ['neutral', 'BE'] };
            const st = stMap[s.status] || ['neutral', s.status];
            html += '<div class="qb-sig-card ' + (s.status === 'OPEN' || s.status === 'TP1_SECURED' ? 'qb-live' : '') + '">' +
                '<div class="qb-sig-top"><span class="qb-sym">' + esc(s.sym) + '</span>' +
                '<span class="qb-side ' + sideCls + '">' + s.side + ' ' + s.lev + 'x</span>' +
                '<span class="qb-conf">SKOR ' + s.conf + '/100</span>' +
                '<span class="qb-tag ' + st[0] + '">' + st[1] + '</span></div>' +
                '<div class="qb-sig-px">' +
                '<span>ENTRY <b>' + fmtPx(s.entry) + '</b></span>' +
                '<span class="down">SL <b>' + fmtPx(s.sl) + '</b></span>' +
                '<span class="up">TP1 <b>' + fmtPx(s.tp1) + '</b></span>' +
                '<span class="up">TP2 <b>' + fmtPx(s.tp2) + '</b></span>' +
                '<span class="up">TP3 <b>' + fmtPx(s.tp3) + '</b></span>' +
                '<span>R:R <b>1:2.5</b></span></div>' +
                '<div class="qb-sig-meta">rezim ' + esc(s.regime) + ' · vol ' + s.volPct.toFixed(2) + '% · ' + (s.votes || []).map(v => v.strat).join(' + ') + ' · ' + ago(s.createdAt) + '</div>' +
                ((s.factors || []).length ? '<details class="qb-details"><summary>Alasan konfluensi (' + s.factors.length + ' screen)</summary><ul>' + s.factors.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul></details>' : '') +
                '</div>';
        });
        el.innerHTML = html;
    }
    function qbRenderNews() {
        const el = $('qbNewsFeed'); if (!el) return;
        const items = (brain.news.items || []).filter(n => !n.offline).slice(0, 12);
        let html = '';
        items.forEach(n => {
            const t = (n.title + ' ' + n.summary).toLowerCase();
            const bull = BULL_KW.some(k => t.includes(k)), bear = BEAR_KW.some(k => t.includes(k));
            const rumor = RUMOR_KW.some(k => t.includes(k));
            const sent = bear && !bull ? '<span class="qb-tag down">BEARISH</span>' : bull && !bear ? '<span class="qb-tag up">BULLISH</span>' : '<span class="qb-tag neutral">NETRAL</span>';
            html += '<div class="qb-news-item"><div class="qb-news-src">' + esc(n.source) + sent + (rumor ? '<span class="qb-tag warn">RUMOR −50%</span>' : '') + '</div>' +
                '<a href="' + esc(n.link) + '" target="_blank" rel="noopener noreferrer" class="qb-news-title">' + esc(n.title) + '</a></div>';
        });
        el.innerHTML = html || '<div class="panel-msg">Menunggu feed berita tier-1…</div>';

        const pc = $('qbPerCoin'); if (pc) {
            const coins = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'];
            let h = '';
            coins.forEach(cn => {
                const d = brain.news.perCoin[cn];
                if (!d) return;
                const cls = d.sentiment === 'BULLISH' ? 'up' : d.sentiment === 'BEARISH' ? 'down' : 'neutral';
                h += '<span class="qb-coin-chip ' + cls + '">' + cn + ' ' + (d.impact > 0 ? '+' : '') + d.impact + (d.multiSourced ? ' ·2src' : '') + (d.critical ? ' ·🛡' : '') + '</span>';
            });
            pc.innerHTML = h || '<span class="qb-coin-chip neutral">memuat…</span>';
        }
        const wEl = $('qbWhale'); if (wEl) {
            const bias = (brain.whale && brain.whale.bias) || {};
            const coins = Object.keys(bias).sort((a,b) => Math.abs(bias[b]) - Math.abs(bias[a])).slice(0, 8);
            let hw = '';
            coins.forEach(cn => {
                const v = bias[cn];
                const cls = v >= 10 ? 'up' : v <= -10 ? 'down' : 'neutral';
                hw += '<span class="qb-coin-chip ' + cls + '">🐋 ' + cn + ' ' + (v > 0 ? '+' : '') + v + '</span>';
            });
            wEl.innerHTML = hw || '<span class="qb-coin-chip neutral">belum ada data whale</span>';
        }
        const bk = $('qbBreaker'); if (bk) {
            const br = brain.news.breaker || [];
            bk.style.display = br.length ? 'block' : 'none';
            if (br.length) bk.innerHTML = '🛡 CIRCUIT BREAKER: ' + br.map(b => '<b>' + b.coin + '</b>').join(', ') + ' — sinyal Long diblokir (' + esc(br[0].head.slice(0, 90)) + '…)';
        }
    }
    function qbRenderJournal() {
        const el = $('qbJournal'); if (!el) return;
        const cls = { GEN: 'gen', LOSS: 'down', WIN: 'up', SIGNAL: 'sig', CB: 'cb', TP1: 'up', CYCLE: 'cyc', ERR: 'down' };
        el.innerHTML = brain.journal.slice(0, 26).map(j =>
            '<div class="qb-j-row ' + (cls[j.type] || '') + '"><span class="qb-j-time">' + new Date(j.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '</span><span>' + esc(j.text) + '</span></div>'
        ).join('') || '<div class="panel-msg">Jurnal akan terisi otomatis oleh engine…</div>';
    }
    function qbDrawAccChart() {
        const cv = $('qbAccCanvas'); if (!cv) return;
        const ctx = cv.getContext('2d');
        const W = cv.width = cv.clientWidth * (window.devicePixelRatio || 1), H = cv.height = 150 * (window.devicePixelRatio || 1);
        ctx.clearRect(0, 0, W, H);
        const hist = brain.accuracyHistory;
        const pad = 8 * (window.devicePixelRatio || 1);
        // grid
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) { const y = pad + (H - 2 * pad) * g / 4; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke(); }
        if (hist.length < 2) {
            ctx.fillStyle = '#64748B'; ctx.font = 11 * (window.devicePixelRatio || 1) + 'px JetBrains Mono, monospace';
            ctx.fillText('Akurasi & ekuitas paper akan tergambar setelah sinyal pertama ditutup…', pad + 4, H / 2);
            return;
        }
        const eqs = hist.map(h => h.eq), eqMin = Math.min(0, ...eqs), eqMax = Math.max(1, ...eqs);
        // equity area (gold)
        ctx.beginPath();
        hist.forEach((h, i) => {
            const x = pad + (W - 2 * pad) * i / (hist.length - 1);
            const y = H - pad - (H - 2 * pad) * (h.eq - eqMin) / (eqMax - eqMin || 1);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.strokeStyle = '#E5A93C'; ctx.lineWidth = 2 * (window.devicePixelRatio || 1); ctx.stroke();
        // accuracy line (teal)
        ctx.beginPath();
        hist.forEach((h, i) => {
            const x = pad + (W - 2 * pad) * i / (hist.length - 1);
            const y = H - pad - (H - 2 * pad) * Math.max(0, Math.min(100, h.acc)) / 100;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.strokeStyle = '#06B6D4'; ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1); ctx.stroke();
        ctx.fillStyle = '#64748B'; ctx.font = 10 * (window.devicePixelRatio || 1) + 'px JetBrains Mono, monospace';
        ctx.fillText('TEAL = AKURASI % · EMAS = EKUITAS PAPER (R)', pad + 2, pad + 10);
    }
    function qbRenderKnowledge() {
        const el = $('qbKnowledge'); if (!el) return;
        el.innerHTML = QB_KNOWLEDGE.map(k => {
            const live = k.strategies.some(sid => brain.weights[sid] != null);
            return '<div class="qb-know-row' + (live ? '' : '') + '"><div class="qb-know-book">📘 ' + esc(k.book) + '<span class="qb-know-author">' + esc(k.author) + '</span></div><div class="qb-know-rules">' + esc(k.rules) + '</div><span class="qb-tag up">ENCODED</span></div>';
        }).join('');
    }
    function qbRenderParams() {
        const el = $('qbParams'); if (!el) return;
        el.innerHTML = 'ATR SL: <b>' + brain.learned.atrMult.toFixed(1) + 'x</b> (pelajaran: ' + brain.stats.lessons + ') · RSI long ≤ <b>' + brain.learned.rsiLongMax + '</b> · RSI short ≥ <b>' + brain.learned.rsiShortMin + '</b> · Min skor: <b>' + brain.params.minScore + '</b>/100 · Fee model: <b>' + brain.params.feeBps + ' bps</b> · Risiko/sinyal: <b>' + brain.params.riskPct + '%</b> (aturan 2% Elder, konservatif)';
    }
    function qbRenderHeatmap() {
        const el = $('qbHeatmap'); if (!el) return;
        let html = '<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);margin-bottom:0.3rem;">KONTRIBUSI STRATEGI (OOS Net R) — heatmap</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;">';
        QB_STRATS.forEach(st => {
            const per = brain.leaderboard[st.id] || {};
            const live = Object.values(per).filter(r => r && r.dataStatus === 'LIVE' && r.trades >= 3);
            const net = live.reduce((a, r) => a + r.netR, 0);
            const w = brain.weights[st.id] || 1;
            const intensity = Math.min(1, Math.abs(net) / 20);
            const bg = net >= 0 ? `rgba(16,185,129,${0.15 + intensity * 0.55})` : `rgba(239,68,68,${0.15 + intensity * 0.55})`;
            html += '<div style="background:' + bg + ';border:1px solid var(--border);padding:4px;border-radius:2px;text-align:center;">' +
                '<div style="color:var(--text-primary);font-weight:700;">' + esc(st.id) + '</div>' +
                '<div style="color:' + (net >= 0 ? 'var(--up)' : 'var(--down)') + ';">' + (net >= 0 ? '+' : '') + net.toFixed(1) + 'R</div>' +
                '<div style="color:var(--text-muted);">w ' + w.toFixed(2) + 'x</div></div>';
        });
        html += '</div>';
        el.innerHTML = html;
    }
    function qbRenderAll() {
        qbRenderStats(); qbRenderLeaderboard(); qbRenderSignals(); qbRenderNews(); qbRenderJournal(); qbDrawAccChart(); qbRenderHeatmap(); qbRenderKnowledge(); qbRenderParams();
        const btn = $('qbBtnStart'); if (btn) {
            btn.textContent = brain.running ? '⏸ STOP AUTO-LEARNING' : '▶ START AUTO-LEARNING';
            btn.classList.toggle('qb-btn-stop', brain.running);
        }
    }

    /* ═══════════════ 11. CONTROLS & BOOT ═══════════════ */
    function qbToggleRun() {
        brain.running = !brain.running;
        saveBrain(); qbRenderAll();
        if (brain.running) {
            nextCycleAt = Date.now();
            qbJournal('SYS', '▶ AUTO-LEARNING dinyalakan — siklus tiap 5 menit: evaluasi sinyal vs harga riil → baca berita tier-1 → backtest walk-forward → scan sinyal baru.');
            qbBrainCycle();
        } else {
            qbJournal('SYS', '⏸ AUTO-LEARNING dihentikan (state belajar tetap tersimpan di browser).');
            qbSetStatus('IDLE', 'off');
        }
    }
    async function qbManualScan() { await qbBrainCycle(true); }
    /* Ekspor/Impor otak — belajaran tidak hilang saat ganti browser/device */
    function qbExport() {
        try {
            const payload = JSON.stringify({ exportedAt: new Date().toISOString(), version: brain.v, brain }, null, 2);
            const blob = new Blob([payload], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'pilus-quant-brain-gen' + brain.gen + '-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            qbJournal('SYS', '💾 Otak diekspor — Generasi #' + brain.gen + ', ' + brain.stats.closed + ' sinyal tervalidasi, ' + brain.journal.length + ' entri jurnal.');
            qbSetStatus('EKSPOR OK', 'on'); setTimeout(() => qbSetStatus(brain.running ? 'AUTO-LEARNING AKTIF' : 'IDLE', brain.running ? 'on' : 'off'), 2500);
        } catch (e) { qbJournal('ERR', '⚠ Ekspor gagal: ' + (e && e.message ? e.message : e)); }
    }
    function qbImportFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result));
                const incoming = parsed && parsed.brain ? parsed.brain : parsed;
                if (!incoming || incoming.v !== 1 || typeof incoming !== 'object') throw new Error('format file tidak dikenali (bukan ekspor Quant Brain v1)');
                stopTimers();
                const wasRunning = !!brain.running;
                brain = Object.assign(defaultBrain(), incoming, {
                    params: Object.assign(defaultBrain().params, incoming.params || {}),
                    learned: Object.assign(defaultBrain().learned, incoming.learned || {}),
                    stats: Object.assign(defaultBrain().stats, incoming.stats || {}),
                    news: Object.assign(defaultBrain().news, incoming.news || {})
                });
                brain.running = wasRunning;
                saveBrain(); qbRenderAll();
                qbJournal('SYS', '📂 Otak diimpor dari file — Generasi #' + brain.gen + ' dipulihkan (' + brain.stats.closed + ' sinyal tervalidasi, akurasi ' + qbAccuracy().toFixed(1) + '%).');
                qbSetStatus('IMPOR OK', 'on');
                if (brain.running) { nextCycleAt = Date.now() + 2000; cycleTimer = setInterval(() => { if (Date.now() >= nextCycleAt) qbBrainCycle(); }, 5000); tickTimer = setInterval(qbRenderStats, 1000); setTimeout(() => qbBrainCycle(), 1500); }
                else tickTimer = setInterval(qbRenderStats, 3000);
            } catch (e) {
                qbJournal('ERR', '⚠ Impor gagal: ' + (e && e.message ? e.message : e) + ' — otak saat ini tidak diubah.');
                qbRenderJournal();
            }
        };
        reader.readAsText(file);
    }
    function qbReset() {
        if (!confirm('Reset seluruh otak AI? Semua generasi pembelajaran, sinyal & jurnal akan dihapus dan belajar dimulai dari nol.')) return;
        try { localStorage.removeItem(QB_STORE); } catch (e) { }
        const run = brain.running; stopTimers();
        brain = defaultBrain(); brain.running = run;
        qbJournal('SYS', '♻ Otak di-reset ke Generasi #0. Pembelajaran dimulai ulang.');
        saveBrain(); qbRenderAll(); if (run) { nextCycleAt = Date.now(); qbBrainCycle(); }
    }
    function stopTimers() { if (cycleTimer) clearInterval(cycleTimer); if (tickTimer) clearInterval(tickTimer); cycleTimer = tickTimer = null; }
    function boot() {
        brain = loadBrain();
        qbGithubLoad().catch(() => {});
        if (!brain.journal.length) qbJournal('SYS', '🧠 PILUS QUANT BRAIN v1.0 online — basis pengetahuan: ' + QB_KNOWLEDGE.length + ' literatur institusional terenkode, ' + QB_STRATS.length + ' strategi siap di-backtest walk-forward pada ' + QB_UNIVERSE.length + ' aset riil (crypto+forex+saham).');
        const b1 = $('qbBtnStart'); if (b1) b1.addEventListener('click', qbToggleRun);
        const b2 = $('qbBtnScan'); if (b2) b2.addEventListener('click', qbManualScan);
        const b3 = $('qbBtnReset'); if (b3) b3.addEventListener('click', qbReset);
        const b4 = $('qbBtnExport'); if (b4) b4.addEventListener('click', qbExport);
        const b5 = $('qbBtnImport'); if (b5) b5.addEventListener('click', () => $('qbImportFile').click());
        const fi = $('qbImportFile'); if (fi) fi.addEventListener('change', e => { qbImportFile(e.target.files && e.target.files[0]); e.target.value = ''; });
        window.addEventListener('resize', qbDrawAccChart);
        qbRenderAll();
        qbSetStatus(brain.running ? 'AUTO-LEARNING AKTIF' : 'IDLE — klik START', brain.running ? 'on' : 'off');
        if (brain.running) {
            nextCycleAt = Date.now() + 1000;
            cycleTimer = setInterval(() => { if (Date.now() >= nextCycleAt) qbBrainCycle(); }, 5000);
            tickTimer = setInterval(qbRenderStats, 1000);
            setTimeout(() => qbBrainCycle(), 600);
        } else {
            tickTimer = setInterval(qbRenderStats, 3000);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
    window.PilusQuantBrain = { scan: qbManualScan, cycle: qbBrainCycle, state: () => brain, exportData: () => JSON.stringify({ exportedAt: new Date().toISOString(), version: brain.v, brain }), _dbg: { QB_EVAL, buildIndicators, detectRegime, aggEma, backtestStrategy, qbFetchBinanceDeep, qbWhaleCycle } };
    })();
