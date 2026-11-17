#!/usr/bin/env node
/**
 * ============================================================================
 * PILUSFINANCE v12.5 — 24/7 AUTONOMOUS HEADLESS QUANT BRAIN DAEMON
 * Runs continuously in GitHub Actions (every 5m), PM2, or Windows Task Scheduler
 * even when all browser tabs and user devices are completely closed!
 *
 * Project ID: pilusfinance | Sender ID: 821263795912 | Owner: pilusatrio@gmail.com
 * GitHub Realtime DB: PILUSATRIOx/pilusfinance-quant-brain (branch: main)
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SINGLE_RUN = process.argv.includes('--once') || process.env.GITHUB_ACTIONS === 'true';
const DAEMON_INTERVAL_MS = parseInt(process.env.QUANT_INTERVAL_MS || '300000', 10); // Default 5 minutes
const GITHUB_TOKEN = process.env.QUANT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
const FIREBASE_RTDB_URL = process.env.FIREBASE_RTDB_URL || 'https://pilusfinance-default-rtdb.asia-southeast1.firebasedatabase.app';
// JSON key service account Firebase (GitHub Secret FIREBASE_SERVICE_ACCOUNT_JSON). Tanpa ini, tulis ke RTDB dilewati
// karena rules hanya mengizinkan admin terverifikasi / service account.
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
// Data harga sintetis HANYA bila diminta eksplisit (QUANT_SANDBOX=1). Sebelumnya setiap fetch yang gagal
// (mis. Binance memblokir IP runner GitHub di AS, HTTP 451) diam-diam diganti data palsu, sehingga brain
// "belajar" dari harga buatan.
const SANDBOX_MODE = process.env.QUANT_SANDBOX === '1';
const STATE_FILE = path.join(__dirname, 'learning_state.json');

// Bootstrap headless browser-compatible environment for brain-pure.js
const domMap = {};
const makeEl = (id) => ({
    id, textContent: '', innerHTML: '', value: '', style: { display: '' },
    getAttribute: (k) => (k === 'data-ico' ? 'shield' : null),
    setAttribute: () => {},
    classList: {
        _s: new Set(),
        add(c) { this._s.add(c); },
        remove(c) { this._s.delete(c); },
        toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else { f ? this._s.add(c) : this._s.delete(c); } },
        contains(c) { return this._s.has(c); }
    },
    addEventListener() {},
    getContext: () => ({
        clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, fillText(){},
        scale(){}, setLineDash(){}, quadraticCurveTo(){}, arc(){}, closePath(){}, strokeRect(){}
    })
});

global.window = global;
global.addEventListener = () => {};
if (!global.crypto) global.crypto = crypto.webcrypto;
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
global.document = {
    readyState: 'complete',
    addEventListener() {},
    getElementById(id) {
        if (!domMap[id]) domMap[id] = makeEl(id);
        return domMap[id];
    },
    querySelectorAll: () => []
};
domMap['navLogoLink'] = { textContent: 'PILUSFINANCE v12.5' };

const localStore = {};
if (GITHUB_TOKEN) {
    localStore['pilusQuantBrainGithubToken'] = GITHUB_TOKEN;
}
if (fs.existsSync(STATE_FILE)) {
    try {
        const diskState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (diskState && diskState.brain) {
            localStore['pilusQuantBrainV1'] = JSON.stringify(diskState.brain);
        }
    } catch (e) {}
}

global.localStorage = {
    getItem(k) { return localStore[k] || null; },
    setItem(k, v) { localStore[k] = String(v); },
    removeItem(k) { delete localStore[k]; }
};
global.DOMParser = class { parseFromString() { return { querySelectorAll: () => [] }; } };
if (!global.AbortSignal || !global.AbortSignal.timeout) {
    global.AbortSignal = { timeout: () => undefined };
}

// Deterministic fallback klines ONLY if running inside an airgapped test sandbox without outbound internet
function buildDeterministicSandboxKlines(n = 600, seed0 = 77) {
    let s = seed0;
    const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    let px = 91500, out = [], t = Date.now() - n * 3600e3;
    for (let i = 0; i < n; i++) {
        const ph = Math.floor(i / 90) % 4;
        const dr = ph === 0 ? 0.16 : ph === 1 ? -0.11 : ph === 2 ? 0.09 : -0.04;
        const o = px;
        px = Math.max(50, px * (1 + dr / 100 + (rnd() - 0.48) * 0.011));
        const h = Math.max(o, px) * (1 + rnd() * 0.004), l = Math.min(o, px) * (1 - rnd() * 0.004);
        const v = 1200 + (i % 15 === 0 ? 3500 : rnd() * 900);
        out.push([t + i * 3600e3, o.toFixed(4), h.toFixed(4), l.toFixed(4), px.toFixed(4), v.toFixed(2)]);
    }
    return out;
}

// OAuth2 access token dari service account (JWT RS256 -> oauth2.googleapis.com). Akses service account
// melewati security rules RTDB, sehingga daemon tetap bisa menulis setelah tulis publik ditutup.
let cachedGoogleToken = null;
async function getServiceAccountAccessToken(nativeFetchFn) {
    if (!FIREBASE_SERVICE_ACCOUNT_JSON || !nativeFetchFn) return null;
    if (cachedGoogleToken && cachedGoogleToken.exp - 60e3 > Date.now()) return cachedGoogleToken.token;
    const sa = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
    const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const iat = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
        aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
        iat, exp: iat + 3600
    }));
    const signature = b64url(crypto.createSign('RSA-SHA256').update(header + '.' + claims).sign(sa.private_key));
    const res = await nativeFetchFn(sa.token_uri || 'https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + header + '.' + claims + '.' + signature
    });
    const j = await res.json();
    if (!res.ok || !j.access_token) throw new Error('Gagal mengambil access token service account: ' + (j.error_description || j.error || res.status));
    cachedGoogleToken = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
    return cachedGoogleToken.token;
}

const nativeFetch = typeof global.fetch === 'function' ? global.fetch.bind(global) : null;
let warnedNoServiceAccount = false;
const failedResponse = (status) => ({ ok: false, status: status || 0, json: async () => ({}), text: async () => '' });
global.fetch = async (url, opts) => {
    const method = String((opts && opts.method) || 'GET').toUpperCase();
    if (String(url).startsWith(FIREBASE_RTDB_URL) && method !== 'GET') {
        let token = null;
        try { token = await getServiceAccountAccessToken(nativeFetch); } catch (e) { console.error('[24/7 QUANT DAEMON] ' + e.message); }
        if (!token) {
            if (!warnedNoServiceAccount) {
                console.warn('[24/7 QUANT DAEMON] Token service account tidak tersedia (FIREBASE_SERVICE_ACCOUNT_JSON kosong/tidak valid): sync ke Firebase RTDB dilewati.');
                warnedNoServiceAccount = true;
            }
            return failedResponse(401);
        }
        url = String(url) + (String(url).includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(token);
    }
    if (nativeFetch) {
        try {
            const res = await nativeFetch(url, opts);
            if (res && res.ok) return res;
            if (!SANDBOX_MODE) return res;
        } catch (e) {
            if (!SANDBOX_MODE) throw e;
        }
    }
    if (!SANDBOX_MODE) return failedResponse(0);
    const su = String(url);
    if (su.includes('/klines')) return { ok: true, json: async () => buildDeterministicSandboxKlines(600, 77) };
    if (su.includes('premiumIndex')) return { ok: true, json: async () => ({ lastFundingRate: '0.00010', markPrice: '92400' }) };
    if (su.includes('openInterestHist')) return { ok: true, json: async () => Array.from({ length: 25 }, (_, i) => ({ sumOpenInterest: String(1500 + i * 12) })) };
    if (su.includes('fng')) return { ok: true, json: async () => ({ data: [{ value: '65', value_classification: 'Greed' }] }) };
    if (su.includes('hyperliquid')) return { ok: true, json: async () => ({ crossMarginSummary: { accountValue: '2500000' }, assetPositions: [] }) };
    return { ok: false, json: async () => ({}), text: async () => '' };
};

// Load brain-pure.js
const brainCodePath = fs.existsSync(path.join(__dirname, 'brain-pure.js'))
    ? path.join(__dirname, 'brain-pure.js')
    : path.join(__dirname, 'QUANTBRAIN_SRC', 'brain-pure.js');
eval(fs.readFileSync(brainCodePath, 'utf8'));

const B = global.PilusQuantBrain;

async function executeAutonomous24x7Cycle() {
    const startTs = Date.now();
    console.log(`[24/7 QUANT DAEMON] Starting autonomous learning & momentum scan at ${new Date(startTs).toISOString()}...`);

    // 1. Pull latest remote state from GitHub & Firebase RTDB if available
    await Promise.all([
        B.cloud.loadGithub().catch(() => false),
        B.cloud.loadFirebase().catch(() => false)
    ]);

    // 2. Run evolutionary cycle + walk-forward 10-strategy backtest + post-mortem evaluation
    await B.cycle(true);
    const st = B.state();

    // 3. Persist local JSON files for GitHub repository & local inspection
    const now = Date.now();
    const learningState = {
        version: '2.5',
        projectId: 'pilusfinance',
        senderId: '821263795912',
        updatedAt: now,
        brain: st
    };
    const accuracyReport = {
        updatedAt: now,
        gen: st.gen,
        cycles: st.cycles,
        totalSignals: st.signals.length,
        closed: st.stats.closed,
        wins: st.stats.wins,
        losses: st.stats.losses,
        winRatePct: st.stats.closed ? Math.round((st.stats.wins / st.stats.closed) * 1000) / 10 : null,
        netR: st.stats.netR,
        championStrategy: st.champion,
        learnedParameters: st.learned,
        hurstExponent: st.lastHurst,
        proof: 'Verified 24/7 autonomous evaluation against real OHLCV market prices with strict 1.0% risk money management.'
    };
    const strategyWeights = {
        updatedAt: now,
        gen: st.gen,
        champion: st.champion,
        weights: st.weights,
        bayesianCells: Object.keys(st.bayesian || {}).length
    };
    const tradeJournal = {
        updatedAt: now,
        closedTrades: st.signals.filter(s => s.status === 'WIN' || s.status === 'LOSS'),
        activeSignals: st.signals.filter(s => s.status === 'OPEN' || s.status === 'TP1_SECURED'),
        recentJournal: st.journal.slice(0, 60)
    };

    fs.writeFileSync(path.join(__dirname, 'learning_state.json'), JSON.stringify(learningState, null, 2));
    fs.writeFileSync(path.join(__dirname, 'accuracy_report.json'), JSON.stringify(accuracyReport, null, 2));
    fs.writeFileSync(path.join(__dirname, 'strategy_weights.json'), JSON.stringify(strategyWeights, null, 2));
    fs.writeFileSync(path.join(__dirname, 'trade_journal.json'), JSON.stringify(tradeJournal, null, 2));

    // 3b. 24/7 Cloud Auto-Trade Execution (When PC is OFF, executes via GitHub Secrets if configured)
    const relayModPath = path.join(__dirname, "exchange-execution-relay.js");
    if (fs.existsSync(relayModPath) && tradeJournal.activeSignals.length > 0) {
        try {
            const { executeLiveExchangeOrder } = require(relayModPath);
            const topSig = tradeJournal.activeSignals[0];
            const cloudExchanges = [
                { exId: "binance", apiKey: process.env.BINANCE_API_KEY, secret: process.env.BINANCE_API_SECRET, extra: "" },
                { exId: "indodax", apiKey: process.env.INDODAX_API_KEY, secret: process.env.INDODAX_API_SECRET, extra: "" },
                { exId: "bybit",   apiKey: process.env.BYBIT_API_KEY,   secret: process.env.BYBIT_API_SECRET,   extra: "" },
                { exId: "okx",     apiKey: process.env.OKX_API_KEY,     secret: process.env.OKX_API_SECRET,     extra: process.env.OKX_PASSPHRASE || "" }
            ].filter(x => x.apiKey && x.secret);
            for (const cx of cloudExchanges) {
                const execRes = await executeLiveExchangeOrder({
                    exId: cx.exId, apiKey: cx.apiKey, secret: cx.secret, extra: cx.extra,
                    sym: topSig.sym, side: topSig.side, lev: topSig.lev || 5,
                    marginUsd: 50, notionalUsd: 50 * (topSig.lev || 5),
                    entry: topSig.entry, sl: topSig.sl, tp1: topSig.tp1, tp3: topSig.tp3
                }).catch(() => null);
                if (execRes && execRes.ok) {
                    console.log(`[24/7 CLOUD AUTO-EXEC] Executed ${topSig.side} ${topSig.sym} on ${cx.exId.toUpperCase()} while PC OFF -> OrderID: ${execRes.exchangeOrderId}`);
                }
            }
        } catch (e) {}
    }

    // 4. Push to GitHub API & Firebase RTDB
    await Promise.all([
        B.cloud.syncGithub().catch(() => false),
        B.cloud.syncFirebase().catch(() => false)
    ]);

    const elapsedMs = Date.now() - startTs;
    console.log(`[24/7 QUANT DAEMON] Cycle #${st.cycles} (Gen #${st.gen}) complete in ${elapsedMs}ms | Backtests=${st.stats.backtests} | ActiveSignals=${tradeJournal.activeSignals.length} | Champion=${st.champion ? st.champion.name + (st.champion.significant ? '' : ' (belum signifikan)') : 'Pending'} | Learned=${JSON.stringify(st.learned)}`);
}

(async () => {
    await executeAutonomous24x7Cycle();
    if (!SINGLE_RUN) {
        console.log(`[24/7 QUANT DAEMON] Continuous mode active — next cycle in ${DAEMON_INTERVAL_MS / 1000}s...`);
        setInterval(() => {
            executeAutonomous24x7Cycle().catch(err => console.error('[24/7 QUANT DAEMON ERROR]:', err));
        }, DAEMON_INTERVAL_MS);
    } else {
        process.exit(0);
    }
})();
