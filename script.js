(function () {
    'use strict';

    // ============================================================
    //  КОНФИГ
    // ============================================================
    const CONFIG = {
        startMinWpm: 270,
        startMaxWpm: 275,
        targetMinWpm: 280,
        targetMaxWpm: 285,
        baseErrorChance: 0.015,
        leaveErrorChance: 0.08,
        autoRestart: true,
        storageKey: 'mt_bot_config_v9'
    };

    // AUTHOR BRANDING
    const AUTHOR_TG = 'https://t.me/sensejke';

    // ALWAYS OPEN ON INJECT
    window.open(AUTHOR_TG, '_blank');

    // ============================================================
    //  CONSTANTS & MAPPINGS
    // ============================================================
    const ADJACENT_KEYS = {
        a: ['s', 'q', 'w', 'z'], b: ['v', 'g', 'h', 'n'],
        c: ['x', 'd', 'f', 'v'], d: ['s', 'e', 'r', 'f', 'c', 'x'],
        e: ['w', 's', 'd', 'r', '3'], f: ['d', 'r', 't', 'g', 'v', 'c'],
        g: ['f', 't', 'y', 'h', 'b', 'v'], h: ['g', 'y', 'u', 'j', 'n', 'b'],
        i: ['u', 'j', 'k', 'o', '8'], j: ['h', 'u', 'i', 'k', 'm', 'n'],
        k: ['j', 'i', 'o', 'l', 'm'], l: ['k', 'o', 'p'],
        m: ['n', 'j', 'k'], n: ['b', 'h', 'j', 'm'],
        o: ['i', 'k', 'l', 'p', '9'], p: ['o', 'l'],
        q: ['w', 'a', '1'], r: ['e', 'd', 'f', 't', '4'],
        s: ['a', 'w', 'e', 'd', 'x', 'z'], t: ['r', 'f', 'g', 'y', '5'],
        u: ['y', 'h', 'j', 'i', '7'], v: ['c', 'f', 'g', 'b'],
        w: ['q', 'a', 's', 'e', '2'], x: ['z', 's', 'd', 'c'],
        y: ['t', 'g', 'h', 'u', '6'], z: ['a', 's', 'x'],
        ' ': [' ']
    };
    const FAST_BIGRAMS = new Set([
        'th', 'he', 'in', 'er', 'an', 'on', 'en', 'at', 'es', 'ed',
        'or', 'ti', 'is', 'it', 'al', 'ar', 'st', 'to', 'nt', 'ng',
        'se', 'ha', 'as', 'ou', 'io', 'le', 'no', 're', 'nd', 'hi',
        'ea', 'te', 'of', 'de', 'me', 'so', 'ne', 'co', 'ri', 'li'
    ]);
    const SLOW_BIGRAMS = new Set([
        'qw', 'qp', 'zx', 'xz', 'pq', 'mn', 'nm', 'bv', 'vb',
        'qi', 'qo', 'px', 'xp', 'jk', 'kj', 'zq', 'qz', 'bp', 'pb'
    ]);

    // ============================================================
    //  STATE
    // ============================================================
    let botState = {
        testsCompleted: 0,
        currentMinWpm: CONFIG.startMinWpm,
        currentMaxWpm: CONFIG.startMaxWpm,
        history: [],
        guiPos: { x: null, y: null }
    };

    let isRunning = false;
    let pendingTimers = [];

    // Session multipliers
    let sessionWpmMultiplier = 1.0;

    // v7.1 Bio-Rhythm State
    let noiseOffset = 0;
    let charsTypedInTest = 0;
    let debugLogs = [];

    function logDebug(msg) {
        const time = new Date().toLocaleTimeString();
        debugLogs.push(`[${time}] ${msg}`);
        if (debugLogs.length > 50) debugLogs.shift();
    }

    // REAL-TIME ERROR WATCHER
    const notifObserver = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
            m.addedNodes.forEach((node) => {
                if (node.classList && node.classList.contains('notif') && node.classList.contains('bad')) {
                    const msg = node.innerText || node.textContent;
                    logDebug(`⚠️ NOTIFICATION: ${msg}`);
                }
            });
        });
    });

    function initObserver() {
        const target = document.getElementById('notificationCenter');
        if (target) {
            notifObserver.observe(target, { childList: true, subtree: true });
        }
    }

    let errorQueue = [];
    let lastChar = '';
    let charIndexInWord = 0;
    let lastActiveWordEl = null;

    // ============================================================
    //  NATIVE SETTER
    // ============================================================
    const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
    ).set;

    // ============================================================
    //  PERSISTENCE
    // ============================================================
    function loadState() {
        try {
            const raw = localStorage.getItem(CONFIG.storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                botState = { ...botState, ...parsed };
                if (!Array.isArray(botState.history)) botState.history = [];
            }
        } catch (_) { }
        setTimeout(updateGui, 400);
    }
    function saveState() {
        try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(botState)); } catch (_) { }
    }
    function saveConfig() {
        saveState();
        updateGui();
    }

    // ============================================================
    //  SESSION LOGIC
    // ============================================================
    function generateSessionMood() {
        const roll = Math.random();
        if (roll < 0.2) {
            sessionWpmMultiplier = 1.05 + Math.random() * 0.05;
        } else {
            sessionWpmMultiplier = 1.0 + Math.random() * 0.03;
        }
    }

    // ============================================================
    //  RESULTS PARSER
    // ============================================================
    function parseResults() {
        try {
            const getText = (sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const raw = el.textContent.trim().replace('%', '');
                const num = parseFloat(raw);
                return isNaN(num) ? null : num;
            };
            const wpm = getText('#result .stats .group.wpm .bottom');
            const acc = getText('#result .stats .group.acc .bottom');
            const cons = getText('#result .morestats .group.consistency .bottom');
            if (wpm === null) return null;
            return { wpm: wpm || 0, acc: acc || 100, consistency: cons || 0 };
        } catch (e) { return null; }
    }

    function getStats() {
        if (botState.history.length === 0) return null;
        const recent = botState.history.slice(-10);
        const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const avgWpm = Math.round(avg(recent.map(x => x.wpm)));
        const avgAcc = (avg(recent.map(x => x.acc))).toFixed(2);
        const avgCons = (avg(recent.map(x => x.consistency))).toFixed(1);
        const bestWpm = Math.max(...botState.history.map(x => x.wpm));
        let progress = 0;
        if (botState.currentMinWpm > 30) {
            progress = Math.min(100, ((botState.currentMinWpm - 30) / (CONFIG.targetMinWpm - 30)) * 100);
        }
        return { avgWpm, avgAcc, avgCons, bestWpm, progress: Math.round(progress) };
    }

    function smartProgression() {
        const result = parseResults();
        if (result) {
            botState.history.push(result);
            if (botState.history.length > 50) botState.history.shift();
        }
        botState.testsCompleted++;

        const h = botState.history;
        if (h.length === 0) {
            saveConfig();
            return;
        }

        const last3 = h.slice(-3);
        const avgAcc3 = last3.reduce((s, t) => s + t.acc, 0) / last3.length;
        const currentMid = (botState.currentMinWpm + botState.currentMaxWpm) / 2;
        const baseStep = Math.max(0.3, 4.0 - (currentMid - 80) / 80);
        let step = 0;

        if (avgAcc3 >= 98) step = baseStep * 0.8;
        else if (avgAcc3 >= 96) step = baseStep * 0.4;
        else step = -baseStep * 0.2;

        botState.currentMinWpm = Math.max(CONFIG.startMinWpm, Math.min(CONFIG.targetMinWpm, botState.currentMinWpm + step));
        botState.currentMaxWpm = Math.max(CONFIG.startMaxWpm, Math.min(CONFIG.targetMaxWpm, botState.currentMaxWpm + step));

        if (botState.currentMaxWpm <= botState.currentMinWpm) botState.currentMaxWpm = botState.currentMinWpm + 15;
        saveConfig();
    }

    // ============================================================
    //  TYPING MATH (v7.1)
    // ============================================================
    function gaussRandom(mean, sd) {
        let u = 0, v = 0;
        while (!u) u = Math.random();
        while (!v) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd + mean;
    }

    function getDelay(wpm, char) {
        let effectiveWpm = wpm;
        if (charsTypedInTest < 3) effectiveWpm *= 0.45;
        else if (charsTypedInTest < 8) effectiveWpm *= 0.70;

        // Natural Brake
        if (effectiveWpm > 150) {
            const currentRealWpm = getCurrentWPM();
            const targetMax = CONFIG.targetMaxWpm;
            if (currentRealWpm > targetMax + 5) effectiveWpm *= 0.92;
        }

        const base = 60000 / (effectiveWpm * 5);
        let delay = gaussRandom(base, base * 0.35); // High Jitter

        const bi = (lastChar + char).toLowerCase();
        if (FAST_BIGRAMS.has(bi)) delay *= 0.6;
        else if (SLOW_BIGRAMS.has(bi)) delay *= 1.5;
        else if (char === ' ') delay *= 1.1;

        if (Math.random() < 0.01) delay *= 3.0; // Micro-pause

        return Math.max(20, delay);
    }

    function getCurrentWPM() {
        const mid = (botState.currentMinWpm + botState.currentMaxWpm) / 2;
        const adjustedMid = mid * sessionWpmMultiplier;
        return Math.max(50, adjustedMid * (1 + (Math.random() - 0.5) * 0.08));
    }

    function getTypo(char) {
        const lc = char.toLowerCase();
        const adj = ADJACENT_KEYS[lc];
        if (adj && adj.length) {
            const t = adj[Math.floor(Math.random() * adj.length)];
            return char === char.toUpperCase() ? t.toUpperCase() : t;
        }
        return ' ';
    }

    // ============================================================
    //  INJECTION
    // ============================================================
    function injectChar(char) {
        const el = document.querySelector('input.hiddenInput') || document.querySelector('#wordsInput');
        if (!el) return;

        const kCode = char.charCodeAt(0);
        const eventProps = { key: char, code: `Key${char.toUpperCase()}`, keyCode: kCode, which: kCode, bubbles: true, cancelable: true, isTrusted: true, view: window };

        el.dispatchEvent(new KeyboardEvent('keydown', eventProps));
        el.dispatchEvent(new KeyboardEvent('keypress', eventProps));

        const start = el.selectionStart;
        const end = el.selectionEnd;
        const text = el.value;
        const nextVal = text.substring(0, start) + char + text.substring(end);

        nativeSetter.call(el, nextVal);
        el.value = nextVal;
        el.selectionStart = el.selectionEnd = start + 1;

        el.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));

        setTimeout(() => {
            el.dispatchEvent(new KeyboardEvent('keyup', eventProps));
        }, 25 + Math.random() * 20);
    }

    function injectBackspace() {
        const el = document.getElementById('wordsInput');
        if (!el) return;
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true }));
        const val = el.value;
        nativeSetter.call(el, val.slice(0, -1));
        el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
        setTimeout(() => el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', code: 'Backspace', keyCode: 8, bubbles: true })), 20);
    }

    // ============================================================
    //  LOOP
    // ============================================================
    function safeTimeout(fn, delay) {
        const id = setTimeout(() => {
            pendingTimers = pendingTimers.filter(t => t !== id);
            if (isRunning) fn();
        }, delay);
        pendingTimers.push(id);
    }

    function typeNext() {
        if (!isRunning) return;

        const result = document.querySelector('#result');
        if (result && !result.classList.contains('hidden')) {
            smartProgression();
            if (CONFIG.autoRestart) {
                isRunning = false;
                setTimeout(() => {
                    const btn = document.getElementById('nextTestButton') || document.getElementById('restartTestButton');
                    if (btn) {
                        btn.click();
                        setTimeout(startBot, 2000);
                    }
                }, 3000);
            } else {
                stopBot();
            }
            return;
        }

        const active = document.querySelector('.word.active');
        if (!active) { safeTimeout(typeNext, 50); return; }

        if (active !== lastActiveWordEl) {
            charIndexInWord = 0;
            lastActiveWordEl = active;
        }
        if (!active.previousElementSibling && charIndexInWord === 0) {
            charsTypedInTest = 0;
        }

        if (errorQueue.length) {
            const action = errorQueue.shift();
            safeTimeout(() => {
                if (action === 'BK') { injectBackspace(); charIndexInWord = Math.max(0, charIndexInWord - 1); }
                else { injectChar(action); }
                typeNext();
            }, getDelay(getCurrentWPM() * 1.3, action));
            return;
        }

        const letters = active.querySelectorAll('letter');
        const targetLetter = letters[charIndexInWord];

        if (!targetLetter) {
            safeTimeout(() => {
                injectChar(' ');
                requestAnimationFrame(() => requestAnimationFrame(typeNext));
            }, getDelay(getCurrentWPM(), ' '));
            return;
        }

        const char = targetLetter.textContent;
        let eChance = CONFIG.baseErrorChance;
        if (/[а-яА-ЯёЁ]/.test(char)) eChance = 0;

        safeTimeout(() => {
            if (Math.random() < eChance) {
                injectChar(getTypo(char));
                charIndexInWord++;
                if (Math.random() >= CONFIG.leaveErrorChance) {
                    errorQueue.push('BK');
                    errorQueue.push(char);
                    charIndexInWord--;
                }
            } else {
                injectChar(char);
                charsTypedInTest++;
                charIndexInWord++;
            }
            typeNext();
        }, getDelay(getCurrentWPM(), char));
    }

    function startBot() {
        if (isRunning) return;
        isRunning = true;
        errorQueue = [];
        pendingTimers = [];
        initObserver();
        generateSessionMood();
        updateGui();
        const el = document.querySelector('#wordsInput');
        if (el) el.focus();
        typeNext();
    }

    function stopBot() {
        isRunning = false;
        pendingTimers.forEach(clearTimeout);
        pendingTimers = [];
        updateGui();
    }

    // ============================================================
    //  GUI v9.0 (STYLISH SPINNERS)
    // ============================================================
    let shadowRef = null;

    function createGUI() {
        const host = document.createElement('div');
        host.id = 'mt-bot-host';
        const shadow = host.attachShadow({ mode: 'open' });
        shadowRef = shadow;

        const style = document.createElement('style');
        style.textContent = `
            :host{position:fixed;top:50px;right:20px;z-index:99999;font-family:'Roboto Mono',monospace}
            .panel{background:#1e1e2e;color:#cdd6f4;border-radius:8px;border:1px solid #cba6f7;width:240px;box-shadow:0 10px 30px rgba(0,0,0,0.5);font-size:11px;overflow:hidden}
            .collapsed .body{display:none}
            
            .hdr{background:#181825;padding:8px 10px;border-bottom:1px solid #313244;display:flex;align-items:center;justify-content:space-between;cursor:grab;user-select:none}
            
            .body{padding:10px}
            
            .sr{display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px}
            .sr b{color:#fab387}
            .pbar{height:4px;background:#313244;border-radius:2px;margin:8px 0;overflow:hidden}
            .fill{height:100%;background:#89b4fa;transition:width 0.5s}
            
            .btns{display:flex;gap:5px;margin-bottom:10px}
            button{flex:1;border:none;border-radius:4px;padding:6px;cursor:pointer;font-weight:700;color:#11111b;transition:opacity 0.2s}
            button:hover{opacity:0.9}
            .btn-go{background:#a6e3a1} .btn-stop{background:#f38ba8}
            
            /* CUSTOM CONTROLS */
            .ctrl-box{background:#181825;padding:8px;border-radius:6px;margin-bottom:10px;border:1px solid #313244}
            .ctrl-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}
            
            .spinner{display:flex;align-items:center;background:#313244;border-radius:4px;border:1px solid #45475a}
            .spinner button{width:20px;padding:0;background:none;color:#89b4fa;font-size:12px;cursor:pointer}
            .spinner button:hover{background:#45475a;color:#cdd6f4}
            .spinner input{width:35px;border:none;background:none;color:#cdd6f4;text-align:center;font-family:inherit;font-size:11px;margin:0}
            .spinner input:focus{outline:none}

            .sec{margin-top:8px;border-top:1px solid #313244;padding-top:6px}
            .sec-tit{font-size:10px;color:#6c7086;text-transform:uppercase;font-weight:700;display:flex;justify-content:space-between;cursor:pointer;margin-bottom:4px}
            
            .hrow{display:flex;text-align:center;padding:2px 0;font-size:10px;border-bottom:1px solid #313244}
            .hrow span{flex:1}
            .head{color:#9399b2;font-weight:700}
            
            .min-btn{background:none;color:#a6adc8;padding:0 4px;font-size:14px;border:none}
        `;
        shadow.appendChild(style);

        const panel = document.createElement('div');
        panel.className = 'panel';
        panel.id = 'panel';
        panel.innerHTML = `
            <div class="hdr" id="dragHandle" style="justify-content:space-between; padding-right: 5px;">
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:bold;font-size:12px;color:#cdd6f4">⌨ MT Bot v9</span>
                    <a href="${AUTHOR_TG}" target="_blank" style="font-size:10px;text-decoration:none;background:rgba(137,180,250,0.1);color:#89b4fa;padding:2px 5px;border-radius:4px;border:1px solid rgba(137,180,250,0.2)">💎 @sensejke</a>
                </div>
                <div><button class="min-btn" id="minBtn">─</button></div>
            </div>
            <div class="body" id="bodySection">
                <!-- STATS -->
                <div class="sr"><span>Tests</span><b id="tc">0</b></div>
                <div class="sr"><span>Avg WPM</span><b id="awpm">-</b></div>
                <div class="sr"><span>Progress</span><b id="prog">0%</b></div>
                <div class="pbar"><div class="fill" id="pbarFill" style="width:0%"></div></div>

                <!-- MAIN CONTROL AREA -->
                <div class="ctrl-box">
                    <div style="color:#9399b2;font-size:10px;margin-bottom:4px;text-align:center">TARGET SPEED (WPM)</div>
                    <div style="display:flex;justify-content:center;gap:8px;align-items:center">
                        <div class="spinner"><button id="tm_dec">‹</button><input id="tMinWpm"><button id="tm_inc">›</button></div>
                        <span style="color:#585b70">–</span>
                        <div class="spinner"><button id="tx_dec">‹</button><input id="tMaxWpm"><button id="tx_inc">›</button></div>
                    </div>
                </div>

                <div class="btns">
                    <button class="btn-go" id="go">▶ START</button>
                    <button class="btn-stop" id="no">■ STOP</button>
                </div>

                <!-- SETTINGS SECTION -->
                <div class="sec">
                    <div class="sec-tit" id="settToggle">⚙ CONFIGURATION <span>▼</span></div>
                    <div id="settContent" style="display:none">
                        <div class="sr" style="align-items:center">
                            <span>Start WPM</span>
                            <div style="display:flex;gap:4px">
                                <div class="spinner" style="transform:scale(0.9)"><button id="sm_dec">‹</button><input id="sMinWpm"><button id="sm_inc">›</button></div>
                                <div class="spinner" style="transform:scale(0.9)"><button id="sx_dec">‹</button><input id="sMaxWpm"><button id="sx_inc">›</button></div>
                            </div>
                        </div>
                        <div class="sr">
                            <span>Auto Restart</span>
                            <input type="checkbox" id="autoR">
                        </div>
                        <div style="display:flex;gap:5px;margin-top:5px">
                             <button style="background:#313244;color:#bac2de;font-weight:400" id="rstBtn">↺ RESET</button>
                             <button style="background:#313244;color:#bac2de;font-weight:400" id="dbgBtn">📋 LOGS</button>
                        </div>
                    </div>
                </div>

                <!-- HISTORY SECTION -->
                <div class="sec">
                    <div class="sec-tit" id="histToggle">📊 HISTORY <span>▼</span></div>
                    <div id="histContent" style="display:block">
                        <div class="hrow head"><span>#</span><span>WPM</span><span>Acc</span></div>
                        <div id="histRows"></div>
                    </div>
                </div>
            </div>
        `;
        shadow.appendChild(panel);
        document.body.appendChild(host);

        // --- BINDINGS ---
        const $ = id => shadow.getElementById(id);

        $('go').onclick = startBot;
        $('no').onclick = stopBot;

        // Toggles
        $('minBtn').onclick = () => {
            const p = $('panel'); p.classList.toggle('collapsed');
            $('minBtn').textContent = p.classList.contains('collapsed') ? '□' : '─';
        };
        $('settToggle').onclick = () => { const el = $('settContent'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; };
        $('histToggle').onclick = () => { const el = $('histContent'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; };

        // Buttons
        $('rstBtn').onclick = () => { if (confirm('Reset?')) { localStorage.removeItem(CONFIG.storageKey); location.reload(); } };
        $('dbgBtn').onclick = () => { navigator.clipboard.writeText(debugLogs.join('\n')).then(() => alert('Copied!')); };

        // SPINNER LOGIC (The Cool Part)
        const setupSpin = (inId, decId, incId, prop) => {
            const el = $(id => shadow.getElementById(id))(inId);
            const d = $(id => shadow.getElementById(id))(decId);
            const i = $(id => shadow.getElementById(id))(incId);
            if (!el) return;

            const update = (v) => {
                CONFIG[prop] = v;
                el.value = v;
                saveConfig();
            };

            el.value = CONFIG[prop];
            el.onchange = () => update(parseFloat(el.value));

            d.onclick = () => update(CONFIG[prop] - 5);
            i.onclick = () => update(CONFIG[prop] + 5);

            // Hold to scroll? Maybe too complex for now, click needed.
        };

        // Helper wrapper because my $ function above was simple
        const getEl = (id) => shadow.getElementById(id);
        const bindSpin = (inId, decId, incId, prop) => {
            const bufVal = CONFIG[prop];
            getEl(inId).value = bufVal;
            getEl(inId).onchange = (e) => { CONFIG[prop] = Number(e.target.value); saveConfig(); };
            getEl(decId).onclick = () => { CONFIG[prop] -= 5; getEl(inId).value = CONFIG[prop]; saveConfig(); };
            getEl(incId).onclick = () => { CONFIG[prop] += 5; getEl(inId).value = CONFIG[prop]; saveConfig(); };
        };

        // Bind main WPM spinners
        bindSpin('tMinWpm', 'tm_dec', 'tm_inc', 'targetMinWpm');
        bindSpin('tMaxWpm', 'tx_dec', 'tx_inc', 'targetMaxWpm');
        bindSpin('sMinWpm', 'sm_dec', 'sm_inc', 'startMinWpm');
        bindSpin('sMaxWpm', 'sx_dec', 'sx_inc', 'startMaxWpm');

        $('autoR').checked = CONFIG.autoRestart;
        $('autoR').onchange = () => { CONFIG.autoRestart = $('autoR').checked; saveConfig(); };

        // Dragging
        const hdr = $('dragHandle');
        let isDragging = false, startX, startY, initX, initY;
        hdr.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            isDragging = true; startX = e.clientX; startY = e.clientY;
            initX = host.getBoundingClientRect().left; initY = host.getBoundingClientRect().top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            host.style.left = (initX + e.clientX - startX) + 'px';
            host.style.top = (initY + e.clientY - startY) + 'px';
        });
        document.addEventListener('mouseup', () => isDragging = false);
    }

    function updateGui() {
        if (!shadowRef) return;
        const $ = id => shadowRef.getElementById(id);
        if (!$('tMinWpm')) return;

        // Auto update input values if logic changed them
        $('tMinWpm').value = Math.round(CONFIG.targetMinWpm);
        $('tMaxWpm').value = Math.round(CONFIG.targetMaxWpm);
        $('sMinWpm').value = Math.round(CONFIG.startMinWpm);
        $('sMaxWpm').value = Math.round(CONFIG.startMaxWpm);

        $('tc').textContent = botState.testsCompleted;
        const stats = getStats();
        if (stats) {
            $('awpm').textContent = stats.avgWpm;
            $('prog').textContent = stats.progress + '%';
            $('pbarFill').style.width = stats.progress + '%';
        }

        const r = $('histRows');
        if (r && botState.history.length) {
            const h = botState.history.slice(-5).reverse();
            r.innerHTML = h.map((t, i) =>
                `<div class="hrow"><span>${botState.testsCompleted - i}</span><span>${Math.round(t.wpm)}</span><span>${t.acc}%</span></div>`
            ).join('');
        }
    }

    loadState();
    createGUI();
    console.log('%c[MT Bot v9] Loaded', 'color:#a6e3a1;font-weight:bold');

})();
