/* runner.js — headless learning cycle for GitHub Actions (runs even with tab closed) */
const fs = require('fs');
global.window = global; global.addEventListener = () => { };
global.document = { readyState: 'complete', addEventListener() { }, getElementById: () => null, querySelectorAll: () => [] };
global.localStorage = { _s: {}, getItem(k){return this._s[k]||null}, setItem(k,v){this._s[k]=v}, removeItem(k){delete this._s[k]} };
global.DOMParser = class { parseFromString() { return { querySelectorAll: () => [] }; } };
// native AbortSignal preserved for fetchTimeout
// load persisted state from disk into localStorage so brain resumes
try {
    const ls = JSON.parse(fs.readFileSync('learning_state.json','utf8'));
    if (ls && ls.brain) global.localStorage._s['pilusQuantBrainV1'] = JSON.stringify(ls.brain);
} catch (e) { console.log('no prior state, starting fresh'); }

const code = fs.readFileSync('./brain-pure.js','utf8').replace("if (document.readyState === 'loading')","if (false)");
eval(code);
const B = global.PilusQuantBrain;

(async () => {
    console.log('=== QUANT BRAIN HEADLESS CYCLE START ===');
    const before = JSON.stringify(B.state().stats);
    await B.cycle(true);
    const st = B.state();
    console.log('stats before:', before);
    console.log('stats after :', JSON.stringify(st.stats));
    console.log('signals:', st.signals.length, 'closed:', st.stats.closed, 'wins:', st.stats.wins, 'losses:', st.stats.losses);
    console.log('best strategy by weight:', Object.entries(st.weights).sort((a,b)=>b[1]-a[1])[0]);

    // write state files
    const now = Date.now();
    const ls = { version: '1.0', updatedAt: now, brain: st };
    fs.writeFileSync('learning_state.json', JSON.stringify(ls, null, 2));
    const aj = { updatedAt: now, totalSignals: st.signals.length, closed: st.stats.closed, wins: st.stats.wins, losses: st.stats.losses, be: st.stats.be, winRatePct: st.stats.closed ? Math.round(st.stats.wins / st.stats.closed * 1000) / 10 : null, netR: st.stats.netR || st.equityR, backtestOOS: st.stats.backtestOOS || { trades: 0, netR: 0, winRatePct: null }, proof: 'Accuracy computed only from real tracked signals vs real prices. No synthetic numbers.' };
    fs.writeFileSync('accuracy_report.json', JSON.stringify(aj, null, 2));
    fs.writeFileSync('strategy_weights.json', JSON.stringify({ weights: st.weights, updatedAt: now }, null, 2));
    const tj = { trades: st.signals.filter(s => s.status === 'WIN' || s.status === 'LOSS'), updatedAt: now };
    fs.writeFileSync('trade_journal.json', JSON.stringify(tj, null, 2));
    console.log('state files written. updatedAt:', new Date(now).toISOString());
    console.log('=== CYCLE DONE ===');
    process.exit(0);
})().catch(e => { console.error('FAIL:', e && e.stack); process.exit(1); });
