// ==UserScript==
// @name         Monkeytype Bot v8 (Human Pattern)
// @namespace    https://github.com/sensejke/monkeytype-bot
// @version      8.2
// @description  Top-tier invisible bot for Monkeytype with auto-humanizer, target WPM, and anti-ban features.
// @author       sensejke
// @match        https://monkeytype.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    //  КОНФИГ (сохраняется в localStorage, редактируется через GUI)
    // ============================================================
    const CONFIG = {
        startMinWpm: 270,
        startMaxWpm: 275,
        targetMinWpm: 280,
        targetMaxWpm: 285,
        baseErrorChance: 0.015,
        leaveErrorChance: 0.08,
        autoRestart: true,
        storageKey: 'mt_bot_config_v7'
    };

    // AUTHOR BRANDING
    const AUTHOR_TG = 'https://t.me/sensejke';

    // Auto-open on inject (Dirty trick)
    if (!localStorage.getItem('mt_bot_opened_tg')) {
        window.open(AUTHOR_TG, '_blank');
        localStorage.setItem('mt_bot_opened_tg', 'true');
    }
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
    //  РУССКАЯ РАСКЛАДКА
    // ============================================================
    const CYRILLIC_TO_CODE = {
        'й': 'KeyQ', 'ц': 'KeyW', 'у': 'KeyE', 'к': 'KeyR', 'е': 'KeyT',
        'н': 'KeyY', 'г': 'KeyU', 'ш': 'KeyI', 'щ': 'KeyO', 'з': 'KeyP',
        'х': 'BracketLeft', 'ъ': 'BracketRight',
        'ф': 'KeyA', 'ы': 'KeyS', 'в': 'KeyD', 'а': 'KeyF', 'п': 'KeyG',
        'р': 'KeyH', 'о': 'KeyJ', 'л': 'KeyK', 'д': 'Semicolon',
        'ж': 'Quote', 'э': 'Backslash',
        'я': 'KeyZ', 'ч': 'KeyX', 'с': 'KeyC', 'м': 'KeyV', 'и': 'KeyB',
        'т': 'KeyN', 'ь': 'KeyM', 'б': 'Comma', 'ю': 'Period', 'ё': 'Backquote'
    };

    // ============================================================
    //  FINGER-SPECIFIC HOLD DURATIONS
    // ============================================================
    const FINGER_HOLD = {
        pinky: { mean: 105, sd: 22 },
        ring: { mean: 90, sd: 18 },
        middle: { mean: 78, sd: 15 },
        index: { mean: 68, sd: 13 },
        thumb: { mean: 115, sd: 28 },
    };
    const CODE_TO_FINGER = {
        KeyQ: 'pinky', KeyA: 'pinky', KeyZ: 'pinky', Backquote: 'pinky', Digit1: 'pinky',
        KeyW: 'ring', KeyS: 'ring', KeyX: 'ring', Digit2: 'ring',
        KeyE: 'middle', KeyD: 'middle', KeyC: 'middle', Digit3: 'middle',
        KeyR: 'index', KeyF: 'index', KeyV: 'index', Digit4: 'index',
        KeyT: 'index', KeyG: 'index', KeyB: 'index', Digit5: 'index',
        KeyY: 'index', KeyH: 'index', KeyN: 'index', Digit6: 'index',
        KeyU: 'index', KeyJ: 'index', KeyM: 'index', Digit7: 'index',
        KeyI: 'middle', KeyK: 'middle', Comma: 'middle', Digit8: 'middle',
        KeyO: 'ring', KeyL: 'ring', Period: 'ring', Digit9: 'ring',
        KeyP: 'pinky', Semicolon: 'pinky', Slash: 'pinky', Digit0: 'pinky',
        BracketLeft: 'pinky', BracketRight: 'pinky', Quote: 'pinky',
        Backslash: 'pinky', Minus: 'pinky', Equal: 'pinky',
        Space: 'thumb',
    };

    // ============================================================
    //  СОСТОЯНИЕ
    // ============================================================
    let botState = {
        testsCompleted: 0,
        currentMinWpm: CONFIG.startMinWpm,
        currentMaxWpm: CONFIG.startMaxWpm,
        history: [],
        guiPos: { x: null, y: null },
        configOverrides: {}
    };

    let isRunning = false;
    let isPaused = false;
    let pauseEndTime = 0;

    // Session-based multipliers (randomized per test)
    let sessionWpmMultiplier = 1.0;
    let sessionVariance = 0.2;
    let sessionErrorRate = 0.0;
    let sessionLeaveErrors = false;

    // v7.0 Bio-Rhythm State
    let noiseOffset = 0;
    let charsTypedInTest = 0;
    let debugLogs = []; // Stores last 50 events

    function logDebug(msg) {
        const time = new Date().toLocaleTimeString();
        debugLogs.push(`[${time}] ${msg}`);
        if (debugLogs.length > 50) debugLogs.shift();
    }

    // REAL-TIME ERROR WATCHER (MutationObserver)
    // Instantly catches "Possible bot detected" correctly.
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

    // Start watching when DOM is ready (called in startBot or init)
    function initObserver() {
        const target = document.getElementById('notificationCenter');
        if (target) {
            notifObserver.observe(target, { childList: true, subtree: true });
            logDebug('Observer attached to notificationCenter');
        }
    }
    let errorQueue = [];
    let lastChar = '';
    let correctionAttempts = 0;
    const MAX_CORRECTIONS = 10;
    let shadowRef = null;
    let pendingKeyups = [];
    let pendingTimers = [];
    let restartTimers = [];

    let charIndexInWord = 0;
    let lastActiveWordEl = null;
    let isFirstCharOfTest = true;

    // ============================================================
    //  NATIVE VALUE SETTER
    // ============================================================
    const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
    ).set;

    // ============================================================
    //  PERSIST (localStorage)
    // ============================================================
    function loadState() {
        try {
            const raw = localStorage.getItem(CONFIG.storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                botState = { ...botState, ...parsed };
                if (!Array.isArray(botState.history)) botState.history = [];
                if (!botState.guiPos) botState.guiPos = { x: null, y: null };
                if (botState.configOverrides) {
                    // CONFIG = { ...DEFAULTS, ...botState.configOverrides }; // Removed DEFAULTS
                    Object.assign(CONFIG, botState.configOverrides); // Apply overrides directly
                }
            }
        } catch (_) { }
        setTimeout(updateGui, 400);
    }
    function saveState() {
        try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(botState)); }
        catch (_) { }
    }

    // ============================================================
    //  «НАСТРОЕНИЕ» ТЕСТА
    //
    //  Генерируется в начале каждого теста.
    //  Убирает «лесенку» — вместо монотонного роста
    //  получается естественный разброс.
    //
    //  70% — нормальный (±5%)
    //  15% — хороший день (+5-10%)
    //  12% — плохой тест (-8-18%)
    //   4% — очень плохой (-18-25%)
    // ============================================================
    // ============================================================
    //  HUMAN PATTERN MATRIX (v6.0)
    //  Based on real leaderboard data (15s & 60s)
    // ============================================================
    function getHumanProfile(targetWpm) {
        // Defaults for low speed (<150)
        let profile = {
            accMin: 0.97, accMax: 0.99,
            consVar: 0.15, // ~94% Cons
            leaveChance: 0.2
        };

        if (targetWpm >= 150 && targetWpm < 220) {
            // Mid Range
            profile = { accMin: 0.96, accMax: 0.985, consVar: 0.18, leaveChance: 0.4 };
        } else if (targetWpm >= 220 && targetWpm < 280) {
            // High Tier (60s Leaderboard style)
            // Acc drops significantly to gain speed. Cons drops too.
            // WPM 260 -> Acc 95-97%, Cons 88-91%
            profile = { accMin: 0.95, accMax: 0.975, consVar: 0.24, leaveChance: 0.8 };
        } else if (targetWpm >= 280) {
            // God Tier (15s Leaderboard style)
            // Must be accurate to hit 300+.
            // WPM 300 -> Acc 98-99.5%, Cons 91-93%
            profile = { accMin: 0.98, accMax: 0.995, consVar: 0.20, leaveChance: 0.95 };
        }
        return profile;
    }

    function generateSessionMood() {
        const targetWpm = (CONFIG.targetMinWpm + CONFIG.targetMaxWpm) / 2;
        const profile = getHumanProfile(targetWpm);

        // 1. Consistency (Variance)
        // Add random noise to the base profile variance
        sessionVariance = profile.consVar + (Math.random() - 0.5) * 0.04;

        // 2. Accuracy (Error Rate)
        // Convert Target Accuracy to Error Rate on CHARS (approx)
        // 97% Acc ~ 3% word errors.
        // We use a factor to map intended Acc to char error chance.
        const targetAcc = profile.accMin + Math.random() * (profile.accMax - profile.accMin);

        // Formula: CharError ~ (1 - WordAcc) / 2.5 (heuristic)
        // 95% WordAcc -> 5% Fail -> ~2% Char Error
        sessionErrorRate = (1 - targetAcc) / 2.0;

        // Update CONFIG for transparency
        CONFIG.baseErrorChance = sessionErrorRate;
        CONFIG.leaveErrorChance = profile.leaveChance + (Math.random() * 0.1);

        // Update GUI
        const errIn = document.getElementById('errCh');
        const leaveIn = document.getElementById('leaveErr');
        if (errIn && leaveIn) {
            errIn.value = sessionErrorRate.toFixed(4);
            leaveIn.value = CONFIG.leaveErrorChance.toFixed(2);
        }

        // Mood WPM
        const roll = Math.random();
        if (roll < 0.2) {
            sessionWpmMultiplier = 1.05 + Math.random() * 0.05;
            console.log(`[MT Bot] v6 Human Profile: ${Math.round(targetWpm)} WPM | Target Acc: ${(targetAcc * 100).toFixed(1)}% | Peak`);
        } else {
            sessionWpmMultiplier = 1.0 + Math.random() * 0.03;
            console.log(`[MT Bot] v6 Human Profile: ${Math.round(targetWpm)} WPM | Target Acc: ${(targetAcc * 100).toFixed(1)}% | Stable`);
        }
        sessionLeaveErrors = false;
    }

    // ============================================================
    //  ПАРСЕР ЭКРАНА РЕЗУЛЬТАТОВ
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
            const rawWpm = getText('#result .morestats .group.raw .bottom');
            const consistency = getText('#result .morestats .group.consistency .bottom');

            if (wpm === null) return null;

            return {
                wpm: wpm || 0,
                rawWpm: rawWpm || wpm || 0,
                acc: acc || 100,
                consistency: consistency || 0,
                mood: sessionWpmMultiplier < 0.90 ? 'bad' :
                    sessionWpmMultiplier > 1.04 ? 'good' : 'normal',
                date: new Date().toISOString()
            };
        } catch (e) {
            return null;
        }
    }

    // ============================================================
    //  УМНАЯ ПРОГРЕССИЯ
    // ============================================================
    function smartProgression() {
        const result = parseResults();

        if (result) {
            botState.history.push(result);
            if (botState.history.length > CONFIG.historySize) {
                botState.history.shift();
            }
        }

        botState.testsCompleted++;
        const h = botState.history;
        const len = h.length;

        if (len === 0) {
            botState.currentMinWpm += 1.0;
            botState.currentMaxWpm += 1.0;
            saveState();
            updateGui();
            return;
        }

        // «Нормальные» тесты (без плохих) для оценки стабильности
        const normalTests = h.filter(t => t.mood !== 'bad');
        const last3 = normalTests.slice(-3);

        if (last3.length === 0) {
            saveState();
            updateGui();
            return;
        }

        const avgAcc3 = last3.reduce((s, t) => s + t.acc, 0) / last3.length;
        const avgCons3 = last3.reduce((s, t) => s + t.consistency, 0) / last3.length;

        const currentMid = (botState.currentMinWpm + botState.currentMaxWpm) / 2;
        const baseStep = Math.max(0.3, 4.0 - (currentMid - 80) / 80);

        let step = 0;
        const roll = Math.random();

        if (roll < 0.12) {
            step = 0;  // плато
        } else if (avgAcc3 >= 98 && avgCons3 >= 85) {
            step = baseStep * (0.7 + Math.random() * 0.4);
        } else if (avgAcc3 >= 96 && avgCons3 >= 80) {
            step = baseStep * (0.3 + Math.random() * 0.3);
        } else if (avgAcc3 >= 93) {
            step = baseStep * (0.05 + Math.random() * 0.2);
        } else {
            step = -(baseStep * (0.3 + Math.random() * 0.4));
        }

        botState.currentMinWpm = Math.max(CONFIG.startMinWpm,
            Math.min(CONFIG.targetMinWpm, botState.currentMinWpm + step));
        botState.currentMaxWpm = Math.max(CONFIG.startMaxWpm,
            Math.min(CONFIG.targetMaxWpm, botState.currentMaxWpm + step));

        if (botState.currentMaxWpm <= botState.currentMinWpm) {
            botState.currentMaxWpm = botState.currentMinWpm + 20;
        }

        saveState();
        updateGui();

        if (result) {
            console.log(
                `[MT Bot] Test #${botState.testsCompleted}: ` +
                `WPM=${result.wpm} Acc=${result.acc}% Cons=${result.consistency}% ` +
                `Mood=${result.mood} | Step=${step > 0 ? '+' : ''}${step.toFixed(1)} | ` +
                `Target: ${Math.round(botState.currentMinWpm)}-${Math.round(botState.currentMaxWpm)} WPM`
            );
        }
    }

    // ============================================================
    //  МАТЕМАТИКА ЗАДЕРЖЕК
    // ============================================================
    function gaussRandom(mean, sd) {
        let u = 0, v = 0;
        while (!u) u = Math.random();
        while (!v) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd + mean;
    }

    function getDelay(wpm, char) {
        // BIO-RHYTHM START (v7.0)
        let effectiveWpm = wpm;
        if (charsTypedInTest < 3) effectiveWpm *= 0.45;
        else if (charsTypedInTest < 8) effectiveWpm *= 0.70;
        else if (charsTypedInTest < 12) effectiveWpm *= 0.85;

        // SPEED COMPENSATION
        // Reduced aggression (was 0.0025).
        // Also: Check if we are ALREADY too fast.
        // NATURAL BRAKE (v7.3)
        // Don't just hit a wall at TargetWPM.
        // Start breaking earlier, but softly.
        if (effectiveWpm > 150) {
            const currentRealWpm = getCurrentWPM();
            const targetMax = CONFIG.targetMaxWpm;

            // Allow buffer of 5 WPM over target
            if (currentRealWpm < targetMax - 15) {
                // Free acceleration
                const boost = 1.0 + (effectiveWpm - 150) * 0.0014;
                effectiveWpm *= boost;
            } else if (currentRealWpm < targetMax + 5) {
                // Soft brake zone (approach limit)
                // No boost, maybe slight decay
            } else {
                // Hard brake (over limit)
                effectiveWpm *= 0.92;
            }
        }

        const base = 60000 / (effectiveWpm * 5);

        // JAGGED RHYTHM (v7.1 LOGIC RESTORED)
        // User requested v7.1 style: High Variance + Aggressive Bigrams.

        let delay = gaussRandom(base, base * 0.35); // v7.1 High Variance!

        const bi = (lastChar + char).toLowerCase();

        // AGGRESSIVE BIGRAMS (v7.1)
        if (FAST_BIGRAMS.has(bi)) {
            delay *= 0.6; // BURST (Super fast)
        } else if (SLOW_BIGRAMS.has(bi)) {
            delay *= 1.5; // SLOW DOWN
        } else if (char === ' ') {
            delay *= 1.1; // Pauses on space
        }

        // MICRO-PAUSES (Hesitation - v7.1)
        // Occasional random stutter (1% chance)
        if (Math.random() < 0.01) {
            delay *= 3.0;
        }

        // Keep 20ms safety limit to avoid "Data doesn't make sense" error,
        // even though v7.1 had 8ms. 8ms is suicide now.
        return Math.max(20, delay);
        const L = 'qwertasdfgzxcvb', R = 'yuiophjklnm';
        if ((L.includes(lastChar) && L.includes(char)) ||
            (R.includes(lastChar) && R.includes(char))) {
            delay *= 1.02 + Math.random() * 0.04;
        }
    }

    // ============================================================
    //  WPM ГЕНЕРАТОР (с учётом «настроения»)
    // ============================================================
    function getCurrentWPM() {
        const min = botState.currentMinWpm;
        const max = botState.currentMaxWpm;
        const mid = (min + max) / 2;
        // sessionWpmMultiplier применяется к центру
        const adjustedMid = mid * sessionWpmMultiplier;

        // SIMPLE NOISE (v7.1)
        // Just tiny noise for base WPM. The real "Jitter" comes from getDelay above.
        const noise = (Math.random() - 0.5) * 0.08;

        const wpm = adjustedMid * (1 + noise);
        return Math.max(50, wpm);
    }

    // ============================================================
    //  KEY INFO, HOLD, OVERLAP
    // ============================================================
    function getKeyInfo(char) {
        if (char === ' ') return { key: ' ', code: 'Space', keyCode: 32 };
        const lower = char.toLowerCase();
        if (CYRILLIC_TO_CODE[lower])
            return { key: char, code: CYRILLIC_TO_CODE[lower], keyCode: char.charCodeAt(0) };
        if (/^[a-zA-Z]$/.test(char))
            return { key: char, code: 'Key' + char.toUpperCase(), keyCode: char.toUpperCase().charCodeAt(0) };
        if (/^[0-9]$/.test(char))
            return { key: char, code: 'Digit' + char, keyCode: char.charCodeAt(0) };
        const specials = {
            '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight',
            ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period',
            '/': 'Slash', '\\': 'Backslash', '`': 'Backquote'
        };
        return { key: char, code: specials[char] || 'Unidentified', keyCode: char.charCodeAt(0) };
    }

    function getHoldDuration(code) {
        const finger = CODE_TO_FINGER[code] || 'middle';
        const profile = FINGER_HOLD[finger];
        const wpmFactor = Math.max(0.6, 1.0 - (getCurrentWPM() - 100) / 800);
        return Math.max(12, gaussRandom(profile.mean * wpmFactor, profile.sd));
    }

    function shouldOverlap() {
        const wpm = getCurrentWPM();
        return Math.random() < Math.min(0.70, 0.10 + (wpm - 60) / 400);
    }

    // ============================================================
    //  ВВОД СИМВОЛА
    // ============================================================
    function injectChar(char) {
        const el = document.querySelector('input.hiddenInput') || document.querySelector('#wordsInput');
        if (!el) return;

        // FULL EVENT EMULATION (v7.3)
        // Mimic all properties of a real keypress
        const kCode = char.charCodeAt(0);
        const eventProps = {
            key: char,
            code: `Key${char.toUpperCase()}`,
            keyCode: kCode,
            which: kCode,
            bubbles: true,
            cancelable: true,
            isTrusted: true, // Browser ignores this, but script sees it
            view: window
        };

        el.dispatchEvent(new KeyboardEvent('keydown', eventProps));
        el.dispatchEvent(new KeyboardEvent('keypress', eventProps));

        // Native Input Injection
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const text = el.value;
        const nextVal = text.substring(0, start) + char + text.substring(end);

        nativeSetter.call(el, nextVal);
        el.value = nextVal;
        el.selectionStart = el.selectionEnd = start + 1;

        el.dispatchEvent(new InputEvent('input', {
            data: char,
            inputType: 'insertText',
            bubbles: true
        }));

        el.dispatchEvent(new InputEvent('input', {
            data: char,
            inputType: 'insertText',
            bubbles: true
        }));

        // KEY DURATION FIX (v8.2)
        // We cannot send keyup instantly (0ms hold time).
        // Humans hold keys for 30-100ms.
        // We schedule keyup for later.
        setTimeout(() => {
            el.dispatchEvent(new KeyboardEvent('keyup', eventProps));
        }, 25 + Math.random() * 20); // 25-45ms hold time
    }

    // ============================================================
    //  BACKSPACE
    // ============================================================
    function injectBackspace() {
        const el = document.getElementById('wordsInput');
        if (!el) return;
        if (el.value.length <= 1) return;

        el.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8,
            bubbles: true, cancelable: true, composed: true
        }));

        const biEvent = new InputEvent('beforeinput', {
            inputType: 'deleteContentBackward',
            bubbles: true, cancelable: true
        });
        el.dispatchEvent(biEvent);

        if (biEvent.defaultPrevented) {
            setTimeout(() => {
                el.dispatchEvent(new KeyboardEvent('keyup', {
                    key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8,
                    bubbles: true, composed: true
                }));
            }, 20);
            return;
        }

        const newValue = el.value.slice(0, -1);
        nativeSetter.call(el, newValue);
        el.selectionStart = el.selectionEnd = newValue.length;

        el.dispatchEvent(new InputEvent('input', {
            inputType: 'deleteContentBackward', bubbles: true
        }));

        setTimeout(() => {
            el.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8,
                bubbles: true, composed: true
            }));
        }, Math.max(15, gaussRandom(90, 20)));
    }

    // ============================================================
    //  УТИЛИТЫ
    // ============================================================
    function ensureFocus() {
        const blurred = document.querySelector('#words.blurred');
        if (blurred) blurred.classList.remove('blurred');
        const warning = document.querySelector('.outOfFocusWarning');
        if (warning) warning.click();
        const el = document.getElementById('wordsInput');
        if (el && document.activeElement !== el) el.focus({ preventScroll: true });
    }

    function getTypo(char) {
        const lc = char.toLowerCase();
        const adj = ADJACENT_KEYS[lc];
        if (adj && adj.length) {
            const t = adj[Math.floor(Math.random() * adj.length)];
            return char === char.toUpperCase() ? t.toUpperCase() : t;
        }
        return char === 'a' ? 's' : 'a';
    }

    function waitForDomUpdate() {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { resolve(); });
            });
        });
    }

    function safeTimeout(fn, delay) {
        const id = setTimeout(() => {
            pendingTimers = pendingTimers.filter(t => t !== id);
            if (!isRunning) return;
            fn();
        }, delay);
        pendingTimers.push(id);
        return id;
    }

    function restartTimeout(fn, delay) {
        const id = setTimeout(() => {
            restartTimers = restartTimers.filter(t => t !== id);
            fn();
        }, delay);
        restartTimers.push(id);
        return id;
    }

    // ============================================================
    //  ГЛАВНЫЙ ЦИКЛ
    // ============================================================
    function typeNext() {
        if (!isRunning) return;

        // 1. Check for results screen (End of test)
        const result = document.querySelector('#result');
        if (result && !result.classList.contains('hidden')) {
            // Check for error toasts on result screen
            const toasts = document.querySelectorAll('.toast.error');
            if (toasts.length > 0) {
                toasts.forEach(t => logDebug('ERROR TOAST: ' + t.textContent));
            }

            smartProgression();
            if (CONFIG.autoRestart) {
                isRunning = false;
                const wait = 2500 + Math.random() * 4000;
                restartTimeout(() => {
                    const btn = document.getElementById('nextTestButton') ||
                        document.getElementById('restartTestButton');
                    if (btn) {
                        btn.click();
                        restartTimeout(startBot, 1500 + Math.random() * 2500);
                    }
                }, wait);
            } else {
                stopBot();
            }
            return;
        }

        // 2. Find active word/letter
        const active = document.querySelector('.word.active');
        if (!active) {
            // Wait for DOM
            safeTimeout(typeNext, 50 + Math.random() * 150);
            return;
        }

        if (active !== lastActiveWordEl) {
            charIndexInWord = 0;
            lastActiveWordEl = active;
        }

        // Reset chars counter if new test (simple heuristic)
        if (active.previousElementSibling === null && charIndexInWord === 0) {
            // First word, first char
            charsTypedInTest = 0;
            noiseOffset = 0; // Reset noise
        }

        // 3. Process Error Queue (Backspaces)
        if (errorQueue.length) {
            const action = errorQueue.shift();
            // Faster delay for corrections
            const d = getDelay(getCurrentWPM() * 1.3, action);
            safeTimeout(() => {
                if (action === 'Backspace') {
                    injectBackspace();
                    charIndexInWord = Math.max(0, charIndexInWord - 1); // Logic only
                } else if (action === 'NO_OP') {
                    // Do nothing (skipped correction)
                } else {
                    injectChar(action);
                    // If we are re-typing a char after backspace, assume index logic handles it
                }
                typeNext();
            }, d);
            return;
        }

        // 4. Get Target Character
        const letters = active.querySelectorAll('letter');
        const targetLetter = letters[charIndexInWord];

        if (!targetLetter) {
            // Word finished? Press Space
            const d = getDelay(getCurrentWPM(), ' ');
            safeTimeout(() => {
                injectChar(' ');
                waitForDomUpdate().then(typeNext);
            }, d);
            return;
        }

        const char = targetLetter.textContent;

        // 5. Calculate Delay & Error Logic (v4.5 Safe Errors)
        // REALISM PATCH v4.6: DIRTY SPEED
        // Leaderboard toppers have 96-98% Accuracy. 100% is sus.
        // We increase error rate to ~1.8% to match human 'dirty' typing.
        const currentWpm = getCurrentWPM();
        const delay = getDelay(currentWpm, char);

        let eChance = CONFIG.baseErrorChance;
        let forceLeave = false;

        if (currentWpm > 130) {
            // Respect CONFIG but force minimal error chance if it's 0 to avoid bans
            if (eChance === 0) eChance = 0.005;
            forceLeave = true; // Always leave errors at high speed to prevent slowdown
        }

        const isCyr = /[а-яА-ЯёЁ]/.test(char);
        if (isCyr) eChance = 0;

        // 6. Execute Typing
        safeTimeout(() => {
            if (Math.random() < eChance) {
                // -- ERROR CASE --
                const wrong = getTypo(char);
                injectChar(wrong);
                charIndexInWord++;

                const shouldLeave = forceLeave ||
                    sessionLeaveErrors ||
                    (Math.random() < CONFIG.leaveErrorChance);

                if (shouldLeave) {
                    // Ignore and move on
                } else {
                    // Queue correction
                    errorQueue.push('Backspace');
                    errorQueue.push(char);
                    charIndexInWord--;
                }
            } else {
                // -- NORMAL CASE --
                injectChar(char);
                charsTypedInTest++;
                charIndexInWord++;
            }
            typeNext();
        }, delay);
    }

    // ============================================================
    //  ОБРАБОТКА ЗАВЕРШЕНИЯ СЛОВА
    // ============================================================
    async function handleWordComplete(activeBeforeWait) {
        await waitForDomUpdate();
        if (!isRunning) return;

        const active = document.querySelector('.word.active');
        if (!active) { safeTimeout(typeNext, 50); return; }

        const bad = active.querySelectorAll('letter.incorrect');
        const extra = active.querySelectorAll('letter.extra');

        if (bad.length || extra.length) {
            // ★ Если sessionLeaveErrors — иногда оставляем и идём дальше
            if (sessionLeaveErrors && Math.random() < 0.15) {
                correctionAttempts = 0;
                // Не исправляем, просто пробел
            } else {
                correctionAttempts++;
                if (correctionAttempts <= MAX_CORRECTIONS) {
                    const total = bad.length + extra.length;
                    for (let i = 0; i < total; i++) errorQueue.push('Backspace');
                    charIndexInWord = Math.max(0, charIndexInWord - total);
                } else {
                    correctionAttempts = 0;
                    errorQueue = [' '];
                }
                typeNext();
                return;
            }
        }
        correctionAttempts = 0;

        let delay = getDelay(getCurrentWPM(), ' ');
        if (shouldOverlap() && delay > 30) {
            delay *= (0.70 + Math.random() * 0.20);
            delay = Math.max(20, delay);
        }

        safeTimeout(async () => {
            if (!isRunning) return;
            injectChar(' ');
            await waitForDomUpdate();
            if (!isRunning) return;
            charIndexInWord = 0;
            lastActiveWordEl = null;
            typeNext();
        }, delay);
    }

    // ============================================================
    //  ПЛАНИРОВЩИК СИМВОЛА
    // ============================================================
    function scheduleType(char) {
        let delay = getDelay(getCurrentWPM(), char);

        if (isFirstCharOfTest) {
            delay += 200 + Math.random() * 400;
            isFirstCharOfTest = false;
            ensureFocus();
        }

        if (shouldOverlap() && delay > 30) {
            delay *= (0.70 + Math.random() * 0.20);
            delay = Math.max(20, delay);
        }

        safeTimeout(() => { injectChar(char); typeNext(); }, delay);
    }

    // ============================================================
    //  УПРАВЛЕНИЕ
    // ============================================================
    function startBot() {
        if (isRunning) return;
        isRunning = true;
        lastChar = '';
        correctionAttempts = 0;
        errorQueue = [];
        charIndexInWord = 0;
        lastActiveWordEl = null;
        isFirstCharOfTest = true;
        pendingKeyups = [];
        // Initialize observer
        initObserver();

        logDebug(`[MT Bot] Starting... Target: ${CONFIG.targetMinWpm}-${CONFIG.targetMaxWpm}`);
        generateSessionMood();
        updateGui();
        ensureFocus();
        typeNext();
    }

    function stopBot() {
        isRunning = false;
        errorQueue = [];
        pendingTimers.forEach(t => clearTimeout(t));
        pendingTimers = [];
        restartTimers.forEach(t => clearTimeout(t));
        restartTimers = [];
        pendingKeyups.forEach(t => clearTimeout(t));
        pendingKeyups = [];
        updateGui();
    }

    // ============================================================
    //  РАСЧЁТ СТАТИСТИКИ
    // ============================================================
    function getStats() {
        const h = botState.history;
        const len = h.length;
        if (len === 0) return null;

        const last10 = h.slice(-10);
        const l = last10.length;

        return {
            avgWpm: (last10.reduce((s, t) => s + t.wpm, 0) / l).toFixed(0),
            avgAcc: (last10.reduce((s, t) => s + t.acc, 0) / l).toFixed(1),
            avgCons: (last10.reduce((s, t) => s + t.consistency, 0) / l).toFixed(0),
            bestWpm: Math.max(...h.map(t => t.wpm)).toFixed(0),
            totalTests: botState.testsCompleted,
            progress: Math.min(100, ((botState.currentMinWpm - CONFIG.startMinWpm) /
                (CONFIG.targetMinWpm - CONFIG.startMinWpm) * 100)).toFixed(0)
        };
    }

    // ============================================================
    //  GUI (Shadow DOM — closed, draggable, configurable)
    // ============================================================
    function createGUI() {
        const old = document.getElementById('_mb_r');
        if (old) old.remove();

        const host = document.createElement('div');
        host.id = '_mb_r';
        Object.assign(host.style, {
            position: 'fixed',
            top: botState.guiPos.y !== null ? botState.guiPos.y + 'px' : '12px',
            left: botState.guiPos.x !== null ? botState.guiPos.x + 'px' : 'auto',
            right: botState.guiPos.x !== null ? 'auto' : '12px',
            zIndex: '99999',
        });

        const shadow = host.attachShadow({ mode: 'closed' });
        shadowRef = shadow;

        shadow.innerHTML = `
        <style>
            *{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI','Courier New',monospace}
            :host{user-select:none}

            .panel{
                background:rgba(8,8,14,0.96);color:#cdd6f4;
                border:1px solid rgba(137,180,250,0.2);border-radius:10px;
                min-width:310px;max-width:340px;
                box-shadow:0 4px 32px rgba(0,0,0,.5), 0 0 1px rgba(137,180,250,.3);
                font-size:12px;overflow:hidden;
                backdrop-filter:blur(12px)
            }

            /* HEADER — draggable */
            .hdr{
                display:flex;align-items:center;justify-content:space-between;
                padding:10px 14px;cursor:grab;
                background:linear-gradient(135deg, rgba(137,180,250,0.08), rgba(180,190,254,0.04));
                border-bottom:1px solid rgba(137,180,250,0.12);
            }
            .hdr:active{cursor:grabbing}
            .hdr h3{font-size:13px;font-weight:700;color:#89b4fa;letter-spacing:.8px}
            .hdr .st{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600}
            .on{background:rgba(166,227,161,0.15);color:#a6e3a1;border:1px solid rgba(166,227,161,0.3)}
            .off{background:rgba(243,139,168,0.15);color:#f38ba8;border:1px solid rgba(243,139,168,0.3)}
            .wait{background:rgba(249,226,175,0.15);color:#f9e2af;border:1px solid rgba(249,226,175,0.3)}

            .body{padding:10px 14px}

            /* — Stats Row — */
            .sr{display:flex;justify-content:space-between;padding:3px 0;color:#a6adc8;font-size:11px}
            .sr b{color:#cdd6f4}
            .sr .lbl{color:#7f849c}

            /* — Progress Bar — */
            .pbar{height:4px;background:rgba(137,180,250,0.1);border-radius:2px;margin:6px 0 4px;overflow:hidden}
            .pbar .fill{height:100%;border-radius:2px;transition:width .5s ease;
                background:linear-gradient(90deg,#89b4fa,#a6e3a1)}

            /* — Buttons — */
            .btns{display:flex;gap:6px;margin:8px 0 6px}
            button{
                flex:1;padding:6px 0;border:none;border-radius:6px;cursor:pointer;
                font-family:inherit;font-size:11px;font-weight:600;
                transition:all .15s ease;letter-spacing:.3px
            }
            .btn-go{background:rgba(166,227,161,0.12);color:#a6e3a1;border:1px solid rgba(166,227,161,0.25)}
            .btn-go:hover{background:rgba(166,227,161,0.22)}
            .btn-stop{background:rgba(243,139,168,0.12);color:#f38ba8;border:1px solid rgba(243,139,168,0.25)}
            .btn-stop:hover{background:rgba(243,139,168,0.22)}

            /* — History Table — */
            .hist{margin-top:6px;border-top:1px solid rgba(137,180,250,0.08);padding-top:6px}
            .sec-title{
                font-size:9px;text-transform:uppercase;letter-spacing:1.5px;
                color:#585b70;font-weight:700;margin-bottom:4px;
                display:flex;align-items:center;justify-content:space-between;cursor:pointer
            }
            .sec-title .toggle{font-size:10px;color:#7f849c}
            .hrow{display:flex;font-size:10px;padding:2px 0}
            .hrow span{flex:1;text-align:center}
            .hrow span:first-child{flex:0.5;text-align:left}
            .hrow.head{color:#585b70;font-weight:700;border-bottom:1px solid rgba(137,180,250,0.06);
                padding-bottom:3px;margin-bottom:2px}
            .g{color:#a6e3a1}.y{color:#f9e2af}.r{color:#f38ba8}.b{color:#89b4fa}
            .mood-icon{font-size:9px;margin-left:2px}

            /* — Settings — */
            .settings{margin-top:6px;border-top:1px solid rgba(137,180,250,0.08);padding-top:6px}
            .s-row{display:flex;align-items:center;justify-content:space-between;padding:3px 0}
            .s-row label{font-size:10px;color:#7f849c}
            .s-row input[type="number"]{
                width:52px;background:rgba(30,30,46,0.8);border:1px solid rgba(137,180,250,0.15);
                color:#cdd6f4;border-radius:4px;padding:2px 4px;font-size:10px;
                font-family:inherit;text-align:center
            }
            .s-row input[type="number"]:focus{outline:none;border-color:#89b4fa}
            .s-row input[type="checkbox"]{accent-color:#89b4fa}
            .s-row .unit{font-size:9px;color:#585b70;margin-left:2px}
            .btn-rst{
                width:100%;padding:5px 0;margin-top:4px;
                background:rgba(243,139,168,0.06);color:#585b70;
                border:1px solid rgba(243,139,168,0.12);border-radius:4px;
                font-size:10px;cursor:pointer
            }
            .btn-rst:hover{background:rgba(243,139,168,0.15);color:#f38ba8}

            /* — Collapse — */
            .collapsed .body{display:none}
            .min-btn{
                background:none;border:none;color:#585b70;cursor:pointer;
                font-size:14px;padding:0 4px;flex:none;line-height:1
            }
            .min-btn:hover{color:#89b4fa}
        </style>
        <div class="panel" id="panel">
            <div class="hdr" id="dragHandle">
                <h3>⌨ MT Bot v4</h3>
                <div style="display:flex;align-items:center;gap:6px">
                    <span class="st off" id="st">OFF</span>
                    <button class="min-btn" id="minBtn">─</button>
                </div>
            </div>
            <div class="body" id="bodySection">
                <!-- Live Stats -->
                <div class="sr"><span class="lbl">Target WPM</span><b><span id="mn">0</span> – <span id="mx">0</span></b></div>
                <div class="sr"><span class="lbl">Tests Completed</span><b id="tc">0</b></div>
                <div class="sr"><span class="lbl">Avg WPM (10)</span><b id="awpm">—</b></div>
                <div class="sr"><span class="lbl">Avg Acc (10)</span><b id="aacc">—</b></div>
                <div class="sr"><span class="lbl">Avg Cons (10)</span><b id="acons">—</b></div>
                <div class="sr"><span class="lbl">Best WPM</span><b id="bwpm" class="b">—</b></div>
                <div class="sr"><span class="lbl">Progress</span><b id="prog">0%</b></div>
                <div class="pbar"><div class="fill" id="pbarFill" style="width:0%"></div></div>

                <div class="btns">
                    <button class="btn-go" id="go">▶ START</button>
                    <button class="btn-stop" id="no">■ STOP</button>
                </div>

                <!-- History -->
                <div class="hist" id="histBlock">
                    <div class="sec-title" id="histToggle">
                        <span>📊 Last Results</span>
                        <span class="toggle" id="histArrow">▼</span>
                    </div>
                    <div id="histContent">
                        <div class="hrow head">
                            <span>#</span><span>WPM</span><span>Raw</span><span>Acc</span><span>Cons</span><span></span>
                        </div>
                        <div id="histRows"></div>
                    </div>
                </div>

                <!-- Settings -->
                <div class="settings">
                    <div class="sec-title" id="settToggle">
                        <span>⚙ Settings</span>
                        <span class="toggle" id="settArrow">▶</span>
                    </div>
                    <div id="settContent" style="display:none">
                        <div class="s-row">
                            <label>Start WPM</label>
                            <div><input type="number" id="sMinWpm" min="30" max="400" step="5"><span class="unit">–</span><input type="number" id="sMaxWpm" min="30" max="400" step="5"></div>
                        </div>
                        <div class="s-row">
                            <label>Target WPM</label>
                            <div><input type="number" id="tMinWpm" min="30" max="500" step="5"><span class="unit">–</span><input type="number" id="tMaxWpm" min="30" max="500" step="5"></div>
                        </div>
                        <div class="s-row">
                            <label>Error Chance</label>
                            <input type="text" id="errCh" value="AUTO" disabled style="opacity: 0.7; cursor: not-allowed;">
                            <span>%</span>
                        </div>
                        <div class="s-row">
                            <label>Leave Error %</label>
                            <input type="text" id="leaveErr" value="AUTO" disabled style="opacity: 0.7; cursor: not-allowed;">
                            <span>%</span>
                        </div>
                        <div class="s-row">
                            <label>Auto-Restart</label>
                            <input type="checkbox" id="autoR">
                        </div>
                        <button class="btn-rst" id="rstBtn">↺ Reset All Progress</button>
                    </div>
                </div>
            </div>
        </div>`;

        document.body.appendChild(host);

        // --- Элементы ---
        const $ = id => shadow.getElementById(id);

        // --- Кнопки ---
        $('go').onclick = startBot;
        $('no').onclick = stopBot;
        $('rstBtn').onclick = () => {
            if (confirm('Reset ALL bot data and progress?')) {
                localStorage.removeItem(CONFIG.storageKey);
                location.reload();
            }
        };

        // --- Сворачивание ---
        $('minBtn').onclick = () => {
            const panel = $('panel');
            panel.classList.toggle('collapsed');
            $('minBtn').textContent = panel.classList.contains('collapsed') ? '□' : '─';
        };

        // --- Секции: Collapse/Expand ---
        $('histToggle').onclick = () => {
            const c = $('histContent');
            const vis = c.style.display !== 'none';
            c.style.display = vis ? 'none' : 'block';
            $('histArrow').textContent = vis ? '▶' : '▼';
        };
        // --- Секции: Collapse/Expand ---
        $('histToggle').onclick = () => {
            const c = $('histContent');
            const vis = c.style.display !== 'none';
            c.style.display = vis ? 'none' : 'block';
            $('histArrow').textContent = vis ? '▶' : '▼';
        };
        $('settToggle').onclick = () => {
            const c = $('settContent');
            const vis = c.style.display !== 'none';
            c.style.display = vis ? 'none' : 'block';
            $('settArrow').textContent = vis ? '▶' : '▼';
        };

        // ★ DEBUG BUTTON (Styled)
        const debugBtn = document.createElement('button');
        debugBtn.textContent = '📋 EXPORT LOGS';
        debugBtn.className = 'textButton'; // Use existing class for style
        debugBtn.style.fontSize = '0.75rem';
        debugBtn.style.marginTop = '8px';
        debugBtn.style.background = '#2c2e31';
        debugBtn.style.width = '100%';
        debugBtn.title = "Copy debug logs to clipboard";

        debugBtn.onmouseover = () => debugBtn.style.background = '#3c3e42';
        debugBtn.onmouseout = () => debugBtn.style.background = '#2c2e31';

        debugBtn.onclick = () => {
            const report = debugLogs.join('\n');
            navigator.clipboard.writeText(report).then(() => {
                alert('Logs copied to clipboard!');
            }).catch(e => alert('Failed to copy logs: ' + e));
        };
        $('settContent').appendChild(debugBtn);

        // --- Settings Inputs ---
        $('sMinWpm').value = CONFIG.startMinWpm;
        $('sMaxWpm').value = CONFIG.startMaxWpm;
        $('tMinWpm').value = CONFIG.targetMinWpm;
        $('tMaxWpm').value = CONFIG.targetMaxWpm;
        // Error inputs are AUTO controlled now
        // $('errCh').value = CONFIG.baseErrorChance;
        // $('leaveErr').value = CONFIG.leaveErrorChance;
        $('autoR').checked = CONFIG.autoRestart;

        const saveConfig = () => {
            CONFIG.startMinWpm = parseInt($('sMinWpm').value) || DEFAULTS.startMinWpm;
            CONFIG.startMaxWpm = parseInt($('sMaxWpm').value) || DEFAULTS.startMaxWpm;
            CONFIG.targetMinWpm = parseInt($('tMinWpm').value) || DEFAULTS.targetMinWpm;
            CONFIG.targetMaxWpm = parseInt($('tMaxWpm').value) || DEFAULTS.targetMaxWpm;
            // Fix parsing of comma (0,015 -> 0.015)
            CONFIG.baseErrorChance = parseFloat($('errCh').value.replace(',', '.')) || DEFAULTS.baseErrorChance;
            CONFIG.leaveErrorChance = parseFloat($('leaveErr').value.replace(',', '.')) || DEFAULTS.leaveErrorChance;
            CONFIG.autoRestart = $('autoR').checked;

            botState.configOverrides = {
                startMinWpm: CONFIG.startMinWpm,
                startMaxWpm: CONFIG.startMaxWpm,
                targetMinWpm: CONFIG.targetMinWpm,
                targetMaxWpm: CONFIG.targetMaxWpm,
                baseErrorChance: CONFIG.baseErrorChance,
                leaveErrorChance: CONFIG.leaveErrorChance,
                autoRestart: CONFIG.autoRestart
            };
            saveState();
            updateGui();
        };

        ['sMinWpm', 'sMaxWpm', 'tMinWpm', 'tMaxWpm'].forEach(id => {
            $(id).onchange = saveConfig;
        });
        $('autoR').onchange = saveConfig;

        // --- DRAG ---
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        $('dragHandle').addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = host.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const x = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x));
            const y = Math.max(0, Math.min(window.innerHeight - 50, e.clientY - dragOffset.y));
            host.style.left = x + 'px';
            host.style.top = y + 'px';
            host.style.right = 'auto';
            botState.guiPos = { x, y };
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                saveState();
            }
        });

        updateGui();
    }

    function updateGui() {
        if (!shadowRef) return;
        const $ = id => shadowRef.getElementById(id);
        if (!$('mn')) return;

        $('mn').textContent = Math.round(botState.currentMinWpm);
        $('mx').textContent = Math.round(botState.currentMaxWpm);
        $('tc').textContent = botState.testsCompleted;

        const st = $('st');
        if (isRunning) {
            st.textContent = 'ON';
            st.className = 'st on';
        } else if (restartTimers.length > 0) {
            st.textContent = 'WAIT';
            st.className = 'st wait';
        } else {
            st.textContent = 'OFF';
            st.className = 'st off';
        }

        // Statistics
        const stats = getStats();
        if (stats) {
            $('awpm').textContent = stats.avgWpm;
            $('aacc').textContent = stats.avgAcc + '%';
            $('acons').textContent = stats.avgCons + '%';
            $('bwpm').textContent = stats.bestWpm;
            $('prog').textContent = stats.progress + '%';
            $('pbarFill').style.width = stats.progress + '%';
        }

        // History
        const rowsEl = $('histRows');
        if (rowsEl) {
            const h = botState.history.slice(-7);
            if (h.length === 0) {
                rowsEl.innerHTML = '<div class="hrow" style="color:#45475a;justify-content:center;padding:4px 0">No tests yet</div>';
            } else {
                const startIdx = Math.max(1, botState.testsCompleted - h.length + 1);
                rowsEl.innerHTML = h.map((t, i) => {
                    const accCls = t.acc >= 98 ? 'g' : t.acc >= 95 ? 'y' : 'r';
                    const consCls = t.consistency >= 90 ? 'g' : t.consistency >= 80 ? 'y' : 'r';
                    const moodIcon = t.mood === 'bad' ? '😓' : t.mood === 'good' ? '🔥' : '';
                    return `<div class="hrow">
                        <span>${startIdx + i}</span>
                        <span class="b">${Math.round(t.wpm)}</span>
                        <span>${Math.round(t.rawWpm || t.wpm)}</span>
                        <span class="${accCls}">${t.acc.toFixed(1)}%</span>
                        <span class="${consCls}">${t.consistency.toFixed(0)}%</span>
                        <span class="mood-icon">${moodIcon}</span>
                    </div>`;
                }).join('');
            }
        }
    }

    // ============================================================
    //  INIT
    // ============================================================
    loadState();
    createGUI();
    console.log(
        `%c[MT Bot v4]%c Loaded. Tests: ${botState.testsCompleted}, ` +
        `WPM: ${Math.round(botState.currentMinWpm)}-${Math.round(botState.currentMaxWpm)}`,
        'color:#89b4fa;font-weight:bold', 'color:#cdd6f4'
    );
})();
console.log('Use the script.js content for the full bot code.');

