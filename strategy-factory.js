'use strict';
/* ═══════════════════════════════════════════════════════════════════════════════════════════
   PABRIK STRATEGI 24/7 — riset berkelanjutan yang jujur secara statistik

   Setiap hari (setelah candle harian UTC ditutup) pabrik ini:
   1. Mengambil candle harian + funding rate aktual 20 kripto (Binance USDT-M).
   2. Menguji ulang semua kandidat strategi dari keluarga yang bersumber riset ber-peer-review,
      lalu MENAMBAH beberapa kandidat baru (eksplorasi). Setiap kandidat = 1 percobaan yang dihitung.
   3. Menilai dengan Deflated Sharpe Ratio (memperhitungkan SEMUA percobaan) dan Probability of
      Backtest Overfitting (CSCV). Makin banyak yang dicoba, makin tinggi syarat lolosnya.
   4. Kandidat yang lolos masuk INKUBASI: paper-trading ke depan pada data yang belum ada saat didaftarkan.
   5. Hanya yang konsisten di inkubasi yang dipromosikan ke portofolio, dengan money management ketat
      (vol target, ramp-up bertahap, batas per aset, rem drawdown -10%, kill switch -20%).
   Tidak ada eksekusi order di modul ini: keluarannya bobot target portofolio (paper) untuk ditinjau.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */

const DAY = 86400000;
const UNIVERSE = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'SOL', 'LINK', 'LTC', 'BCH', 'DOT', 'AVAX', 'TRX', 'ETC', 'XLM', 'ATOM', 'UNI', 'FIL', 'NEAR', 'AAVE'].map(c => c + 'USDT');

const CONFIG = {
    dataStart: Date.UTC(2019, 9, 1),
    costPerSide: 15 / 10000,          // fee 10 bps + slippage 5 bps
    targetVolAsset: 0.5, maxScaleAsset: 2, volWin: 30,
    maxTrials: 1000, explorePerDay: 4,
    incubationSlots: 8, minFwdDaysPromote: 90, maxIncubationDays: 365,
    dsrMin: 0.95, pboMax: 0.5, btMddMin: -0.40, minCorrDiversity: 0.8,
    promoteMinSharpe: 0.5, promoteMinMdd: -0.20, promoteConsistencyZ: -1.0,
    retireMinDays: 60, retireSharpe: -1.0, retireMdd: -0.25,
    portfolioTargetVol: 0.15, maxGross: 1.5, maxAssetWeight: 0.25,
    ddHalf: -0.10, ddKill: -0.20, rampDays: 365,
    runAfterUtcMin: 10, pboBlocks: 8,
    carryCapitalFactor: 1.25        // carry butuh modal spot (100%) + margin perpetual (~25%)
};

// Sumber terpercaya (publikasi ber-peer-review / working paper bank sentral) untuk setiap keluarga & metode.
const SOURCES = {
    TSMOM: 'Moskowitz, Ooi & Pedersen (2012), "Time Series Momentum", Journal of Financial Economics',
    TREND: 'Hurst, Ooi & Pedersen (2017), "A Century of Evidence on Trend-Following Investing", Journal of Portfolio Management',
    SMA: 'Faber (2007), "A Quantitative Approach to Tactical Asset Allocation", Journal of Wealth Management',
    XSMOM: 'Jegadeesh & Titman (1993), Journal of Finance; Liu, Tsyvinski & Wu (2022), "Common Risk Factors in Cryptocurrency", Journal of Finance',
    CARRY: 'Schmeling, Schrimpf & Todorov (2023), "Crypto Carry", BIS Working Paper',
    VOLTARGET: 'Moreira & Muir (2017), "Volatility-Managed Portfolios", Journal of Finance',
    DSR: 'Bailey & Lopez de Prado (2014), "The Deflated Sharpe Ratio", Journal of Portfolio Management',
    PBO: 'Bailey, Borwein, Lopez de Prado & Zhu (2017), "The Probability of Backtest Overfitting", Journal of Computational Finance',
    SRSE: 'Lo (2002), "The Statistics of Sharpe Ratios", Financial Analysts Journal'
};
const FAMILY_SOURCE = { TSMOM: 'TSMOM', SMA: 'SMA', MAX: 'TREND', DONCH: 'TREND', XSMOM: 'XSMOM', CARRY: 'CARRY' };

/* ─────────────────────────── utilitas numerik ─────────────────────────── */
function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
}
function normCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
// Acklam: invers CDF normal standar (galat relatif < 1.2e-9)
function invNorm(p) {
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const plow = 0.02425;
    if (p < plow) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - plow) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
const sign = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
const round = (x, k) => (Number.isFinite(x) ? Math.round(x * Math.pow(10, k)) / Math.pow(10, k) : null);
function utcDayStr(ms) { return new Date(ms).toISOString().slice(0, 10); }
function mulberry32(seed) {
    return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ─────────────────────────── statistik performa ─────────────────────────── */
function seriesStats(r) {
    const n = r.length;
    if (n < 2) return null;
    let sum = 0; for (const x of r) sum += x;
    const mean = sum / n;
    let m2 = 0, m3 = 0, m4 = 0;
    for (const x of r) { const d = x - mean; const d2 = d * d; m2 += d2; m3 += d2 * d; m4 += d2 * d2; }
    m2 /= n; m3 /= n; m4 /= n;
    const sd = Math.sqrt(m2 * n / (n - 1));
    let eq = 1, peak = 1, mdd = 0;
    for (const x of r) { eq *= 1 + x; if (eq > peak) peak = eq; const dd = eq / peak - 1; if (dd < mdd) mdd = dd; }
    const years = n / 365;
    const srDaily = sd > 0 ? mean / sd : 0;
    return {
        n, mean, sd, srDaily, sharpe: srDaily * Math.sqrt(365),
        skew: m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0, kurt: m2 > 0 ? m4 / (m2 * m2) : 3,
        totalRet: eq - 1, cagr: eq > 0 ? Math.pow(eq, 1 / years) - 1 : -1, mdd, years
    };
}

// Deflated Sharpe Ratio (Bailey & Lopez de Prado 2014). SR per periode (harian).
function expectedMaxSR(srVariance, nTrials) {
    const g = 0.5772156649, N = Math.max(2, nTrials);
    return Math.sqrt(Math.max(0, srVariance)) * ((1 - g) * invNorm(1 - 1 / N) + g * invNorm(1 - 1 / (N * Math.E)));
}
function deflatedSharpe(st, srVariance, nTrials) {
    if (!st || st.n < 30) return 0;
    const sr0 = expectedMaxSR(srVariance, nTrials);
    const den = Math.sqrt(Math.max(1e-9, 1 - st.skew * st.srDaily + ((st.kurt - 1) / 4) * st.srDaily * st.srDaily));
    return normCdf((st.srDaily - sr0) * Math.sqrt(st.n - 1) / den);
}

function combinations(n, k) {
    const out = [], cur = [];
    (function rec(start) {
        if (cur.length === k) { out.push(cur.slice()); return; }
        for (let i = start; i < n; i++) { cur.push(i); rec(i + 1); cur.pop(); }
    })(0);
    return out;
}
// Probability of Backtest Overfitting via Combinatorially Symmetric Cross-Validation (Bailey et al. 2017).
function computePBO(seriesList, S) {
    S = S || CONFIG.pboBlocks;
    const N = seriesList.length;
    if (N < 4) return null;
    const T = seriesList[0].length;
    if (T < S * 30) return null;
    const B = Math.floor(T / S);
    const agg = seriesList.map(r => {
        const a = [];
        for (let b = 0; b < S; b++) {
            let sum = 0, sq = 0; const from = b * B, to = b === S - 1 ? T : (b + 1) * B;
            for (let j = from; j < to; j++) { sum += r[j]; sq += r[j] * r[j]; }
            a.push([sum, sq, to - from]);
        }
        return a;
    });
    const srOf = (sum, sq, n) => { const m = sum / n; const v = (sq - sum * sum / n) / (n - 1); return v > 0 ? m / Math.sqrt(v) : 0; };
    const combos = combinations(S, S / 2);
    let below = 0; const logits = [];
    for (const C of combos) {
        const inC = new Array(S).fill(false); C.forEach(b => { inC[b] = true; });
        let best = -Infinity, bestIdx = 0; const test = new Array(N);
        for (let s = 0; s < N; s++) {
            let ts = 0, tq = 0, tn = 0, vs = 0, vq = 0, vn = 0;
            for (let b = 0; b < S; b++) { const g = agg[s][b]; if (inC[b]) { ts += g[0]; tq += g[1]; tn += g[2]; } else { vs += g[0]; vq += g[1]; vn += g[2]; } }
            const tr = srOf(ts, tq, tn); test[s] = srOf(vs, vq, vn);
            if (tr > best) { best = tr; bestIdx = s; }
        }
        let rank = 1; for (let s = 0; s < N; s++) if (test[s] < test[bestIdx]) rank++;
        const omega = rank / (N + 1);
        const lambda = Math.log(omega / (1 - omega));
        logits.push(lambda);
        if (lambda <= 0) below++;
    }
    logits.sort((a, b) => a - b);
    return { pbo: below / combos.length, combos: combos.length, medianLogit: logits[Math.floor(logits.length / 2)] };
}

/* ─────────────────────────── data ─────────────────────────── */
async function getJson(fetchFn, url) {
    for (let a = 0; a < 4; a++) {
        try { const r = await fetchFn(url); if (r && r.ok) return await r.json(); if (r && (r.status === 451 || r.status === 403)) throw new Error('HTTP ' + r.status + ' (akses Binance diblokir dari host ini)'); } catch (e) { if (/diblokir/.test(e.message)) throw e; }
        await new Promise(res => setTimeout(res, 700 * (a + 1)));
    }
    throw new Error('gagal mengambil ' + url.split('?')[0]);
}
async function fetchDaily(fetchFn, sym, nowMs) {
    const out = []; let start = CONFIG.dataStart;
    for (let p = 0; p < 8; p++) {
        const raw = await getJson(fetchFn, `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1d&limit=1500&startTime=${start}`);
        if (!Array.isArray(raw) || !raw.length) break;
        raw.forEach(k => { if (!out.length || k[0] > out[out.length - 1].t) out.push({ t: k[0], c: +k[4], closeT: k[6] }); });
        if (raw.length < 1500) break;
        start = raw[raw.length - 1][0] + 1;
    }
    return out.filter(b => b.closeT < nowMs);
}
async function fetchDailySpot(fetchFn, sym, nowMs) {
    const out = []; let start = CONFIG.dataStart;
    for (let p = 0; p < 10; p++) {
        let raw;
        try { raw = await getJson(fetchFn, `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1d&limit=1000&startTime=${start}`); } catch (e) { if (/diblokir/.test(e.message)) throw e; break; }
        if (!Array.isArray(raw) || !raw.length) break;
        raw.forEach(k => { if (!out.length || k[0] > out[out.length - 1].t) out.push({ t: k[0], c: +k[4], closeT: k[6] }); });
        if (raw.length < 1000) break;
        start = raw[raw.length - 1][0] + 1;
    }
    return out.filter(b => b.closeT < nowMs);
}
async function fetchFunding(fetchFn, sym) {
    const out = []; let start = CONFIG.dataStart;
    for (let p = 0; p < 30; p++) {
        const raw = await getJson(fetchFn, `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1000&startTime=${start}`);
        if (!Array.isArray(raw) || !raw.length) break;
        raw.forEach(f => out.push([+f.fundingTime, +f.fundingRate]));
        if (raw.length < 1000) break;
        start = +raw[raw.length - 1].fundingTime + 1;
    }
    return out;
}
async function fetchPanel(fetchFn, nowMs) {
    const data = {};
    for (const sym of UNIVERSE) data[sym] = { daily: await fetchDaily(fetchFn, sym, nowMs), funding: await fetchFunding(fetchFn, sym), spot: await fetchDailySpot(fetchFn, sym, nowMs) };
    return buildPanel(data);
}

// Panel harian bersama. funding dijumlah per hari UTC (3 settlement). vol = volatilitas 30 hari (tahunan).
function buildPanel(data) {
    const syms = Object.keys(data).filter(s => data[s].daily && data[s].daily.length);
    const lastT = Math.max(...syms.map(s => data[s].daily[data[s].daily.length - 1].t));
    const firstT = Math.min(...syms.map(s => data[s].daily[0].t));
    const days = [];
    for (let t = firstT; t <= lastT; t += DAY) days.push(t);
    const idx = new Map(days.map((t, i) => [t, i]));
    const P = { days, idx, syms, close: {}, ret: {}, fund: {}, vol: {}, spotRet: {}, cache: new Map() };
    syms.forEach(sym => {
        const c = new Array(days.length).fill(null), f = new Array(days.length).fill(0);
        data[sym].daily.forEach(b => { const i = idx.get(b.t); if (i != null) c[i] = b.c; });
        (data[sym].funding || []).forEach(([ft, fr]) => { const i = idx.get(Math.floor(ft / DAY) * DAY); if (i != null) f[i] += fr; });
        const r = c.map((v, i) => (i > 0 && v != null && c[i - 1] != null) ? v / c[i - 1] - 1 : null);
        const vol = new Array(days.length).fill(null);
        for (let i = CONFIG.volWin; i < days.length; i++) {
            let n = 0, s1 = 0, s2 = 0;
            for (let j = i - CONFIG.volWin + 1; j <= i; j++) if (r[j] != null) { n++; s1 += r[j]; s2 += r[j] * r[j]; }
            if (n >= CONFIG.volWin - 2) { const m = s1 / n; vol[i] = Math.sqrt(Math.max(0, (s2 - n * m * m) / (n - 1))) * Math.sqrt(365); }
        }
        P.close[sym] = c; P.ret[sym] = r; P.fund[sym] = f; P.vol[sym] = vol;
        const sc = new Array(days.length).fill(null);
        (data[sym].spot || []).forEach(b => { const i = idx.get(b.t); if (i != null) sc[i] = b.c; });
        P.spotRet[sym] = sc.map((v, i) => (i > 0 && v != null && sc[i - 1] != null) ? v / sc[i - 1] - 1 : null);
    });
    return P;
}

function cached(P, key, fn) { if (!P.cache.has(key)) P.cache.set(key, fn()); return P.cache.get(key); }
function retL(P, sym, L) {
    return cached(P, 'ret|' + sym + '|' + L, () => { const c = P.close[sym]; return c.map((v, i) => (i >= L && v != null && c[i - L] != null) ? v / c[i - L] - 1 : null); });
}
function smaN(P, sym, n) {
    return cached(P, 'sma|' + sym + '|' + n, () => {
        const c = P.close[sym], out = new Array(c.length).fill(null);
        let sum = 0, cnt = 0;
        for (let i = 0; i < c.length; i++) {
            if (c[i] != null) { sum += c[i]; cnt++; } else { sum = 0; cnt = 0; }
            if (cnt > n) { sum -= c[i - n]; cnt = n; }
            if (cnt === n) out[i] = sum / n;
        }
        return out;
    });
}
// max/min penutupan n hari SEBELUM hari i (tidak termasuk hari i). Deque monoton: O(T) per simbol.
function rollExt(P, sym, n, isMax) {
    return cached(P, (isMax ? 'max|' : 'min|') + sym + '|' + n, () => {
        const c = P.close[sym], out = new Array(c.length).fill(null);
        const dq = []; let head = 0, lastNull = -1;
        const worse = (a, b) => (isMax ? c[a] <= c[b] : c[a] >= c[b]);
        for (let i = 1; i < c.length; i++) {
            const j = i - 1; // c[j] masuk jendela untuk out[i]
            if (c[j] == null) { lastNull = j; dq.length = 0; head = 0; }
            else { while (dq.length > head && worse(dq[dq.length - 1], j)) dq.pop(); dq.push(j); }
            while (dq.length > head && dq[head] < i - n) head++;
            if (i >= n && lastNull < i - n && dq.length > head) out[i] = c[dq[head]];
        }
        return out;
    });
}
function volScale(P, sym, i) { const v = P.vol[sym][i]; return v ? Math.min(CONFIG.maxScaleAsset, CONFIG.targetVolAsset / Math.max(v, 1e-6)) : 0; }

/* ─────────────────────────── kandidat ─────────────────────────── */
function candId(family, params) { return family + '|' + Object.keys(params).sort().map(k => k + '=' + params[k]).join('|'); }
function mkCand(family, params) { return { id: candId(family, params), family, params }; }
function lookback(c) {
    const p = c.params;
    return ({ TSMOM: p.L, SMA: p.n, MAX: p.slow, DONCH: p.n, XSMOM: p.L, CARRY: 7 })[c.family] || 30;
}
function baseCandidates() {
    const out = [];
    ['LS', 'LF'].forEach(mode => {
        [7, 14, 28, 56, 112, 224].forEach(L => out.push(mkCand('TSMOM', { L, mode })));
        [20, 50, 100, 200].forEach(n => out.push(mkCand('SMA', { n, mode })));
        [[10, 50], [20, 100], [50, 200]].forEach(([fast, slow]) => out.push(mkCand('MAX', { fast, slow, mode })));
        [20, 55, 100].forEach(n => out.push(mkCand('DONCH', { n, mode })));
    });
    ['LS', 'LO'].forEach(type => [7, 14, 28, 56].forEach(L => out.push(mkCand('XSMOM', { L, frac: 0.333, type }))));
    [0.05, 0.10, 0.20].forEach(thr => out.push(mkCand('CARRY', { thr })));
    return out;
}
function exploreCandidates(dayStr, existing, count) {
    const rnd = mulberry32(hashStr('explore|' + dayStr));
    const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const out = [];
    for (let tries = 0; out.length < count && tries < count * 50; tries++) {
        const fam = pick(['TSMOM', 'SMA', 'MAX', 'DONCH', 'XSMOM', 'CARRY']);
        let c;
        if (fam === 'TSMOM') c = mkCand(fam, { L: ri(5, 250), mode: pick(['LS', 'LF']) });
        else if (fam === 'SMA') c = mkCand(fam, { n: ri(10, 250), mode: pick(['LS', 'LF']) });
        else if (fam === 'MAX') { const fast = ri(5, 60); const slow = Math.min(250, Math.round(fast * (2 + rnd() * 4))); c = mkCand(fam, { fast, slow, mode: pick(['LS', 'LF']) }); }
        else if (fam === 'DONCH') c = mkCand(fam, { n: ri(10, 150), mode: pick(['LS', 'LF']) });
        else if (fam === 'XSMOM') c = mkCand(fam, { L: ri(5, 120), frac: pick([0.2, 0.25, 0.333]), type: pick(['LS', 'LO']) });
        else c = mkCand(fam, { thr: ri(2, 40) / 100 });
        if (!existing.has(c.id) && !out.some(o => o.id === c.id)) out.push(c);
    }
    return out;
}
function label(c) {
    const p = c.params, m = p.mode === 'LS' ? 'long/short' : 'long/flat';
    if (c.family === 'TSMOM') return 'Trend TSMOM ' + p.L + ' hari (' + m + ')';
    if (c.family === 'SMA') return 'Harga vs SMA ' + p.n + ' hari (' + m + ')';
    if (c.family === 'MAX') return 'Persilangan SMA ' + p.fast + '/' + p.slow + ' (' + m + ')';
    if (c.family === 'DONCH') return 'Breakout Donchian ' + p.n + ' hari (' + m + ')';
    if (c.family === 'XSMOM') return 'Momentum lintas koin ' + p.L + ' hari, ' + Math.round(p.frac * 100) + '% teratas' + (p.type === 'LS' ? ' vs terbawah (netral pasar)' : ' (long-only)');
    if (c.family === 'CARRY') return 'Carry funding > ' + Math.round(p.thr * 100) + '%/th (long spot + short perpetual)';
    return c.id;
}

/* ─────────────────────────── sinyal & simulasi (tanpa lookahead) ─────────────────────────── */
// Bobot target pada close hari i, HANYA memakai data <= i. null = data belum cukup (warm-up).
function targetWeights(P, cand, i, st) {
    const p = cand.params, need = lookback(cand);
    const needVol = cand.family !== 'CARRY' && cand.family !== 'XSMOM'; // hanya keluarga ber-vol-targeting butuh vol
    const act = P.syms.filter(s => P.close[s][i] != null && i >= need && P.close[s][i - need] != null && (!needVol || P.vol[s][i]));
    if (act.length < 3) return null;
    const N = act.length, w = {};
    const put = (s, raw) => { const v = raw * volScale(P, s, i) / N; if (v) w[s] = v; };
    if (cand.family === 'TSMOM') act.forEach(s => { const x = retL(P, s, p.L)[i]; if (x != null) put(s, p.mode === 'LF' ? Math.max(0, sign(x)) : sign(x)); });
    else if (cand.family === 'SMA') act.forEach(s => { const m = smaN(P, s, p.n)[i]; if (m != null) put(s, p.mode === 'LF' ? Math.max(0, sign(P.close[s][i] - m)) : sign(P.close[s][i] - m)); });
    else if (cand.family === 'MAX') act.forEach(s => { const f = smaN(P, s, p.fast)[i], sl = smaN(P, s, p.slow)[i]; if (f != null && sl != null) put(s, p.mode === 'LF' ? Math.max(0, sign(f - sl)) : sign(f - sl)); });
    else if (cand.family === 'DONCH') {
        const half = Math.max(5, Math.round(p.n / 2));
        act.forEach(s => {
            const c = P.close[s][i], hi = rollExt(P, s, p.n, true)[i], lo = rollExt(P, s, p.n, false)[i];
            const hiX = rollExt(P, s, half, true)[i], loX = rollExt(P, s, half, false)[i];
            if (hi == null || lo == null) return;
            let pos = st.pos[s] || 0;
            if (c > hi) pos = 1;
            else if (c < lo) pos = p.mode === 'LS' ? -1 : 0;
            else if (pos === 1 && loX != null && c < loX) pos = 0;
            else if (pos === -1 && hiX != null && c > hiX) pos = 0;
            st.pos[s] = pos;
            put(s, pos);
        });
    } else if (cand.family === 'XSMOM') {
        const ranked = act.map(s => [s, retL(P, s, p.L)[i]]).filter(x => x[1] != null).sort((a, b) => b[1] - a[1]);
        if (ranked.length < 3) return null;
        const k = Math.max(1, Math.floor(ranked.length * p.frac));
        ranked.slice(0, k).forEach(([s]) => { w[s] = (p.type === 'LS' ? 0.5 : 1) / k; });
        if (p.type === 'LS') ranked.slice(-k).forEach(([s]) => { w[s] = -0.5 / k; });
    } else if (cand.family === 'CARRY') {
        // Delta-netral: long spot + short perpetual pada koin yang funding 7 hari (tahunan) > ambang.
        act.forEach(s => {
            if (!P.spotRet[s] || P.spotRet[s][i] == null) return; // tidak bisa dilindung nilai tanpa pasar spot
            let sum = 0; for (let j = i - 6; j <= i; j++) sum += P.fund[s][j] || 0;
            if ((sum / 7) * 365 > p.thr) w[s] = 1 / N;
        });
    }
    return w;
}

// Menghasilkan return harian bersih (fee+slippage+funding) yang SEJAJAR dengan P.days (NaN sebelum mulai).
function simulate(P, cand) {
    const weekly = cand.family === 'XSMOM', hedged = cand.family === 'CARRY';
    const costMult = hedged ? 2 : 1; // carry: dua kaki (spot + perpetual)
    const L = P.days.length;
    const r = new Float64Array(L).fill(NaN);
    let w = null, startIdx = -1, turnSum = 0, fundSum = 0, nObs = 0;
    const st = { pos: {} };
    for (let i = 1; i < L - 1; i++) {
        const dayNo = Math.floor(P.days[i] / DAY);
        let turnover = 0;
        if (cand.family === 'DONCH' || !weekly || w === null || dayNo % 7 === 0) {
            const tgt = targetWeights(P, cand, i, st);
            if (tgt !== null) {
                const prev = w || {};
                new Set([...Object.keys(prev), ...Object.keys(tgt)]).forEach(s => { turnover += Math.abs((tgt[s] || 0) - (prev[s] || 0)); });
                w = tgt;
            }
        }
        if (w === null) continue;
        if (startIdx < 0) startIdx = i + 1;
        let gross = 0, fund = 0;
        for (const s in w) {
            const rr = P.ret[s][i + 1];
            if (!hedged) { if (rr != null) gross += w[s] * rr; }
            else { const sr = P.spotRet[s] ? P.spotRet[s][i + 1] : null; if (rr != null && sr != null) gross += w[s] * (sr - rr); } // risiko basis spot vs perpetual
            fund += w[s] * (P.fund[s][i + 1] || 0);
        }
        const fundPnL = hedged ? fund : -fund; // long perpetual membayar funding positif, short menerima
        const netRaw = gross + fundPnL - turnover * CONFIG.costPerSide * costMult;
        r[i + 1] = hedged ? netRaw / CONFIG.carryCapitalFactor : netRaw;
        turnSum += turnover; fundSum += fundPnL; nObs++;
        if (!hedged) {
            const port = 1 + gross, nw = {};
            for (const s in w) { const rr = P.ret[s][i + 1]; nw[s] = w[s] * (1 + (rr || 0)) / (port || 1); }
            w = nw;
        }
    }
    // Bobot target terbaru (sinyal pada close hari terakhir) untuk portofolio.
    const lastI = L - 1, dayNo = Math.floor(P.days[lastI] / DAY);
    let current = w || {};
    if (cand.family === 'DONCH' || !weekly || dayNo % 7 === 0) { const t = targetWeights(P, cand, lastI, st); if (t) current = t; }
    return { r, startIdx, current, avgTurnover: nObs ? turnSum / nObs : 0, fundingPnLAnnual: nObs ? fundSum / nObs * 365 : 0 };
}
function sliceSeries(sim, fromIdx, toIdx) {
    const out = [];
    const a = Math.max(sim.startIdx < 0 ? Infinity : sim.startIdx, fromIdx), b = toIdx;
    for (let j = a; j <= b; j++) if (!Number.isNaN(sim.r[j])) out.push(sim.r[j]);
    return out;
}
function correlation(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 30) return 0;
    const x = a.slice(-n), y = b.slice(-n);
    const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let j = 0; j < n; j++) { const dx = x[j] - mx, dy = y[j] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

/* ─────────────────────────── state & siklus harian ─────────────────────────── */
function defaultState() {
    return {
        v: 1, createdAt: Date.now(), lastRunDay: null, lastError: null, nTrials: 0,
        trials: {}, incubating: {}, promoted: {}, retired: {},
        portfolio: { equity: 1, peak: 1, lastIdxDay: null, riskScale: 1, killSwitch: false, alloc: {}, targetWeights: {} },
        log: [], summary: null
    };
}
function shouldRun(state, nowMs) {
    const d = new Date(nowMs);
    return state.lastRunDay !== utcDayStr(nowMs) && (d.getUTCHours() * 60 + d.getUTCMinutes()) >= CONFIG.runAfterUtcMin;
}
function resetKillSwitch(state) {
    state.portfolio.killSwitch = false; state.portfolio.peak = state.portfolio.equity; state.portfolio.riskScale = 1;
    addLog(state, 'MM', 'Kill switch direset manual oleh admin. Puncak ekuitas diatur ulang ke ekuitas saat ini.');
}
function addLog(state, type, text, ms) {
    state.log.unshift({ t: ms || Date.now(), type, text });
    if (state.log.length > 150) state.log.length = 150;
}

// Money management portofolio: ekuitas paper, rem drawdown (-10% -> risiko x0.5) & kill switch (-20% -> 0, reset manual).
function applyPortfolioReturns(state, rets, nowMs) {
    const pf = state.portfolio;
    rets.forEach(rp => { pf.equity *= 1 + rp; if (pf.equity > pf.peak) pf.peak = pf.equity; });
    const dd = pf.equity / pf.peak - 1;
    if (dd <= CONFIG.ddKill && !pf.killSwitch) { pf.killSwitch = true; addLog(state, 'MM', 'KILL SWITCH: drawdown portofolio ' + round(dd * 100, 1) + '% (batas ' + CONFIG.ddKill * 100 + '%). Semua alokasi 0 sampai direset admin.', nowMs); }
    const prevScale = pf.riskScale;
    pf.riskScale = pf.killSwitch ? 0 : (dd <= CONFIG.ddHalf ? 0.5 : 1);
    if (pf.riskScale !== prevScale) addLog(state, 'MM', 'Skala risiko portofolio ' + prevScale + ' -> ' + pf.riskScale + ' (drawdown ' + round(dd * 100, 1) + '%).', nowMs);
    return dd;
}

async function runDaily(fetchFn, state, opts) {
    opts = opts || {};
    const nowMs = opts.nowMs || Date.now();
    const P = opts.panel || await fetchPanel(fetchFn, nowMs);
    return runOnPanel(P, state, nowMs);
}

function runOnPanel(P, state, nowMs) {
    const today = utcDayStr(nowMs);
    const lastIdx = P.days.length - 1, lastDayMs = P.days[lastIdx];

    // 1. Daftarkan kandidat dasar + eksplorasi harian (setiap kandidat baru = satu percobaan yang dihitung).
    const register = (c, how) => {
        if (state.trials[c.id]) return false;
        if (state.nTrials >= CONFIG.maxTrials) return false;
        state.trials[c.id] = { family: c.family, params: c.params, firstSeen: today, origin: how };
        state.nTrials++;
        return true;
    };
    baseCandidates().forEach(c => register(c, 'base'));
    const existing = new Set(Object.keys(state.trials));
    const explored = exploreCandidates(today, existing, CONFIG.explorePerDay).filter(c => register(c, 'explore'));
    if (explored.length) addLog(state, 'EXPLORE', explored.length + ' kandidat baru diuji: ' + explored.map(c => label(c)).join('; '), nowMs);

    // 2. Simulasikan semua percobaan di seluruh riwayat.
    const sims = {}, stats = {};
    Object.entries(state.trials).forEach(([id, tr]) => {
        const c = { id, family: tr.family, params: tr.params };
        const sim = simulate(P, c);
        sims[id] = sim;
        stats[id] = seriesStats(sliceSeries(sim, 0, lastIdx));
    });

    // 3. Deflated Sharpe: dispersi SR lintas SEMUA percobaan & jumlah percobaan total.
    const srs = Object.values(stats).filter(s => s && s.n >= 200).map(s => s.srDaily);
    const srMean = srs.reduce((a, b) => a + b, 0) / Math.max(1, srs.length);
    const srVar = srs.length > 1 ? srs.reduce((a, b) => a + (b - srMean) * (b - srMean), 0) / (srs.length - 1) : 0;
    const sr0 = expectedMaxSR(srVar, state.nTrials);
    Object.entries(stats).forEach(([id, s]) => {
        const dsr = deflatedSharpe(s, srVar, state.nTrials);
        state.trials[id].last = s ? { sharpe: round(s.sharpe, 2), cagr: round(s.cagr, 4), mdd: round(s.mdd, 4), dsr: round(dsr, 4), years: round(s.years, 2), turnover: round(sims[id].avgTurnover, 3), funding: round(sims[id].fundingPnLAnnual, 4) } : null;
    });

    // 4. PBO pada jendela bersama semua percobaan.
    const startCommon = Math.max(...Object.values(sims).map(s => s.startIdx).filter(x => x >= 0));
    const aligned = Object.values(sims).filter(s => s.startIdx >= 0 && s.startIdx <= startCommon).map(s => Array.from(s.r.slice(startCommon, lastIdx + 1)).map(x => (Number.isNaN(x) ? 0 : x)));
    const pboRes = aligned.length >= 4 ? computePBO(aligned, CONFIG.pboBlocks) : null;
    const pbo = pboRes ? pboRes.pbo : null;

    const fwdSeries = (id, sinceMs) => { const k = P.idx.get(sinceMs); return k == null ? [] : sliceSeries(sims[id], k + 1, lastIdx); };
    const recent = (id, days) => sliceSeries(sims[id], Math.max(0, lastIdx - days + 1), lastIdx);

    // 5. Evaluasi inkubasi (paper-trading ke depan) -> promosi / pensiun.
    Object.entries(state.incubating).forEach(([id, inc]) => {
        const fs = seriesStats(fwdSeries(id, inc.since));
        const fwdDays = fs ? fs.n : 0;
        inc.fwd = fs ? { days: fwdDays, sharpe: round(fs.sharpe, 2), ret: round(fs.totalRet, 4), mdd: round(fs.mdd, 4) } : { days: 0 };
        if (!fs) return;
        const se = Math.sqrt((1 + 0.5 * inc.btSrDaily * inc.btSrDaily) / fwdDays);
        const z = (fs.srDaily - inc.btSrDaily) / se;
        inc.fwd.z = round(z, 2);
        if (fwdDays >= CONFIG.retireMinDays && (fs.sharpe < CONFIG.retireSharpe || fs.mdd < CONFIG.retireMdd)) {
            state.retired[id] = { at: today, reason: 'gagal inkubasi (Sharpe ' + round(fs.sharpe, 2) + ', DD ' + round(fs.mdd * 100, 1) + '%)' };
            delete state.incubating[id];
            addLog(state, 'RETIRE', label(Object.assign({ id }, state.trials[id])) + ': ' + state.retired[id].reason, nowMs);
        } else if (fwdDays >= CONFIG.minFwdDaysPromote && fs.sharpe >= CONFIG.promoteMinSharpe && fs.mdd >= CONFIG.promoteMinMdd && z >= CONFIG.promoteConsistencyZ) {
            state.promoted[id] = { since: inc.since, promotedAt: today };
            delete state.incubating[id];
            addLog(state, 'PROMOTE', label(Object.assign({ id }, state.trials[id])) + ' DIPROMOSIKAN setelah ' + fwdDays + ' hari paper-trading (Sharpe ke depan ' + round(fs.sharpe, 2) + ', DD ' + round(fs.mdd * 100, 1) + '%).', nowMs);
        } else if (fwdDays > CONFIG.maxIncubationDays) {
            state.retired[id] = { at: today, reason: 'tidak konsisten setelah ' + fwdDays + ' hari' };
            delete state.incubating[id];
            addLog(state, 'RETIRE', label(Object.assign({ id }, state.trials[id])) + ': ' + state.retired[id].reason, nowMs);
        }
    });

    // 6. Pemeliharaan strategi terpromosi: turunkan bila memburuk.
    Object.entries(state.promoted).forEach(([id, pr]) => {
        const r90 = seriesStats(recent(id, 90));
        const k = P.idx.get(pr.since);
        const sincePromo = k == null ? [] : sliceSeries(sims[id], k + 1, lastIdx);
        const ps = seriesStats(sincePromo);
        pr.fwd = ps ? { days: ps.n, sharpe: round(ps.sharpe, 2), ret: round(ps.totalRet, 4), mdd: round(ps.mdd, 4) } : { days: 0 };
        if ((r90 && r90.sharpe < CONFIG.retireSharpe) || (ps && ps.mdd < CONFIG.retireMdd)) {
            state.retired[id] = { at: today, reason: 'performa memburuk setelah promosi (Sharpe 90h ' + (r90 ? round(r90.sharpe, 2) : '-') + ', DD ' + (ps ? round(ps.mdd * 100, 1) : '-') + '%)' };
            delete state.promoted[id];
            addLog(state, 'DEMOTE', label(Object.assign({ id }, state.trials[id])) + ' diturunkan: ' + state.retired[id].reason, nowMs);
        }
    });

    // 7. Pendaftaran inkubasi baru: DSR tinggi, PBO wajar, drawdown terkendali, tidak berkorelasi tinggi.
    const taken = new Set([...Object.keys(state.incubating), ...Object.keys(state.promoted), ...Object.keys(state.retired)]);
    const fullHist = id => sliceSeries(sims[id], 0, lastIdx);
    const incumbents = () => [...Object.keys(state.incubating), ...Object.keys(state.promoted)].map(fullHist);
    const byQuality = (a, b) => (b[1].last.dsr - a[1].last.dsr) || (b[1].last.sharpe - a[1].last.sharpe); // DSR, lalu Sharpe
    const ranked = Object.entries(state.trials).filter(([id, t]) => t.last && !taken.has(id)).sort(byQuality);
    for (const [id, t] of ranked) {
        if (Object.keys(state.incubating).length >= CONFIG.incubationSlots) break;
        const L = t.last;
        if (!(L.dsr >= CONFIG.dsrMin && L.sharpe > 0 && L.mdd >= CONFIG.btMddMin && pbo != null && pbo <= CONFIG.pboMax)) continue;
        const mine = fullHist(id);
        if (incumbents().some(x => Math.abs(correlation(mine, x)) > CONFIG.minCorrDiversity)) continue;
        state.incubating[id] = { since: lastDayMs, registeredAt: today, btSharpe: L.sharpe, btSrDaily: stats[id].srDaily, btMdd: L.mdd, dsr: L.dsr };
        addLog(state, 'INCUBATE', label(Object.assign({ id }, t)) + ' masuk inkubasi (DSR ' + L.dsr + ', Sharpe historis ' + L.sharpe + ', PBO set ' + round(pbo, 2) + '). Mulai paper-trading ke depan.', nowMs);
    }

    // 8. Portofolio paper + money management ketat.
    const pf = state.portfolio;
    const fromIdx = pf.lastIdxDay != null && P.idx.has(pf.lastIdxDay) ? P.idx.get(pf.lastIdxDay) + 1 : lastIdx + 1;
    const pfRets = [];
    for (let j = fromIdx; j <= lastIdx; j++) {
        let rp = 0;
        Object.entries(pf.alloc || {}).forEach(([id, a]) => { if (sims[id] && !Number.isNaN(sims[id].r[j])) rp += a * sims[id].r[j]; });
        pfRets.push(rp);
    }
    const dd = applyPortfolioReturns(state, pfRets, nowMs);
    pf.lastIdxDay = lastDayMs;

    const prom = Object.keys(state.promoted);
    const alloc = {};
    if (prom.length && pf.riskScale > 0) {
        const vols = {}, rec = {};
        prom.forEach(id => { rec[id] = recent(id, 180); const s = seriesStats(rec[id]); vols[id] = s && s.sd > 0 ? s.sd * Math.sqrt(365) : null; });
        const ok = prom.filter(id => vols[id]);
        const invSum = ok.reduce((a, id) => a + 1 / vols[id], 0);
        const base = {}; ok.forEach(id => { base[id] = (1 / vols[id]) / invSum; });
        const n = Math.min(...ok.map(id => rec[id].length));
        const comb = [];
        for (let j = 0; j < n; j++) comb.push(ok.reduce((a, id) => a + base[id] * rec[id][rec[id].length - n + j], 0));
        const cs = seriesStats(comb);
        const k = cs && cs.sd > 0 ? Math.min(CONFIG.maxGross, CONFIG.portfolioTargetVol / (cs.sd * Math.sqrt(365))) : 0;
        ok.forEach(id => {
            const fwdDays = Math.round((lastDayMs - state.promoted[id].since) / DAY);
            const ramp = Math.min(1, fwdDays / CONFIG.rampDays); // modal dinaikkan bertahap seiring bukti ke depan bertambah
            alloc[id] = round(k * base[id] * ramp * pf.riskScale, 4);
        });
    }
    pf.alloc = alloc;
    const tw = {};
    Object.entries(alloc).forEach(([id, a]) => Object.entries(sims[id].current || {}).forEach(([s, w]) => { tw[s] = (tw[s] || 0) + a * w; }));
    Object.keys(tw).forEach(s => { tw[s] = Math.max(-CONFIG.maxAssetWeight, Math.min(CONFIG.maxAssetWeight, tw[s])); });
    const gross = Object.values(tw).reduce((a, v) => a + Math.abs(v), 0);
    if (gross > CONFIG.maxGross) Object.keys(tw).forEach(s => { tw[s] *= CONFIG.maxGross / gross; });
    pf.targetWeights = Object.fromEntries(Object.entries(tw).map(([s, v]) => [s, round(v, 4)]).filter(([, v]) => v));

    // 9. Ringkasan untuk web & sync.
    const L2 = id => label(Object.assign({ id }, state.trials[id]));
    state.lastRunDay = today; state.lastError = null;
    state.summary = {
        updatedAt: nowMs, day: today, dataUntil: utcDayStr(lastDayMs), universe: P.syms.length,
        nTrials: state.nTrials, hurdleSharpe: round(sr0 * Math.sqrt(365), 2), pbo: round(pbo, 3),
        top: Object.entries(state.trials).filter(([, t]) => t.last).sort(byQuality).slice(0, 10)
            .map(([id, t]) => ({ id, label: L2(id), family: t.family, source: SOURCES[FAMILY_SOURCE[t.family]], sharpe: t.last.sharpe, cagr: t.last.cagr, mdd: t.last.mdd, dsr: t.last.dsr, years: t.last.years, status: state.incubating[id] ? 'INKUBASI' : state.promoted[id] ? 'PROMOSI' : state.retired[id] ? 'PENSIUN' : 'KANDIDAT' })),
        incubating: Object.entries(state.incubating).map(([id, inc]) => ({ id, label: L2(id), registeredAt: inc.registeredAt, btSharpe: inc.btSharpe, dsr: inc.dsr, fwd: inc.fwd || { days: 0 } })),
        promoted: Object.entries(state.promoted).map(([id, pr]) => ({ id, label: L2(id), promotedAt: pr.promotedAt, fwd: pr.fwd || { days: 0 }, alloc: alloc[id] || 0 })),
        retiredCount: Object.keys(state.retired).length,
        portfolio: { equity: round(pf.equity, 4), ddPct: round(dd * 100, 2), riskScale: pf.riskScale, killSwitch: pf.killSwitch, grossPct: round(Object.values(pf.targetWeights).reduce((a, v) => a + Math.abs(v), 0) * 100, 1), targetWeights: pf.targetWeights },
        rules: { dsrMin: CONFIG.dsrMin, pboMax: CONFIG.pboMax, minFwdDays: CONFIG.minFwdDaysPromote, ddHalfPct: CONFIG.ddHalf * 100, ddKillPct: CONFIG.ddKill * 100, targetVolPct: CONFIG.portfolioTargetVol * 100, maxAssetPct: CONFIG.maxAssetWeight * 100 },
        log: state.log.slice(0, 25)
    };
    return state.summary;
}

module.exports = {
    UNIVERSE, CONFIG, SOURCES, DAY,
    defaultState, shouldRun, runDaily, runOnPanel, resetKillSwitch, applyPortfolioReturns, fetchPanel, buildPanel, rollExt,
    simulate, targetWeights, seriesStats, deflatedSharpe, expectedMaxSR, computePBO, normCdf, invNorm,
    baseCandidates, exploreCandidates, candId, label, utcDayStr, correlation, combinations
};
