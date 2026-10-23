'use strict';
/* 每天开口 · 本地版前端 */

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; e.append(k.nodeType ? k : document.createTextNode(String(k))); }
  return e;
}
const SVG = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/></svg>',
  starOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 11.5L20 4l-5.5 16-3-6.5z"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6l6 6-6 6"/></svg>',
};
const put = (el, ...kids) => el.append(...kids.filter(k => k != null && k !== false)); // Element.append would print "null"
function ic(name) { const s = h('span', { class: 'ic', 'aria-hidden': 'true' }); s.innerHTML = SVG[name]; return s; }
const z2 = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate());
const today = () => ymd(new Date());
const fmt = s => (isFinite(s) ? z2(Math.floor(s / 60)) + ':' + z2(Math.floor(s % 60)) : '--:--');
const esc = s => String(s ?? '');

/* ================= api ================= */
async function api(path, opts = {}) {
  let r;
  try { r = await fetch(path, opts); } catch { throw new Error('连不上本地服务。确认「每天开口」的终端窗口还开着。'); }
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j?.error || ('请求失败（' + r.status + '）'));
  return j;
}
const post = (p, body) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const extOf = b => (/mp4|m4a|aac/.test(b.type) ? '.m4a' : /ogg/.test(b.type) ? '.ogg' : '.webm');
async function aiText(prompt, { json = true, messages = null, temperature } = {}) {
  const j = await post('/api/ai/text', { json, messages: messages || [{ role: 'user', content: prompt }], temperature });
  return json ? j.json : j.text;
}
async function aiAudio(blob, prompt) {
  const fd = new FormData(); fd.append('audio', blob, 'rec' + extOf(blob)); fd.append('prompt', prompt); fd.append('want_json', '1');
  return (await api('/api/ai/audio', { method: 'POST', body: fd })).json;
}
/* arch = { kind, line, meta } archives the recording on the server (audio + transcript + fluency metrics). */
async function sttFull(blob, ref = '', arch = null) {
  const fd = new FormData(); fd.append('audio', blob, 'rec' + extOf(blob)); fd.append('ref', ref);
  if (arch) { fd.append('kind', arch.kind); fd.append('line', arch.line || 'daily'); fd.append('meta', JSON.stringify(arch.meta || {})); }
  const j = await api('/api/stt', { method: 'POST', body: fd });
  if (arch) RECS.dirty = true;
  return j;
}
async function stt(blob, ref = '', arch = null) { return (await sttFull(blob, ref, arch)).text; }
const LEARNER = "The learner is a Chinese graduate student (master's level, roughly IELTS 5.5–6.5 speaking) practising spoken English. Explanations for the learner are in simplified Chinese; English examples are natural, spoken and modern.";

/* ================= state ================= */
const S = { days: {}, lessons: {}, srs: {}, cards: {}, errs: {}, prefs: { cur: 1, voice: '', ttsRate: 0.95, autoSpeak: true, level: 'normal', rate: 1, blind: false } };
let LESSONS = [], N = 0, STATUS = {}, CFG = null;
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => post('/api/state', S).catch(() => {}), 400); }
function day(d = today()) { return S.days[d] || (S.days[d] = {}); }
function lessonRec(n) { return S.lessons[n] || (S.lessons[n] = {}); }
function markDay(flag) { const d = day(); if (flag === 'ch') d.ch = (d.ch || 0) + 1; else d[flag] = true; save(); renderHeader(); }
function markLesson(n, step) {
  const L = lessonRec(n);
  if (!L[step]) { L[step] = true; if (L.sh && L.ph && L.sp && !L.at) L.at = today(); }
  markDay(step);
}
const DAY_FLAGS = ['sh', 'ph', 'sp', 'rv', 'rt', 'bl', 'er'];
const active = d => { const v = S.days[d]; return !!(v && (v.ch || DAY_FLAGS.some(k => v[k]))); };
const level = d => { const v = S.days[d]; if (!v) return 0; return Math.min(3, DAY_FLAGS.filter(k => v[k]).length + (v.ch ? 1 : 0)); };
const lessonsDone = () => Object.values(S.lessons).filter(l => l.sh && l.ph && l.sp).length;

/* ================= text to speech ================= */
let VOICES = [];
function loadVoices() { try { VOICES = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang)); } catch { VOICES = []; } }
try { loadVoices(); speechSynthesis.onvoiceschanged = () => { loadVoices(); if (TAB === 'settings') renderSettings(); }; } catch {}
function pickVoice() {
  return VOICES.find(v => v.voiceURI === S.prefs.voice)
    || VOICES.find(v => /en-US/i.test(v.lang) && /(Samantha|Ava|Allison|Zoe|Evan|Nathan)/i.test(v.name))
    || VOICES.find(v => /en-(US|GB)/i.test(v.lang)) || VOICES[0];
}
let speakingBtn = null;
function say(text, btn) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel(); pauseAll();
  speakingBtn?.classList.remove('speaking');
  if (btn && speakingBtn === btn) { speakingBtn = null; return; }
  speakingBtn = btn || null; btn?.classList.add('speaking');
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text];
  let i = 0;
  const next = () => {
    if (i >= parts.length) { btn?.classList.remove('speaking'); if (speakingBtn === btn) speakingBtn = null; return; }
    const u = new SpeechSynthesisUtterance(parts[i++].trim());
    const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    u.rate = S.prefs.ttsRate; u.onend = next; u.onerror = () => btn?.classList.remove('speaking');
    speechSynthesis.speak(u);
  };
  next();
}
function sayBtn(text, label = '朗读') { const b = h('button', { class: 'btn ghost icon-btn', title: label, 'aria-label': label }, ic('speak')); b.onclick = () => say(text, b); return b; }

/* ================= chunks (spaced repetition) ================= */
const findChunk = en => Object.entries(S.srs).find(([, v]) => v.en.toLowerCase() === en.trim().toLowerCase());
function addChunk(en, zh, src) {
  en = en.trim(); if (!en) return null;
  const ex = findChunk(en); if (ex) { if (zh && !ex[1].zh) { ex[1].zh = zh; save(); } return ex[0]; }
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  S.srs[id] = { en, zh: zh || '', src: src || '', t: Date.now(), due: Date.now(), ivl: 0, ease: 2.5, reps: 0 };
  save(); updateBadge(); return id;
}
function chunkBtn(en, zh, src) {
  const b = h('button', { class: 'btn ghost icon-btn' });
  const paint = () => { const on = !!findChunk(en); b.replaceChildren(ic(on ? 'starOn' : 'star')); b.title = on ? '已在语块本（再点移出）' : '加入语块本'; b.setAttribute('aria-label', b.title); };
  b.onclick = () => { const f = findChunk(en); if (f) { delete S.srs[f[0]]; save(); updateBadge(); } else addChunk(en, zh, src); paint(); };
  paint(); return b;
}
const dueList = () => Object.entries(S.srs).filter(([, v]) => v.due <= Date.now()).sort((a, b) => a[1].due - b[1].due);
function schedule(v, g) {
  v = { ...v }; const DAY = 864e5; const d0 = new Date(); d0.setHours(4, 0, 0, 0); if (Date.now() < d0.getTime()) d0.setDate(d0.getDate() - 1);
  if (g === 0) { v.reps = 0; v.ivl = 0; v.ease = Math.max(1.3, v.ease - 0.2); v.due = Date.now() + 10 * 60e3; return v; }
  if (g === 1) { v.ivl = Math.max(1, Math.round((v.ivl || 1) * 1.2)); v.ease = Math.max(1.3, v.ease - 0.15); }
  else if (g === 2) v.ivl = v.reps === 0 ? 1 : v.reps === 1 ? 3 : Math.round(Math.max(1, v.ivl) * v.ease);
  else { v.ivl = v.reps === 0 ? 3 : Math.round(Math.max(1, v.ivl) * v.ease * 1.3); v.ease += 0.15; }
  v.reps++; v.due = d0.getTime() + v.ivl * DAY; return v;
}
const ivlText = v => (v.ivl === 0 ? '10 分钟' : v.ivl + ' 天');
function updateBadge() {
  const n = dueList().length, b = $('#dueBadge'); b.textContent = n; b.hidden = !n;
  const en = errDueList().length, eb = $('#errBadge'); if (eb) { eb.textContent = en; eb.hidden = !en; }
}

/* ================= audio: lesson files, recorder ================= */
const AUDS = new Map();
function aud(path) {
  if (!AUDS.has(path)) { const a = new Audio('/api/media?path=' + encodeURIComponent(path)); a.preload = 'metadata'; AUDS.set(path, a); }
  return AUDS.get(path);
}
let segTok = 0, mine = null;
function pauseAll(except) { for (const a of [...AUDS.values(), ...$$('audio')]) if (a !== except) a.pause(); if (mine && mine !== except) mine.pause(); }
document.addEventListener('play', e => { segTok++; for (const a of [...AUDS.values(), ...$$('audio')]) if (a !== e.target) a.pause(); if (mine) mine.pause(); try { speechSynthesis.cancel(); } catch {} }, true);
const NATIVE = new Map();
function nativeAudio(path) { if (!NATIVE.has(path)) NATIVE.set(path, h('audio', { class: 'native', controls: true, preload: 'metadata', src: '/api/media?path=' + encodeURIComponent(path) })); return NATIVE.get(path); }
function stopEverything() { segTok++; pauseAll(); try { speechSynthesis.cancel(); } catch {} }
function playSeg(a, s, e) {
  const tok = ++segTok; pauseAll(a); try { speechSynthesis.cancel(); } catch {}
  a.playbackRate = S.prefs.rate;
  return new Promise(res => {
    const go = () => {
      a.currentTime = Math.max(0, s - 0.06);
      a.play().then(() => {
        const tick = () => {
          if (tok !== segTok || a.paused) return res(false);
          if (a.currentTime >= e + 0.1) { a.pause(); return res(true); }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }).catch(() => res(false));
    };
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
  });
}
function playBlobUrl(url) {
  const tok = ++segTok; pauseAll(); try { speechSynthesis.cancel(); } catch {}
  mine = new Audio(url);
  return new Promise(res => { mine.onended = () => res(tok === segTok); mine.onerror = () => res(false); mine.play().catch(() => res(false)); });
}
const Rec = {
  stream: null, mr: null, done: null, owner: null,
  async start(owner) {
    if (this.mr) { this.mr.stop(); await this.done; }
    if (!this.stream || !this.stream.active) {
      try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch { throw new Error('拿不到麦克风。请在浏览器地址栏左侧允许麦克风，并在 系统设置 › 隐私与安全性 › 麦克风 里允许浏览器。'); }
    }
    stopEverything();
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(m => window.MediaRecorder?.isTypeSupported?.(m));
    const mr = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    this.done = new Promise(res => { mr.onstop = () => { this.mr = null; this.owner = null; res(new Blob(chunks, { type: mr.mimeType || 'audio/webm' })); }; });
    this.mr = mr; this.owner = owner; mr.start();
  },
  stop() { if (this.mr && this.mr.state !== 'inactive') this.mr.stop(); return this.done; },
  /* Stops the current recording once the speaker has talked and then stayed quiet for `quiet` s, or after `max` s. */
  autoStop(max, quiet = 1.5) {
    const mr = this.mr; if (!mr) return;
    const cap = setTimeout(() => { if (this.mr === mr) this.stop(); }, max * 1000);
    try {
      this.ctx ||= new AudioContext(); this.ctx.resume?.();
      const src = this.ctx.createMediaStreamSource(this.stream), an = this.ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const buf = new Float32Array(an.fftSize), t0 = performance.now(); let floor = Infinity, spoke = 0, lastLoud = 0;
      const iv = setInterval(() => {
        const now = performance.now();
        if (this.mr !== mr) { clearInterval(iv); clearTimeout(cap); src.disconnect(); return; }
        an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; const rms = Math.sqrt(s / buf.length);
        if (now - t0 < 300) { floor = Math.min(floor, rms); return; } // room noise before the first word
        if (rms > Math.max(0.02, floor * 3)) { spoke += 50; lastLoud = now; }
        if (spoke >= 300 && now - lastLoud > quiet * 1000) this.stop();
      }, 50);
    } catch { /* no Web Audio: the cap still stops it */ }
  },
  isOn(owner) { return !!this.mr && (owner == null || this.owner === owner); },
};

/* ================= recordings archive & fluency metrics ================= */
const RECS = { list: [], dirty: true, ok: false };
async function loadRecs() {
  if (!RECS.dirty) return RECS.list;
  try { RECS.list = (await api('/api/recordings')).recordings; RECS.dirty = false; RECS.ok = true; } catch {}
  return RECS.list;
}
const recAudio = id => '/api/recordings/' + encodeURIComponent(id) + '/audio';
const KIND_ZH = { talk: '开口说', baseline: '基准录音', r432: '4/3/2 复述', chat: 'AI 对话', shadow: '跟读', chunk: '语块造句', review: '复习' };
const CURVE_KINDS = ['talk', 'baseline', 'r432'];
const METRICS = [
  { k: 'wpm', zh: '语速', unit: '词/分', better: 'up', digits: 0, tip: '每分钟说出的词数（不算 um、uh），中间的停顿也算进时间。' },
  { k: 'fillers_per100', zh: '填充词', unit: '个/百词', better: 'down', digits: 1, tip: '每 100 个词里有几个 um、uh、er。' },
  { k: 'mlr', zh: '连贯段', unit: '词', better: 'up', digits: 1, tip: '平均连着说几个词才停一下（停顿 ≥ 0.25 秒或说 um 都算停）。' },
];
// Curves use free monologues only; rounds 2–3 of a 4/3/2 set repeat round 1, so they would inflate the trend.
const inCurve = r => r.metrics?.reliable && CURVE_KINDS.includes(r.kind) && !(r.kind === 'r432' && r.meta?.round !== 1);
function metricsView(m, base) {
  if (!m) return null;
  return h('div', { class: 'metrics' },
    h('div', { class: 'metric-row' }, METRICS.map(x => {
      const v = m[x.k] || 0, d = base ? v - (base[x.k] || 0) : 0, shown = Math.abs(d) >= 0.5 * 10 ** -x.digits;
      const good = x.better === 'up' ? d > 0 : d < 0;
      return h('div', { class: 'metric', title: x.tip }, h('b', { text: v.toFixed(x.digits) }),
        base && shown ? h('small', { class: good ? 'up' : 'down', text: (d > 0 ? '+' : '−') + Math.abs(d).toFixed(x.digits) }) : null,
        h('span', { text: x.zh + ' · ' + x.unit }));
    })),
    m.reliable ? null : h('p', { class: 'hint', text: '这段不到 20 个词，指标波动大，不进曲线。' }));
}
/* one countdown at a time; stops the recording when the limit is reached */
const TMR = { owner: null, elapsed: 0, limit: 0 };
async function timedRec(owner, limit, rerender) {
  if (Rec.isOn(owner)) { Rec.stop(); return null; }
  try { await Rec.start(owner); } catch (e) { alertBox(e.message); return null; }
  Object.assign(TMR, { owner, elapsed: 0, limit });
  const iv = setInterval(() => { TMR.elapsed++; paintTimer(); if (TMR.elapsed >= limit) Rec.stop(); }, 1000);
  rerender();
  const blob = await Rec.done; clearInterval(iv); if (TMR.owner === owner) TMR.owner = null;
  return blob.size < 800 ? null : blob;
}
function timerView(owner, limit) {
  const on = TMR.owner === owner;
  return h('div', { class: 'timer-inline' + (on ? ' on' : '') }, h('b', { class: 'tmr-num', text: fmt(on ? Math.max(0, limit - TMR.elapsed) : limit) }),
    h('div', { class: 'bar' }, h('i', { class: 'tmr-bar', style: 'width:' + (on ? Math.min(100, TMR.elapsed / limit * 100) : 0) + '%' })));
}
function paintTimer() {
  $$('.timer-inline.on .tmr-num').forEach(e => { e.textContent = fmt(Math.max(0, TMR.limit - TMR.elapsed)); });
  $$('.timer-inline.on .tmr-bar').forEach(e => { e.style.width = Math.min(100, TMR.elapsed / TMR.limit * 100) + '%'; });
}
const recDot = () => h('span', { class: 'rec-dot', style: 'background:#fff' });
/* Fixed benchmark tasks. Never edit the wording or length: month-to-month comparison only works on the identical task. */
const BASELINES = [
  { id: 'intro', line: 'daily', title: '日常线 · 自我介绍', en: 'Introduce yourself: who you are, what you study, and what a normal day looks like for you.', secs: 60 },
  { id: 'research', line: 'academic', title: '学术线 · 讲你的研究', en: 'Explain your research to a smart friend from another field: the problem, how you study it, and what you have found so far.', secs: 60 },
];
const BASE_EVERY = 28; // days between benchmark recordings
const baseRecs = b => RECS.list.filter(r => r.kind === 'baseline' && r.meta?.bid === b.id).sort((x, y) => x.t - y.t);
function baseDue(b) { const rs = baseRecs(b); return !rs.length || Date.now() - rs[rs.length - 1].t >= BASE_EVERY * 864e5; }

/* ================= word matching ================= */
const nt = t => t.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '');
function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// one letter off in a long word is a spelling variant (EELTSCAST), not a missed word; "car" for "career" still misses
const near = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && lev(a, b) <= 1);
const WEAK = 0.5; // Whisper's own word probability below this means it guessed: the word was probably not said clearly
/* heardWords: [[word, start, end, probability], ...] from /api/stt; without them every heard word counts as clear */
function align(refText, heardText, heardWords) {
  const toks = refText.split(/\s+/).filter(Boolean);
  const R = toks.map(nt);
  const Hw = (heardWords?.length ? heardWords.map(w => ({ t: nt(w[0]), p: w[3] ?? 1 })) : heardText.split(/\s+/).map(t => ({ t: nt(t), p: 1 }))).filter(x => x.t);
  const H = Hw.map(x => x.t);
  const idx = R.map((w, i) => (w ? i : -1)).filter(i => i >= 0);
  const r = idx.map(i => R[i]);
  const n = r.length, m = H.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = near(r[i], H[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(toks.length).fill(null); let i = 0, j = 0;
  while (i < n && j < m) { if (near(r[i], H[j])) { hit[idx[i]] = Hw[j].p < WEAK ? 'weak' : true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  for (const k of idx) if (hit[k] == null) hit[k] = false;
  const clear = idx.filter(k => hit[k] === true).length, weak = idx.filter(k => hit[k] === 'weak').length;
  return { toks, hit, weak, score: n ? Math.round((clear + weak / 2) / n * 100) : 0 };
}
function diffView(ref, heard, words) {
  const a = align(ref, heard || '', words);
  return h('div', { class: 'diff' },
    a.toks.map((t, k) => [h('span', { class: a.hit[k] === false ? 'miss' : a.hit[k] === 'weak' ? 'weak' : 'hit', title: a.hit[k] === 'weak' ? '识别没把握，可能没读清楚' : null, text: t }), ' ']),
    h('span', { class: 'heard', text: '识别到：' + (heard || '（没听到说话）') + '　·　对上 ' + a.score + '%' + (a.weak ? '　·　' + a.weak + ' 个词可能没读清楚（黄色）' : '') }));
}

/* ================= sentence shadowing ================= */
const SHADOWS = new Map();
class Shadow {
  constructor(path, sents, { onCount, label } = {}) {
    this.path = path; this.sents = sents; this.cur = 0; this.recs = new Map(); this.res = new Map(); this.ai = new Map();
    this.onCount = onCount; this.label = label || ''; this.auto = false; this.busy = new Set(); this.recording = null;
    this.boothEl = h('div', { class: 'booth' }); this.listEl = h('div', { class: 'script' }); this.barEl = h('div', { class: 'auto-bar' });
  }
  get audio() { return aud(this.path); }
  rerender() { this.renderBooth(); this.renderList(); this.renderBar(); }
  focus(i) {
    this.cur = Math.max(0, Math.min(this.sents.length - 1, i)); this.rerender();
    const r = this.listEl.children[this.cur]; if (r) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  dur(i) { const s = this.sents[i]; return Math.max(1.2, (s.e - s.s) / (S.prefs.rate || 1)); }
  async record(i) {
    if (Rec.isOn(this)) { Rec.stop(); return; }
    try { await Rec.start(this); } catch (e) { alertBox(e.message); return; }
    this.recording = i; this.rerender();
    Rec.autoStop(Math.max(10, this.dur(i) * 3 + 4));
    const blob = await Rec.done; this.recording = null;
    if (blob.size < 800) { this.rerender(); return; }
    const old = this.recs.get(i); if (old) URL.revokeObjectURL(old.url);
    this.recs.set(i, { blob, url: URL.createObjectURL(blob) });
    this.res.delete(i); this.ai.delete(i);
    this.onCount?.(this.recs.size);
    this.rerender();
    this.check(i);
  }
  async check(i) {
    const r = this.recs.get(i); if (!r) return;
    this.busy.add('chk' + i); this.rerender();
    try {
      const ref = this.sents[i].text, j = await sttFull(r.blob, ref, { kind: 'shadow', meta: { src: this.label, ref } });
      this.res.set(i, { heard: j.text, words: j.words, score: align(ref, j.text, j.words).score });
    }
    catch (e) { this.res.set(i, { error: e.message }); }
    this.busy.delete('chk' + i); this.rerender();
  }
  async listen(i) {
    const r = this.recs.get(i); if (!r) return;
    this.busy.add('ai' + i); this.rerender();
    try {
      const j = await aiAudio(r.blob, LEARNER + '\n\nThe audio is the learner shadowing (repeating) this reference sentence after a native speaker:\n"' + this.sents[i].text + '"\nListen carefully to HOW they say it. Judge pronunciation of individual sounds and words, word stress, linking, rhythm and intonation compared with how a native speaker would say this sentence. Be specific and honest; if it sounds good, say so briefly.\nJSON: {"score": integer 1-10 (overall closeness to native delivery), "summary_zh": "中文一句总评", "issues": [{"word": "the word or phrase", "problem_zh": "具体问题（中文）", "tip_zh": "怎么改（中文，可写音标或类似中文发音提示）"}]} with at most 3 issues.');
      this.ai.set(i, j);
    } catch (e) { this.ai.set(i, { error: e.message }); }
    this.busy.delete('ai' + i); this.rerender();
  }
  async compare(i) { const r = this.recs.get(i); if (!r) return; const s = this.sents[i]; if (await playSeg(this.audio, s.s, s.e)) await playBlobUrl(r.url); }
  async runAuto() {
    if (this.auto) { this.auto = false; stopEverything(); Rec.stop(); this.rerender(); return; }
    this.auto = true; this.rerender();
    for (let i = this.cur; i < this.sents.length && this.auto; i++) {
      this.focus(i);
      const s = this.sents[i];
      if (!(await playSeg(this.audio, s.s, s.e)) || !this.auto) break;
      await this.record(i);
    }
    this.auto = false; this.rerender();
  }
  renderBar() {
    this.barEl.replaceChildren(
      h('span', { class: 'grow', text: this.auto ? '连续跟读中：听一句，灯亮时跟着说，录完自动下一句。' : '连续跟读会从当前句开始，播放一句、录你一句，自动往下走。' }),
      h('button', { class: 'btn ' + (this.auto ? 'rec' : ''), onclick: () => this.runAuto() }, this.auto ? [ic('stop'), '停下'] : [ic('play'), '连续跟读']));
  }
  renderBooth() {
    const i = this.cur, s = this.sents[i]; if (!s) return;
    const rec = this.recs.get(i), res = this.res.get(i), ai = this.ai.get(i), recOn = this.recording === i;
    this.boothEl.className = 'booth' + (recOn ? ' live' : '');
    const kids = [
      h('div', { class: 'meta' }, h('span', { text: '第 ' + (i + 1) + ' / ' + this.sents.length + ' 句' }), h('span', { text: fmt(s.s) + ' – ' + fmt(s.e) })),
      h('p', { class: 'line' + (S.prefs.blind && !rec ? ' blind' : '') }, wordify(s.text, { src: this.label })),
      h('div', { class: 'controls' },
        h('button', { class: 'big-play', title: '听原声', 'aria-label': '听原声', onclick: () => playSeg(this.audio, s.s, s.e) }, ic('play')),
        h('button', { class: 'big-rec' + (recOn ? ' on' : ''), onclick: () => this.record(i) }, recOn ? [h('span', { class: 'rec-dot', style: 'background:#fff' }), '说完了'] : [ic('mic'), rec ? '重新跟读' : '跟读这句']),
        rec ? h('button', { class: 'btn', onclick: () => playBlobUrl(rec.url) }, '听我的') : null,
        rec ? h('button', { class: 'btn', onclick: () => this.compare(i) }, '对比听') : null,
        rec ? h('button', { class: 'btn', disabled: this.busy.has('ai' + i), onclick: () => this.listen(i) }, this.busy.has('ai' + i) ? 'AI 在听…' : 'AI 听发音') : null,
        h('span', { class: 'grow' }),
        chunkBtn(s.text, '', this.label),
        h('button', { class: 'btn ghost icon-btn', 'aria-label': '上一句', title: '上一句', disabled: i <= 0, onclick: () => this.focus(i - 1) }, ic('left')),
        h('button', { class: 'btn ghost icon-btn', 'aria-label': '下一句', title: '下一句', disabled: i >= this.sents.length - 1, onclick: () => this.focus(i + 1) }, ic('right'))),
    ];
    if (this.busy.has('chk' + i)) kids.push(h('p', { class: 'thinking', text: '本地识别中…' }));
    else if (res?.error) kids.push(h('p', { class: 'err', text: res.error }));
    else if (res) kids.push(diffView(s.text, res.heard, res.words));
    else if (!rec) kids.push(h('p', { class: 'hint', text: '听一遍原声，再按「跟读这句」。说完停顿一下会自动结束，录完自动比对，标出没说清的词。' }));
    if (ai) kids.push(ai.error ? h('p', { class: 'err', text: ai.error }) : h('div', { class: 'ai-note' },
      h('div', { class: 'row' }, ai.score != null ? h('span', { class: 'tag lamp', text: '发音 ' + ai.score + ' / 10' }) : null, h('span', { text: esc(ai.summary_zh) })),
      (ai.issues || []).slice(0, 3).map(x => h('div', { class: 'small' }, h('b', { text: esc(x.word) }), '：' + esc(x.problem_zh) + (x.tip_zh ? '。' + x.tip_zh : '')))));
    this.boothEl.replaceChildren(...kids);
  }
  renderList() {
    const keep = this.listEl.scrollTop;
    this.listEl.replaceChildren(...this.sents.map((s, i) => {
      const res = this.res.get(i), rec = this.recs.get(i);
      const st = this.recording === i ? h('span', { class: 'st' }, h('span', { class: 'rec-dot' })) :
        res?.score != null ? h('span', { class: 'st' + (res.score >= 80 ? ' ok' : ''), text: res.score + '%' }) :
        rec ? h('span', { class: 'st ok' }, ic('check')) : h('span', { class: 'st' });
      return h('div', { class: 'sent' + (i === this.cur ? ' cur' : ''), onclick: () => this.focus(i) },
        h('span', { class: 'ts', text: fmt(s.s) }), h('span', { class: 'tx' + (S.prefs.blind && !rec ? ' blind' : ''), text: s.text }), st);
    }));
    this.listEl.scrollTop = keep;
  }
  view({ list = true } = {}) {
    this.rerender();
    return h('div', { class: 'card' }, this.boothEl, list ? this.barEl : null, list ? this.listEl : null);
  }
}

/* ================= transcripts ================= */
const TR = new Map();
async function transcript(path) {
  if (TR.get(path)?.sentences) return TR.get(path);
  const j = await api('/api/transcript?ensure=1&path=' + encodeURIComponent(path));
  TR.set(path, j); return j;
}
const POLL = {};
function pollLater(path) {
  clearTimeout(POLL[path]);
  POLL[path] = setTimeout(async () => {
    const j = await api('/api/transcript?path=' + encodeURIComponent(path)).catch(() => null);
    if (j?.sentences) { TR.set(path, j); if (TAB === 'today') renderToday(); return; }
    const el = document.getElementById('trHint-' + path);
    if (el && j) el.textContent = '正在用本地 Whisper 生成逐句字幕（前面还有 ' + (j.queue || 0) + ' 个），先听整集。';
    pollLater(path);
  }, 4000);
}

/* ================= header & tabs ================= */
function renderHeader() {
  const wk = $('#weekDots'); wk.replaceChildren(); let n7 = 0;
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = ymd(d); n7 += active(k); wk.append(h('i', { class: (active(k) ? 'on' : '') + (i === 0 ? ' today' : ''), title: k })); }
  $('#habitLine').textContent = (active(today()) ? '今天开过口了' : '今天还没开口') + ' · 近 7 天练了 ' + n7 + ' 天';
  $('#subline').textContent = '已完成 ' + lessonsDone() + ' / ' + N + ' 课';
  if (STATUS.lessons) $('#railFoot').textContent = STATUS.ielts_transcribed >= STATUS.lessons ? '全部字幕已就绪' : '本地字幕 ' + STATUS.ielts_transcribed + ' / ' + STATUS.lessons + ' 集，空闲时在后台生成';
}
let TAB = 'today';
function setTab(t) {
  if (t === 'log') t = 'progress';
  if (!['today', 'retell', 'chunks', 'errors', 'chat', 'progress', 'settings'].includes(t)) t = 'today';
  if (TAB !== t) stopEverything();
  TAB = t;
  $$('.nav a').forEach(a => a.setAttribute('aria-selected', String(a.dataset.tab === t)));
  $$('main[data-view]').forEach(m => { m.hidden = m.dataset.view !== t; });
  ({ today: renderToday, retell: renderRetell, chunks: renderChunks, errors: renderErrors, chat: renderChat, progress: renderProgress, settings: renderSettings })[t]();
  if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t);
}
$$('.nav a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); setTab(a.dataset.tab); }));
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t && t !== TAB) setTab(t); });
function alertBox(msg) { const n = h('div', { class: 'notice', style: 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:20;max-width:90vw;box-shadow:0 6px 24px rgba(0,0,0,.18)' }, msg); document.body.append(n); setTimeout(() => n.remove(), 5000); }

/* ================= TODAY ================= */
const topicText = L => L.t;
function promptText(L) { const t = L.t; if (L.p === 2) return 'Describe ' + t.charAt(0).toLowerCase() + t.slice(1) + '.'; if (L.p === 3) return 'Discuss: ' + t + '. What do you think, and why?'; return 'Talk about: ' + t + '.'; }
function needKeyNote(kind) {
  const ok = kind === 'omni' ? STATUS.providers?.omni : STATUS.providers?.[STATUS.text_provider];
  if (ok) return null;
  return h('p', { class: 'hint warn' }, kind === 'omni' ? '「AI 听发音」需要先在设置里填百炼（Qwen-Omni）的 API key。' : 'AI 功能需要先在设置里填 DeepSeek 或 GLM 的 API key。', ' ', h('a', { href: '#settings', onclick: e => { e.preventDefault(); setTab('settings'); } }, '去设置'));
}
const LP = {};
const lp = n => LP[n] || (LP[n] = { sentence: '', check: null, talk: '', review: null, audioReview: null, blob: null, busy: {}, step: null });
function seg(values, cur, onPick, fmtv = v => v + '×') {
  const box = h('div', { class: 'seg', role: 'group' });
  for (const v of values) box.append(h('button', { 'aria-pressed': String(v === cur), onclick: e => { $$('button', box).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); onPick(v); } }, fmtv(v)));
  return box;
}
function micButton(owner, onBlob, labels = ['说', '停']) {
  const on = Rec.isOn(owner);
  return h('button', { class: 'btn ' + (on ? 'rec' : ''), onclick: async () => {
    if (Rec.isOn(owner)) { Rec.stop(); return; }
    try { await Rec.start(owner); } catch (e) { alertBox(e.message); return; }
    rerenderOwner(owner);
    const blob = await Rec.done; rerenderOwner(owner); if (blob.size > 800) onBlob(blob);
  } }, on ? [h('span', { class: 'rec-dot', style: 'background:#fff' }), labels[1]] : [ic('mic'), labels[0]]);
}
function rerenderOwner(owner) {
  if (String(owner).startsWith('chat')) renderChat();
  else if (String(owner).startsWith('rev')) renderChunks();
  else if (String(owner).startsWith('err')) renderErrors();
  else renderToday();
}

let RTOK = 0;
async function renderToday() {
  const root = $('#view-today'); if (root.hidden) return;
  const myTok = ++RTOK;
  if (!N) { root.replaceChildren(h('p', { class: 'err', text: STATUS.lesson_error || '没有读到课程。检查设置里的资料文件夹。' })); return; }
  const n = S.prefs.cur, L = LESSONS[n - 1], rec = lessonRec(n), st = lp(n);
  if (!st.step) st.step = !rec.sh ? 1 : !rec.ph ? 2 : !rec.sp ? 3 : 1;
  const frag = [];
  const due = RECS.ok ? BASELINES.filter(baseDue) : [];
  if (due.length) frag.push(h('div', { class: 'notice row' }, h('span', { class: 'grow', text: '本月的基准录音还没录：' + due.map(b => b.title).join('、') + '，每条 1 分钟。以后每个月拿它和第 1 次对比。' }),
    h('button', { class: 'btn', onclick: () => setTab('progress') }, '去录')));

  const sel = h('select', { 'aria-label': '选择课程', onchange: e => goLesson(+e.target.value) },
    LESSONS.map((x, i) => { const r = S.lessons[i + 1]; return h('option', { value: i + 1, selected: i + 1 === n }, (r && r.sh && r.ph && r.sp ? '✓ ' : '') + (i + 1) + '. ' + x.t); }));
  frag.push(h('header', { class: 'lesson-head' },
    h('div', { class: 'lesson-nav' },
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost icon-btn', 'aria-label': '上一课', disabled: n <= 1, onclick: () => goLesson(n - 1) }, ic('left')),
        h('span', { class: 'mono', text: '第 ' + n + ' 课，共 ' + N + ' 课' }),
        h('button', { class: 'btn ghost icon-btn', 'aria-label': '下一课', disabled: n >= N, onclick: () => goLesson(n + 1) }, ic('right'))), sel),
    h('h2', { class: 'lesson-title', text: L.t }),
    h('div', { class: 'lesson-sub' }, h('span', { class: 'tag', text: '雅思口语 Part ' + L.p }), h('span', { class: 'tag lamp', text: '今日语块：' + L.x }))));

  const steps = [[1, '逐句跟读', 'IELTSCast，约 10 分钟', rec.sh], [2, '今日语块', 'BBC 原声，约 5 分钟', rec.ph], [3, '开口说', '自述并点评，约 3 分钟', rec.sp]];
  frag.push(h('nav', { class: 'stepper', 'aria-label': '本课步骤' }, steps.map(([k, t, sub, done]) =>
    h('button', { class: done ? 'is-done' : '', 'aria-current': st.step === k ? 'step' : null, onclick: () => { st.step = k; stopEverything(); renderToday(); } },
      h('span', { class: 'n' }, done ? ic('check') : String(k)), h('b', { text: t }), h('small', { text: sub })))));

  const panel = h('section', { class: 'panel' });
  if (st.step === 1) await buildStep1(panel, n, L, rec);
  else if (st.step === 2) await buildStep2(panel, n, L, rec, st);
  else buildStep3(panel, n, L, rec, st);
  frag.push(panel);

  if (rec.sh && rec.ph && rec.sp) frag.push(h('div', { class: 'next-cta' }, h('span', { text: '第 ' + n + ' 课完成了。' }),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => startChatOn(n) }, '用这个话题和 AI 聊聊'), n < N ? h('button', { class: 'btn primary', onclick: () => goLesson(n + 1) }, '下一课') : null)));

  if (myTok !== RTOK || $('#view-today').hidden || S.prefs.cur !== n) return;
  const y = window.scrollY; root.replaceChildren(...frag); window.scrollTo(0, y);
}
function nextStepButton(n, k, rec, flag, label) {
  const st = lp(n);
  return h('div', { class: 'panel-foot' },
    rec[flag] ? h('span', { class: 'tag good', text: '这一步已完成' }) : h('button', { class: 'btn ghost', onclick: () => { markLesson(n, flag); renderToday(); } }, label),
    h('span', { class: 'grow' }),
    k < 3 ? h('button', { class: 'btn primary', onclick: () => { st.step = k + 1; stopEverything(); renderToday(); window.scrollTo({ top: 0 }); } }, '下一步', ic('right')) :
      h('button', { class: 'btn', onclick: () => startChatOn(n) }, '用这个话题和 AI 对话'));
}
async function buildStep1(panel, n, L, rec) {
  let tr = TR.get(L.f);
  if (!tr?.sentences) { try { tr = await transcript(L.f); } catch (e) { tr = { status: 'error', error: e.message }; } }
  if (tr.sentences) {
    let sh = SHADOWS.get(L.f);
    if (!sh) { sh = new Shadow(L.f, tr.sentences, { label: 'IELTSCast：' + L.t, onCount: c => { if (c >= 5 && !lessonRec(n).sh) markLesson(n, 'sh'); } }); SHADOWS.set(L.f, sh); }
    put(panel,
      h('p', { class: 'intro', text: (L.w ? '这一集原音频带停顿。' : '') + '选一句，先听原声，再跟读。录完自动用本地 Whisper 比对，跟读满 5 句这一步就完成。' }),
      sh.view(),
      h('div', { class: 'script-bar' },
        h('span', {}, '速度'), seg([0.75, 0.85, 1], S.prefs.rate, v => { S.prefs.rate = v; save(); }),
        h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: S.prefs.blind, onchange: e => { S.prefs.blind = e.target.checked; save(); sh.rerender(); } }), '盲跟：跟读前不显示原文'),
        h('span', { class: 'grow' }), h('span', { class: 'mono', text: '已跟读 ' + sh.recs.size + ' / ' + sh.sents.length + ' 句' })),
      needKeyNote('omni'));
  } else {
    panel.append(h('p', { class: 'thinking', id: 'trHint-' + L.f, text: String(tr.status).startsWith('error') ? '字幕生成失败：' + (tr.error || tr.status) : '正在用本地 Whisper 给这一集生成逐句字幕，大约一两分钟。先听整集。' }), nativeAudio(L.f));
    pollLater(L.f);
  }
  panel.append(nextStepButton(n, 1, rec, 'sh', '标记跟读完成'));
}
async function buildStep2(panel, n, L, rec, st) {
  const card = S.cards[n];
  panel.append(
    h('div', { class: 'phrase-hero' }, h('div', { class: 'phrase grow' }, h('mark', { text: L.x })), sayBtn(L.x, '朗读语块'), chunkBtn(L.x, card?.meaning_zh || '', 'BBC The English We Speak')),
    h('p', { class: 'intro', text: '先听 BBC 原声，弄清它在什么情境下用；再看讲解；最后用它说一句关于你自己的话。' }),
    nativeAudio(L.b));
  const btr = TR.get(L.b)?.sentences ? TR.get(L.b) : await transcript(L.b).catch(() => ({}));
  if (btr.sentences) {
    const stop = ['the', 'and', 'your', 'someone', 'something', "one's", 'into', 'with', 'for', 'out'];
    const keys = L.x.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.includes(w));
    const hits = btr.sentences.filter(s => { const t = s.text.toLowerCase(); return keys.length && keys.every(k => t.includes(k.slice(0, Math.max(3, k.length - 2)))); }).slice(0, 6);
    if (hits.length) {
      let bsh = SHADOWS.get(L.b + '#hits');
      if (!bsh) { bsh = new Shadow(L.b, hits, { label: 'BBC：' + L.x }); SHADOWS.set(L.b + '#hits', bsh); }
      panel.append(h('h3', { class: 'sub-h', text: '原声里的用法，跟读一遍' }), bsh.view());
    }
  } else pollLater(L.b);
  const cardBox = h('div', { class: 'card' });
  if (card) renderCard(cardBox, card, L);
  else {
    const out = h('div');
    const b = h('button', { class: 'btn', disabled: !!st.busy.card, onclick: async () => {
      st.busy.card = true; b.disabled = true; out.replaceChildren(h('p', { class: 'thinking', text: 'AI 正在写讲解' }));
      try {
        const c = await aiText(LEARNER + '\n\nExplain the English chunk "' + L.x + '" (topic of a BBC Learning English "The English We Speak" episode). Write your own examples.\nJSON: {"meaning_zh": "意思（中文，一句话）", "register": "informal" | "neutral" | "slang" | "formal", "note_zh": "什么时候用、什么时候别用（中文，一两句）", "examples": [{"en": "...", "zh": "..."}]} with exactly 3 examples: one about study or research life, one about daily life, one short reply in a conversation.');
        if (!c?.meaning_zh || !Array.isArray(c.examples)) throw new Error('AI 返回的格式不对，再试一次。');
        S.cards[n] = { meaning_zh: String(c.meaning_zh), register: String(c.register || ''), note_zh: String(c.note_zh || ''), examples: c.examples.slice(0, 3).map(e => ({ en: String(e.en || ''), zh: String(e.zh || '') })) };
        addChunk(L.x, S.cards[n].meaning_zh, 'BBC The English We Speak');
        save(); st.busy.card = false; renderToday();
      } catch (e) { st.busy.card = false; b.disabled = false; out.replaceChildren(h('p', { class: 'err', text: e.message })); }
    } }, '生成讲解和例句');
    put(cardBox, h('div', { class: 'row' }, b, h('span', { class: 'hint', text: '生成后这个语块会进语块本，按遗忘曲线安排复习。' })), out, needKeyNote('text'));
  }
  panel.append(cardBox);
  const ta = h('textarea', { placeholder: '用「' + L.x + '」说一句和你自己有关的话。点「说」录音，会自动转成文字。', style: 'min-height:72px' });
  ta.value = st.sentence; ta.oninput = () => { st.sentence = ta.value; };
  const chk = h('div');
  const cb = h('button', { class: 'btn primary', onclick: async () => {
    const s = ta.value.trim(); if (!s) { ta.focus(); return; }
    cb.disabled = true; chk.replaceChildren(h('p', { class: 'thinking', text: 'AI 正在看' }));
    try {
      const r = await aiText(LEARNER + '\n\nThe learner tried to use the chunk "' + L.x + '"' + (card ? ' (meaning: ' + card.meaning_zh + ')' : '') + ' in this sentence (from speech-to-text; ignore punctuation):\n"' + s + '"\nJSON: {"ok": true or false, "better": "a corrected, more natural version that still uses the chunk", "note_zh": "中文点评，一两句"}');
      st.check = { ok: !!r.ok, better: String(r.better || ''), note: String(r.note_zh || '') };
      markLesson(n, 'ph'); renderToday();
    } catch (e) { cb.disabled = false; chk.replaceChildren(h('p', { class: 'err', text: e.message })); }
  } }, '检查这句');
  if (st.check) chk.append(h('div', { class: 'result' },
    h('div', { class: 'row' }, h('span', { class: 'tag ' + (st.check.ok ? 'good' : 'lamp'), text: st.check.ok ? '用对了' : '可以更好' }), h('span', { text: st.check.note })),
    st.check.better ? h('div', { class: 'say' }, h('p', { text: st.check.better }), sayBtn(st.check.better), chunkBtn(st.check.better, '', '造句：' + L.x)) : null));
  panel.append(h('h3', { class: 'sub-h', text: '轮到你' }), ta, h('div', { class: 'row' },
    micButton('ph' + n, async blob => { try { const t = await stt(blob, L.x, { kind: 'chunk', meta: { lesson: n, ref: L.x } }); st.sentence = (st.sentence ? st.sentence + ' ' : '') + t; } catch (e) { alertBox(e.message); } renderToday(); }),
    cb), chk, nextStepButton(n, 2, rec, 'ph', '跳过检查，标记完成'));
}
function buildStep3(panel, n, L, rec, st) {
  const dur = L.p === 2 ? 120 : 60, prompt = promptText(L);
  panel.append(
    h('div', { class: 'row' }, h('p', { class: 'prompt grow', text: prompt }), sayBtn(prompt, '朗读题目')),
    h('p', { class: 'intro', text: (L.p === 2 ? 'Part 2：先想 1 分钟，再连续说 2 分钟。' : '说 1 分钟，给理由和例子。') + '试着把「' + L.x + '」用进去。' }));
  const recOn = Rec.isOn('sp' + n);
  const tb = h('b', { id: 'spT', text: recOn ? fmt(SPT.elapsed) : fmt(dur) }), bar = h('i', { id: 'spBar', style: 'width:' + (recOn ? Math.min(100, SPT.elapsed / dur * 100) : 0) + '%' });
  panel.append(h('div', { class: 'timer' },
    h('button', { class: 'big-rec' + (recOn ? ' on' : ''), onclick: () => speakRec(n, dur) }, recOn ? [h('span', { class: 'rec-dot', style: 'background:#fff' }), '说完了'] : [ic('mic'), st.blob ? '重新说一遍' : '开始说']),
    tb, h('div', { class: 'bar' }, bar),
    st.blob && !recOn ? h('button', { class: 'btn', onclick: () => playBlobUrl(st.url) }, ic('play'), '回放') : null));
  const ta2 = h('textarea', { placeholder: '说完会自动转成文字。识别错的地方可以手动改。' });
  ta2.value = st.talk; ta2.oninput = () => { st.talk = ta2.value; };
  put(panel, st.busy.stt ? h('p', { class: 'thinking', text: '本地转写中' }) : null,
    st.metrics ? h('div', { class: 'card' }, h('h3', { class: 'sub-h', text: '这一段的指标（已存进「进步」页）' }), metricsView(st.metrics)) : null, ta2);
  const rb = h('button', { class: 'btn primary', disabled: !!st.busy.review, onclick: async () => {
    const s = ta2.value.trim(); if (s.split(/\s+/).length < 8) { alertBox('再多说几句（至少 8 个词）再点评。'); return; }
    st.busy.review = true; renderToday();
    try {
      st.review = await aiText(LEARNER + '\n\nIELTS-style speaking task (Part ' + L.p + '): "' + prompt + '"\nTarget chunk for today: "' + L.x + '".\nSpeech-to-text transcript of the learner (ignore punctuation and obvious mis-hearings):\n---\n' + s.slice(0, 6000) + '\n---\nJSON: {"comment_zh": "中文两句：做得好的一点 + 最该改的一点", "band": "rough IELTS speaking band, e.g. \\"6.0\\"", "corrected": "their answer with grammar and word choice fixed, same meaning", "natural": "a more fluent, natural version, about the same length", "fixes": [{"original": "...", "better": "...", "why_zh": "中文一句"}], "chunks": [{"en": "a useful multi-word chunk for this topic", "zh": "..."}], "used_target": true or false}. At most 5 fixes. Exactly 4 chunks (multi-word expressions, not single words).' + errPromptPart());
      if (st.review) { st.review.errKeys = errIngest(st.review.errors, '开口说 · ' + L.t); updateBadge(); }
      markLesson(n, 'sp');
    } catch (e) { alertBox(e.message); }
    st.busy.review = false; renderToday();
  } }, st.busy.review ? 'AI 点评中' : '点评内容');
  const ab = h('button', { class: 'btn', disabled: !st.blob || !!st.busy.audio, onclick: async () => {
    st.busy.audio = true; renderToday();
    try {
      st.audioReview = await aiAudio(st.blob, LEARNER + '\n\nThe audio is the learner answering this IELTS speaking question: "' + prompt + '". Listen to HOW they speak, not only what they say. Assess like an IELTS examiner: fluency and coherence, pronunciation (individual sounds, word stress, sentence stress, intonation, chunking), and how natural they sound.\nJSON: {"band_pron": "pronunciation band e.g. \\"6.0\\"", "band_fluency": "fluency band", "summary_zh": "中文两三句总评", "pron_issues": [{"word": "word or phrase as heard", "problem_zh": "...", "tip_zh": "..."}], "fluency_tips_zh": ["..."]}. At most 4 pron_issues and 3 fluency tips.');
      markLesson(n, 'sp');
    } catch (e) { alertBox(e.message); }
    st.busy.audio = false; renderToday();
  } }, st.busy.audio ? 'AI 在听' : '听发音和流利度');
  put(panel, h('div', { class: 'row' }, rb, ab), needKeyNote('text'));
  if (st.audioReview) panel.append(renderAudioReview(st.audioReview));
  if (st.review) {
    panel.append(h('div', { class: 'result' }, h('h3', { text: '你说的（点词可查）' }),
      h('div', { class: 'say' }, h('p', {}, wordify(st.talk, { mine: true, src: '开口说 · ' + L.t })))), renderReview(st.review, L));
  }
  panel.append(nextStepButton(n, 3, rec, 'sp', '只说不点评，标记完成'));
}
const SPT = { elapsed: 0, iv: null };
async function speakRec(n, dur) {
  const owner = 'sp' + n, st = lp(n);
  if (Rec.isOn(owner)) { Rec.stop(); return; }
  try { await Rec.start(owner); } catch (e) { alertBox(e.message); return; }
  SPT.elapsed = 0; clearInterval(SPT.iv);
  SPT.iv = setInterval(() => { SPT.elapsed++; const t = $('#spT'), b = $('#spBar'); if (t) t.textContent = fmt(SPT.elapsed); if (b) b.style.width = Math.min(100, SPT.elapsed / dur * 100) + '%'; if (SPT.elapsed >= dur + 60) Rec.stop(); }, 1000);
  renderToday();
  const blob = await Rec.done; clearInterval(SPT.iv);
  if (blob.size < 800) { renderToday(); return; }
  if (st.url) URL.revokeObjectURL(st.url);
  st.blob = blob; st.url = URL.createObjectURL(blob); st.review = null; st.audioReview = null; st.metrics = null; st.busy.stt = true; renderToday();
  try {
    const L = LESSONS[n - 1], j = await sttFull(blob, '', { kind: 'talk', meta: { lesson: n, topic: L.t, prompt: promptText(L) } });
    st.talk = j.text; st.metrics = j.metrics;
  } catch (e) { alertBox(e.message); }
  st.busy.stt = false; renderToday();
}
function renderCard(box, c, L) {
  box.append(h('div', { class: 'row' }, h('p', { class: 'grow', text: c.meaning_zh }), c.register ? h('span', { class: 'tag', text: ({ informal: '口语', neutral: '通用', slang: '俚语', formal: '正式' })[c.register] || c.register }) : null));
  if (c.note_zh) box.append(h('p', { class: 'hint', text: c.note_zh }));
  const list = h('div');
  for (const e of c.examples || []) list.append(h('div', { class: 'ex' }, sayBtn(e.en), h('span', { class: 'en' }, wordify(e.en, { src: '例句 · ' + L.x })), chunkBtn(e.en, e.zh, '例句 · ' + L.x), h('span', { class: 'zh', text: e.zh })));
  box.append(list);
}
function renderReview(r, L) {
  const box = h('div', { class: 'result' }, h('h3', { text: '内容点评' }));
  box.append(h('div', { class: 'row' }, r.band ? h('span', { class: 'tag', text: '大约 ' + r.band + ' 分' }) : null, r.used_target ? h('span', { class: 'tag good', text: '用上了「' + L.x + '」' }) : null));
  if (r.comment_zh) box.append(h('p', { text: esc(r.comment_zh) }));
  if (r.corrected) box.append(h('div', {}, h('h3', { text: '改正版' }), h('div', { class: 'say' }, h('p', {}, wordify(esc(r.corrected), { src: '点评 · ' + L.t })), sayBtn(esc(r.corrected)))));
  if (r.natural) box.append(h('div', {}, h('h3', { text: '更地道的说法 · 拿来跟读' }), h('div', { class: 'say' }, h('p', {}, wordify(esc(r.natural), { src: '点评 · ' + L.t })), sayBtn(esc(r.natural)))));
  if (Array.isArray(r.fixes) && r.fixes.length) { const f = h('div', { class: 'card' }, h('h3', { text: '要改的地方' })); for (const x of r.fixes.slice(0, 5)) f.append(h('div', { class: 'fix' }, h('div', {}, h('s', { text: esc(x.original) }), ' → ', h('b', { text: esc(x.better) })), h('span', { class: 'hint', text: esc(x.why_zh) }))); box.append(f); }
  if (Array.isArray(r.chunks) && r.chunks.length) { const p = h('div', {}, h('h3', { text: '这个话题用得上的语块' })); for (const x of r.chunks.slice(0, 4)) p.append(h('div', { class: 'ex' }, sayBtn(esc(x.en)), h('span', { class: 'en', text: esc(x.en) }), chunkBtn(esc(x.en), esc(x.zh), '话题 · ' + L.t), h('span', { class: 'zh', text: esc(x.zh) }))); box.append(p); }
  const errN = errNotice(r.errKeys); if (errN) box.append(errN);
  return box;
}
function renderAudioReview(r) {
  const box = h('div', { class: 'result' }, h('h3', { text: 'AI 听你说' }));
  box.append(h('div', { class: 'row' }, r.band_pron ? h('span', { class: 'tag', text: '发音约 ' + r.band_pron }) : null, r.band_fluency ? h('span', { class: 'tag', text: '流利度约 ' + r.band_fluency }) : null));
  if (r.summary_zh) box.append(h('p', { text: esc(r.summary_zh) }));
  for (const x of (r.pron_issues || []).slice(0, 4)) box.append(h('div', { class: 'fix' }, h('b', { text: esc(x.word) }), h('span', { class: 'hint', text: esc(x.problem_zh) + (x.tip_zh ? ' → ' + x.tip_zh : '') })));
  for (const t of (r.fluency_tips_zh || []).slice(0, 3)) box.append(h('p', { class: 'small', text: '· ' + t }));
  return box;
}
function goLesson(n) { n = Math.max(1, Math.min(N, n)); stopEverything(); S.prefs.cur = n; if (!CHAT.started) CHAT.lesson = n; save(); renderHeader(); renderToday(); window.scrollTo({ top: 0 }); }

/* ================= WORD CARD (点词词典) ================= */
let WPOP = null, WEL = null, WPTOK = 0;
function wordCardOnKey(e) { if (e.key === 'Escape') closeWordCard(); }
function closeWordCard() {
  WPTOK++;
  if (WPOP) { WPOP.remove(); WPOP = null; }
  WEL = null;
  document.removeEventListener('keydown', wordCardOnKey);
  window.removeEventListener('scroll', closeWordCard);
  window.removeEventListener('resize', positionWordPop);
}
function positionWordPop() {
  if (!WPOP || !WEL) return;
  if (window.innerWidth < 600) { WPOP.style.left = ''; WPOP.style.top = ''; WPOP.style.maxHeight = ''; return; }
  // never cover the clicked word: take the side with more room and scroll inside the card if it still does not fit
  const pad = 8, r = WEL.getBoundingClientRect(), w = WPOP.offsetWidth || 360;
  const roomBelow = window.innerHeight - r.bottom - 8 - pad, roomAbove = r.top - 8 - pad;
  WPOP.style.maxHeight = '';
  const natural = WPOP.offsetHeight || 0, below = natural <= roomBelow || roomBelow >= roomAbove;
  const hh = Math.min(natural, below ? roomBelow : roomAbove);
  WPOP.style.maxHeight = Math.max(120, hh) + 'px';
  const left = Math.max(pad, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - pad));
  const top = below ? r.bottom + 8 : r.top - 8 - hh;
  WPOP.style.left = Math.round(left) + 'px';
  WPOP.style.top = Math.round(top) + 'px';
}
/* Sentence with the first whole-word match of `w` wrapped in <mark>. */
function markWord(text, w) {
  const box = h('span', { class: 'wordified' }), s = String(text ?? ''), word = String(w ?? '');
  const m = word ? new RegExp('(^|[^A-Za-z])(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z])', 'i').exec(s) : null;
  if (!m) { box.textContent = s; return box; }
  const at = m.index + m[1].length;
  if (at) box.append(s.slice(0, at));
  box.append(h('mark', { text: m[2] }));
  if (at + m[2].length < s.length) box.append(s.slice(at + m[2].length));
  return box;
}
function openWordCard(el) {
  closeWordCard();
  const tok = ++WPTOK;
  const word = String(el.textContent || '').trim();
  const sentence = el.dataset.s || '', src = el.dataset.src || '', isMine = el.dataset.mine === '1';
  const phon = h('span', { class: 'wordpop-phon' });
  const meta = h('div', { class: 'wordpop-meta' });
  const dict = h('div', { class: 'wordpop-dict' }, h('p', { class: 'thinking', text: '查词…' }));
  const senseBox = h('div', { class: 'wordpop-sense' }, h('p', { class: 'thinking', text: 'AI 在看这句…' }));
  let entry = null, senseNow = '';
  const addBtn = h('button', { class: 'btn' });
  const paintAdd = () => {
    const on = !!findWordCard(word, sentence);
    addBtn.textContent = on ? '已加入复习 · 再点移出' : '加入复习';
    addBtn.classList.toggle('primary', !on);
    addBtn.classList.toggle('done', on);
  };
  addBtn.onclick = () => {
    toggleWordCard(word, sentence, { sense: senseNow, lemma: entry?.lemma?.w || entry?.w || '', src, mine: isMine });
    paintAdd();
  };
  paintAdd();

  const box = h('div', { class: 'wordpop', role: 'dialog', 'aria-label': '词卡' },
    h('div', { class: 'wordpop-head' },
      h('b', { class: 'wordpop-word', text: word }), phon, sayBtn(word),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn ghost icon-btn', title: '关闭', 'aria-label': '关闭', onclick: closeWordCard }, ic('x'))),
    meta, dict,
    h('div', { class: 'wordpop-sec' }, h('h3', { class: 'sub-h', text: '在这句里' }), senseBox),
    h('div', { class: 'wordpop-sec' },
      h('h3', { class: 'sub-h', text: isMine ? '你说的' : '原句' }),
      h('div', { class: 'row wordpop-sent' }, h('p', { class: 'grow' }, markWord(sentence, word)), sentence ? sayBtn(sentence) : null)),
    h('div', { class: 'wordpop-foot' }, h('div', { class: 'row grow' }, addBtn, h('span', { class: 'hint', text: '复习时看挖空的句子，把整句说出来' }))));

  WPOP = box; WEL = el;
  document.body.append(box);
  positionWordPop();
  document.addEventListener('keydown', wordCardOnKey);
  window.addEventListener('scroll', closeWordCard, { passive: true });
  window.addEventListener('resize', positionWordPop);

  const paintDict = () => {
    meta.replaceChildren();
    if (entry?.form_zh) meta.append(h('p', { class: 'small muted', text: word + '：' + entry.form_zh }));
    const tags = (Array.isArray(entry?.tags) ? entry.tags : []).filter(Boolean);
    if (tags.length) meta.append(h('div', { class: 'wordpop-tags' }, tags.map(t => h('span', { class: 'tag', text: String(t) }))));
    if (!entry) dict.replaceChildren(h('p', { class: 'hint', text: '离线词典里没有这个词' }));
    else {
      const defs = (Array.isArray(entry.zh) && entry.zh.length ? entry.zh : (Array.isArray(entry.lemma?.zh) ? entry.lemma.zh : [])).slice(0, 4);
      if (defs.length) dict.replaceChildren(h('ol', { class: 'wordpop-defs' }, defs.map(t => h('li', { text: String(t) }))));
      else dict.replaceChildren();
    }
    positionWordPop();
  };

  async function loadSense() {
    senseBox.replaceChildren(h('p', { class: 'thinking', text: 'AI 在看这句…' }));
    try {
      const r = await wordSense(word, sentence, entry);
      if (tok !== WPTOK) return;
      senseNow = r.sense || '';
      const kids = [];
      if (r.sense || r.pos) kids.push(h('p', { class: 'wordpop-gloss' }, r.sense ? h('b', { text: r.sense }) : null, r.pos ? h('span', { class: 'small muted', text: ' ' + r.pos }) : null));
      if (r.note) kids.push(h('p', { class: 'hint warn', text: r.note }));
      for (const c of (r.colls || []).slice(0, 3)) kids.push(h('div', { class: 'wordpop-coll' },
        h('span', { class: 'en', text: c.en }), c.zh ? h('span', { class: 'zh', text: c.zh }) : null, sayBtn(c.en), chunkBtn(c.en, c.zh, '搭配 · ' + word)));
      if (!kids.length) kids.push(h('p', { class: 'hint', text: 'AI 没给出讲解。' }));
      senseBox.replaceChildren(...kids);
    } catch (e) {
      if (tok !== WPTOK) return;
      senseBox.replaceChildren(h('p', { class: 'err' }, e.message, ' ', h('button', { class: 'btn ghost', onclick: loadSense }, '重试')));
    }
    positionWordPop();
  }

  dictLookup(word).then(j => {
    if (tok !== WPTOK) return;
    entry = j;
    if (entry?.phonetic) phon.textContent = '/' + entry.phonetic + '/';
    paintDict();
  }).catch(e => {
    if (tok !== WPTOK) return;
    dict.replaceChildren(h('p', { class: 'err', text: e.message }));
    positionWordPop();
  });
  loadSense();

  return box;
}
document.addEventListener('click', e => {
  const w = e.target.closest?.('.w');
  if (w) {
    if (window.getSelection?.().toString()) return;
    openWordCard(w);
    return;
  }
  if (WPOP && !WPOP.contains(e.target)) closeWordCard();
});

/* ================= CHUNKS (语块本) ================= */
const RV = { on: false, id: null, shown: false, heard: null, busy: false, done: 0 };
function renderChunks() {
  const root = $('#view-chunks'); if (root.hidden) return;
  updateBadge();
  const due = dueList();
  const frag = [h('h2', { class: 'page-title', text: '语块本' })];
  if (RV.on) {
    if (!RV.id || !S.srs[RV.id] || S.srs[RV.id].due > Date.now()) { RV.id = due[0]?.[0] || null; RV.shown = false; RV.heard = null; RV.words = null; }
    if (!RV.id) { RV.on = false; frag.push(h('div', { class: 'next-cta' }, h('span', { text: '今天的复习完成了，一共 ' + RV.done + ' 条。' }), h('button', { class: 'btn', onclick: () => { RV.done = 0; renderChunks(); } }, '好'))); }
    else {
      const v = S.srs[RV.id], isWord = !!v.cloze;
      const card = h('div', { class: 'review' },
        h('div', { class: 'src', text: '还剩 ' + due.length + ' 条 · ' + (v.src || '') }),
        isWord
          ? h('div', { class: 'q' }, h('div', { class: 'cloze', text: clozeOf(v.en, v.cloze) }), v.zh ? h('div', { class: 'small muted' }, v.zh) : null)
          : h('div', { class: 'q', text: v.zh || '（没有中文意思）先回忆，再说出英文' }));
      if (!RV.shown) {
        card.append(h('p', { class: 'hint', text: isWord ? '看挖空的句子，把整句说出来，再看答案。' : '先开口说出英文，再看答案。说出来比在心里想更能记住。' }),
          h('div', { class: 'row' },
            micButton('rev', async blob => { RV.busy = true; renderChunks(); try { const j = await sttFull(blob, v.en, { kind: 'review', meta: { ref: v.en } }); RV.heard = j.text; RV.words = j.words; } catch (e) { alertBox(e.message); } RV.busy = false; RV.shown = true; renderChunks(); say(v.en); }, ['说出来', '说完了']),
            h('button', { class: 'btn', onclick: () => { RV.shown = true; renderChunks(); say(v.en); } }, '直接看答案')));
        if (RV.busy) card.append(h('p', { class: 'thinking', text: '识别中…' }));
      } else {
        card.append(h('div', { class: 'row' }, h('div', { class: 'a' }, isWord ? markWord(v.en, v.cloze) : v.en), sayBtn(v.en)));
        if (RV.heard != null) card.append(diffView(v.en, RV.heard, RV.words));
        card.append(h('div', { class: 'grades' }, [['忘了', 0], ['模糊', 1], ['想起来了', 2], ['脱口而出', 3]].map(([t, g]) => h('button', { class: 'btn', onclick: () => { S.srs[RV.id] = schedule(v, g); RV.done++; markDay('rv'); RV.id = null; save(); renderChunks(); } }, t, h('small', { text: ivlText(schedule(v, g)) })))));
      }
      frag.push(card, h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => { RV.on = false; renderChunks(); } }, '先停在这')));
    }
  } else {
    frag.push(h('div', { class: 'next-cta', style: due.length ? '' : 'background:var(--sunk);color:var(--muted)' },
      h('span', { text: due.length ? '今天要复习 ' + due.length + ' 条语块。看中文，开口说英文。' : '现在没有要复习的语块。新的语块会在课程和点评里出现，点星标就能加入。' }),
      due.length ? h('button', { class: 'btn primary', onclick: () => { RV.on = true; RV.done = 0; renderChunks(); } }, '开始复习') : null));
  }
  // add form
  const en = h('input', { class: 'text', placeholder: '英文语块，比如 make a decision', id: 'addEn' }), zh = h('input', { class: 'text', placeholder: '中文意思（可空）', id: 'addZh' });
  frag.push(h('div', { class: 'section' }, h('h2', { text: '手动添加' }), h('div', { class: 'form-grid' }, en, zh),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { if (en.value.trim()) { addChunk(en.value, zh.value, '手动添加'); renderChunks(); } } }, '加入语块本'))));
  // list
  const items = Object.entries(S.srs).sort((a, b) => b[1].t - a[1].t);
  const list = h('div', { class: 'saved srs-list' });
  for (const [id, v] of items) list.append(h('div', { class: 'saved-item' },
    h('span', { class: 'en', text: v.en }),
    h('span', { class: 'zh' },
      v.cloze ? h('span', { class: 'tag', text: '词卡' }) : null,
      v.cloze && v.mine ? h('span', { class: 'tag', text: '我说的' }) : null,
      [v.zh, v.src].filter(Boolean).join(' · '),
      h('span', { class: 'due', text: '　' + (v.due <= Date.now() ? '待复习' : ymd(new Date(v.due)) + ' 复习') })),
    h('div', { class: 'tools' }, sayBtn(v.en), h('button', { class: 'btn ghost icon-btn', title: '删除', 'aria-label': '删除', onclick: () => { delete S.srs[id]; save(); renderChunks(); } }, ic('x')))));
  if (!items.length) list.append(h('p', { class: 'hint', text: '还没有语块。' }));
  frag.push(h('div', { class: 'section' }, h('h2', { text: '全部语块 · ' + items.length }), list));
  root.replaceChildren(...frag);
}

/* ================= ERRORS (错误本) ================= */
const ER = { on: true, id: null, drill: null, heard: null, verdict: null, result: null, busy: false, sttBusy: false, err: '' };
const errWhen = ms => { const d = new Date(ms); return ymd(d) + ' ' + z2(d.getHours()) + ':' + z2(d.getMinutes()); };
function errSet(id) { ER.id = id || null; ER.drill = null; ER.heard = null; ER.verdict = null; ER.result = null; ER.busy = false; ER.sttBusy = false; ER.err = ''; }
function errNotice(keys) {
  const list = (Array.isArray(keys) ? keys : []).map(k => S.errs[k]?.title_zh).filter(Boolean);
  if (!list.length) return null;
  return h('div', { class: 'notice row' },
    h('span', { class: 'grow', text: '进了错误本：' + list.join('、') }),
    h('button', { class: 'btn', onclick: () => { setTab('errors'); window.scrollTo({ top: 0 }); } }, '去练'));
}
const errDelBtn = e => h('button', { class: 'btn ghost icon-btn', title: '删除', 'aria-label': '删除', onclick: () => {
  if (!confirm('删掉这条错误记录？')) return;
  delete S.errs[e.key]; errPromote(); save(); renderErrors();
} }, ic('x'));
function errHead(e, ...tools) {
  return h('div', { class: 'err-top' },
    h('span', { class: 'err-name grow', text: e.title_zh }),
    h('span', { class: 'tag', text: ERR_CATS[e.cat] || e.cat }),
    ...tools,
    errDelBtn(e));
}
function renderErrors() {
  const root = $('#view-errors'); if (root.hidden) return;
  updateBadge();
  const due = errDueList(), active = errList('active'), queued = errList('queued'), done = errList('done');
  let key = ER.id;
  if (!key || !S.errs[key]) key = due[0]?.key || null;
  else if (!ER.verdict && !due.some(e => e.key === key)) key = due[0]?.key || null;
  if (key !== ER.id) errSet(key);
  const cur = ER.id ? S.errs[ER.id] : null;
  const frag = [h('h2', { class: 'page-title', text: '错误本' }),
    h('p', { class: 'intro', text: '这里只放 AI 在你自由说话里发现的、最影响理解的错误。同时最多盯 5 个：每个先马上用新句子说对一次，48 小时后再复检，说对就毕业。' })];

  const practice = h('div', { class: 'section' },
    h('div', { class: 'row' }, h('h2', { class: 'grow', text: '现在要练' }), due.length ? h('span', { class: 'tag lamp', text: '待练 ' + due.length + ' 条' }) : null));
  const noDue = () => {
    let text;
    if (active.length) {
      const next = Math.min(...active.map(e => e.due).filter(v => v != null));
      text = '现在没有要练的。下一次复检：' + errWhen(next);
    } else if (!Object.keys(S.errs).length) {
      text = '还没有记录。在「今天 › 开口说」点「点评内容」，或在 AI 对话里点「结束并总结」，AI 会把最影响理解的 1–3 个错误放进来。';
    } else text = '现在没有要练的。';
    return h('div', { class: 'next-cta', style: 'background:var(--sunk);color:var(--muted)' }, h('span', { text }));
  };

  if (ER.on && cur && (ER.verdict || due.some(e => e.key === cur.key))) {
    const drill = ER.drill;
    const card = h('div', { class: 'err-practice' },
      h('div', { class: 'row' }, h('span', { class: 'err-title grow', text: cur.title_zh }), h('span', { class: 'tag', text: ERR_CATS[cur.cat] || cur.cat })),
      h('div', { class: 'err-meta' },
        h('span', { class: 'tag' + (cur.due == null ? ' lamp' : ''), text: cur.due == null ? '先马上说对一次' : cur.due > Date.now() ? '已说对，' + errWhen(cur.due) + ' 复检' : '48 小时复检' }),
        h('span', { text: '已经遇到 ' + cur.seen.length + ' 次' })),
      cur.rule_zh ? h('p', { class: 'hint', text: cur.rule_zh }) : null);
    if (drill) card.append(h('p', { class: 'err-drill', text: drill.zh }));
    if (drill && !ER.verdict) {
      const mb = micButton('err', async blob => {
        ER.sttBusy = true; ER.err = ''; renderErrors();
        try {
          const j = await sttFull(blob, '', { kind: 'review', meta: { ref: drill.en, err: cur.key } });
          ER.heard = j.text;
        } catch (e) { ER.err = e.message; }
        ER.sttBusy = false; renderErrors();
      }, ['说出来', '说完了']);
      if (ER.busy || ER.sttBusy) mb.disabled = true;
      card.append(h('div', { class: 'row' }, mb, h('span', { class: 'hint', text: '用一句新的英文把这个说法说对。' })));
      if (ER.sttBusy) card.append(h('p', { class: 'thinking', text: '本地识别中…' }));
    } else if (!drill) {
      const b = h('button', { class: 'btn primary', disabled: ER.busy, onclick: async () => {
        ER.busy = true; ER.err = ''; ER.heard = null; ER.verdict = null; ER.result = null; renderErrors();
        try {
          await errDrills(cur);
          ER.drill = errNextDrill(cur);
          if (!ER.drill) throw new Error('AI 没出好练习题，再试一次。');
        } catch (e) { ER.err = e.message; }
        ER.busy = false; renderErrors();
      } }, ER.busy ? '出题中…' : '出题');
      put(card, h('div', { class: 'row' }, b), ER.busy ? h('p', { class: 'thinking', text: 'AI 正在出题' }) : null);
    }
    if (drill && !ER.verdict && ER.heard != null) {
      const ta = h('textarea', { placeholder: '识别出的英文' });
      ta.value = ER.heard; ta.disabled = ER.busy;
      ta.oninput = () => { ER.heard = ta.value; };
      const jb = h('button', { class: 'btn primary', disabled: ER.busy, onclick: async () => {
        const said = ta.value.trim(); if (!said) { ta.focus(); return; }
        ER.busy = true; ER.err = ''; renderErrors();
        try {
          const verdict = await errJudge(cur, drill, said);
          ER.verdict = verdict;
          ER.result = errRecord(cur, drill, said, verdict);
          markDay('er');
        } catch (e) { ER.err = e.message; }
        ER.busy = false; renderErrors();
      } }, ER.busy ? 'AI 判断中…' : '判断');
      card.append(ta, h('p', { class: 'hint', text: '本地识别有时会把语法自动改对，和你说的不一样就手动改回来。' }), h('div', { class: 'row' }, jb));
    }
    if (ER.verdict && drill) {
      const v = ER.verdict;
      const note = {
        deployed: '这次说对了。48 小时后（' + errWhen(cur.due) + '）再复检一次。',
        graduated: '毕业了！这个错误移到「已毕业」。',
        again: '这次没过。看一下正确说法，再说一句新的。',
        practice: '这是额外练习，不影响复检时间。',
      }[ER.result] || '';
      const box = h('div', { class: 'err-verdict' },
        h('div', { class: 'row' }, h('span', { class: 'tag ' + (v.ok ? 'good' : 'lamp'), text: v.ok ? '说对了' : '没过' }), v.note ? h('span', { class: 'small', text: v.note }) : null));
      if (v.better) box.append(h('div', { class: 'say' }, h('p', { text: v.better }), sayBtn(v.better)));
      box.append(h('p', { class: 'sub-h', text: '参考答案' }), h('div', { class: 'say' }, h('p', { text: drill.en }), sayBtn(drill.en)));
      if (note) box.append(h('p', { class: 'err-result', text: note }));
      box.append(h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => {
          if (ER.result === 'again') { errSet(ER.id); renderErrors(); return; } // failed: another sentence on the same error
          const list = errDueList();
          const i = list.findIndex(e => e.key === ER.id);
          const next = list.length ? list[(i + 1) % list.length] : null;
          errSet(next?.key || null); renderErrors();
        } }, ER.result === 'again' ? '再说一句' : '下一个'),
        h('button', { class: 'btn ghost', onclick: () => { ER.on = false; errSet(null); renderErrors(); } }, '先停在这')));
      card.append(box);
    }
    if (ER.err) card.append(h('p', { class: 'err', text: ER.err }));
    practice.append(card);
  } else if (due.length) {
    practice.append(h('div', { class: 'next-cta', style: 'background:var(--sunk);color:var(--muted)' },
      h('span', { text: '还有 ' + due.length + ' 条错误要练。' }),
      h('button', { class: 'btn primary', onclick: () => { ER.on = true; renderErrors(); } }, ER.on ? '开始练' : '继续练')));
  } else {
    practice.append(noDue());
  }
  frag.push(practice);

  const activeList = h('div', { class: 'err-list' });
  for (const e of active) {
    const last = e.seen[e.seen.length - 1], wk = errWeekly(e);
    activeList.append(h('div', { class: 'err-item' },
      errHead(e, h('span', { class: 'err-count', text: '出现 ' + e.seen.length + ' 次' })),
      e.rule_zh ? h('p', { class: 'hint', text: e.rule_zh }) : null,
      last ? h('div', { class: 'fix' }, h('div', {}, h('s', { text: last.said }), ' → ', h('b', { text: last.better }))) : null,
      h('div', { class: 'row' }, h('span', { class: 'tag' + (e.due == null ? ' lamp' : ''), text: e.due == null ? '待说对一次' : ymd(new Date(e.due)) + ' 复检' })),
      wk.length >= 2
        ? h('div', { class: 'err-chart' }, window.lineChart(wk, { unit: '次/周', better: 'down', digits: 0, height: 90 }))
        : h('p', { class: 'hint', text: '每周出现次数：' + (wk.length ? wk[0].x + ' 那一周 ' + wk[0].y + ' 次' : '还没有记录') })));
  }
  if (!active.length) activeList.append(h('p', { class: 'hint', text: '现在没有正在盯的错误。' }));
  frag.push(h('div', { class: 'section' }, h('h2', { text: '正在盯的错误（' + active.length + ' / ' + ERR_MAX_ACTIVE + '）' }), activeList));

  if (queued.length) {
    const ql = h('div', { class: 'err-list' });
    for (const e of queued) ql.append(h('div', { class: 'err-item' }, errHead(e, h('span', { class: 'err-count', text: '出现 ' + e.seen.length + ' 次' }))));
    frag.push(h('div', { class: 'section' }, h('h2', { text: '排队中' }), h('p', { class: 'hint', text: '前面的毕业后自动补上。' }), ql));
  }

  const dsec = h('div', { class: 'section' }, h('h2', { text: '已毕业 · ' + done.length }));
  const gcurve = errGradCurve();
  if (gcurve.length >= 2) dsec.append(h('div', { class: 'err-chart' }, window.lineChart(gcurve, { unit: '个', better: 'up', digits: 0, height: 120 })));
  const dl = h('div', { class: 'err-list' });
  for (const e of done) dl.append(h('div', { class: 'err-item' }, errHead(e, h('span', { class: 'err-count', text: (e.grad ? ymd(new Date(e.grad)) : '—') + ' 毕业' }))));
  if (!done.length) dl.append(h('p', { class: 'hint', text: '还没有毕业的错误。' }));
  dsec.append(dl);
  frag.push(dsec);

  root.replaceChildren(...frag);
}

/* ================= CHAT ================= */
const SCEN = {
  topic: { label: '今日话题', role: n => 'You are a friendly IELTS speaking partner. Talk with the learner about "' + LESSONS[n - 1].t + '" in the style of IELTS Part ' + LESSONS[n - 1].p + ' and Part 3 follow-ups. Ask one question at a time. Give the learner chances to use the chunk "' + LESSONS[n - 1].x + '".' },
  research: { label: '介绍研究', line: 'academic', role: () => 'You are a friendly professor from another university meeting the learner at a poster session at an international conference. Ask about their research topic, why it matters, their method, results so far, and next steps.' },
  meeting: { label: '组会汇报', line: 'academic', role: () => "You are the learner's supervisor in a weekly lab meeting held in English. Ask them to report this week's progress, then ask kind but probing follow-up questions." },
  interview: { label: '英文面试', role: () => 'You are an interviewer for a research internship or a graduate job. Ask common interview questions one at a time.' },
  coffee: { label: '会议茶歇', role: () => 'You are a PhD student from another country chatting with the learner during a coffee break at a conference. Keep it light.' },
  free: { label: '自由聊天', role: () => 'You are a friendly English-speaking friend. Chat about daily life, food, hobbies and plans.' },
};
const CHAT = { scen: 'topic', lesson: 1, turns: [], view: [], busy: false, summary: null, started: false, err: '', draft: '' };
function rules() {
  const lvl = S.prefs.level === 'easy' ? 'Use simple, common words and short sentences (CEFR A2–B1).' : 'Use natural spoken English at about CEFR B2.';
  return LEARNER + '\n\nROLE-PLAY. ' + SCEN[CHAT.scen].role(CHAT.lesson) + '\n' + lvl + ' Keep each reply to 1–3 short spoken sentences and end with one question. The learner uses speech-to-text, so ignore punctuation and capitalisation.\nAfter every learner message reply with JSON: {"reply": "your next line in English", "reply_zh": "中文翻译", "feedback": null or {"better": "a more natural English version of the learner\'s LAST message", "note_zh": "中文一句，说明主要改动"}}. feedback is null when their message was already natural or there is no learner message yet. If the learner writes Chinese, put the English way to say it in feedback.better and set note_zh to "试着把这句英文读出来再接着聊".';
}
function startChatOn(n) { CHAT.scen = 'topic'; CHAT.lesson = n; resetChat(); setTab('chat'); startChat(); }
function resetChat() { CHAT.turns = []; CHAT.view = []; CHAT.summary = null; CHAT.started = false; CHAT.busy = false; CHAT.err = ''; }
async function chatCall(userText) {
  CHAT.busy = true; CHAT.err = ''; renderChat();
  const msgs = [{ role: 'system', content: rules() }, ...CHAT.turns.slice(-24)];
  if (userText == null) msgs.push({ role: 'user', content: '(Start the role-play now with a short greeting and your first question.)' });
  try {
    const r = await aiText('', { messages: msgs, temperature: 0.8 });
    const reply = String(r.reply || '').trim(); if (!reply) throw new Error('AI 没给出回复，再试一次。');
    if (userText != null && r.feedback?.better) { const last = CHAT.view[CHAT.view.length - 1]; if (last?.role === 'me') last.fb = { better: String(r.feedback.better), note: String(r.feedback.note_zh || '') }; }
    CHAT.turns.push({ role: 'assistant', content: reply });
    CHAT.view.push({ role: 'ai', en: reply, zh: String(r.reply_zh || '') });
    CHAT.busy = false; renderChat();
    if (S.prefs.autoSpeak) say(reply, $$('.msg.ai .speak-btn').pop());
  } catch (e) { CHAT.busy = false; CHAT.err = e.message; renderChat(); }
}
function startChat() { CHAT.started = true; chatCall(null); }
function sendChat(text) {
  text = text.trim(); if (!text || CHAT.busy) return;
  CHAT.turns.push({ role: 'user', content: text }); CHAT.view.push({ role: 'me', text }); CHAT.draft = '';
  markDay('ch'); chatCall(text);
}
async function summarize() {
  CHAT.summary = { loading: true }; renderChat();
  try {
    const transcriptTxt = CHAT.view.map(v => (v.role === 'ai' ? 'Partner: ' + v.en : 'Learner: ' + v.text)).join('\n');
    CHAT.summary = await aiText(LEARNER + '\n\nPractice conversation:\n---\n' + transcriptTxt.slice(-12000) + "\n---\nReview the LEARNER's English only. JSON: {\"comment_zh\": \"中文，三句以内总评\", \"patterns\": [{\"issue_zh\": \"反复出现的问题\", \"example\": \"learner's words\", \"better\": \"corrected\"}], \"chunks\": [{\"en\": \"multi-word chunk they could have used\", \"zh\": \"...\"}]}. At most 3 patterns, exactly 4 chunks." + errPromptPart());
    if (CHAT.summary) { CHAT.summary.errKeys = errIngest(CHAT.summary.errors, 'AI 对话 · ' + SCEN[CHAT.scen].label); updateBadge(); }
  } catch (e) { CHAT.summary = { error: e.message }; }
  renderChat();
}
function renderChat() {
  const root = $('#view-chat'); if (root.hidden) return;
  const frag = [h('h2', { class: 'page-title', text: 'AI 对话' })];
  const topicN = CHAT.scen === 'topic' ? CHAT.lesson : S.prefs.cur;
  frag.push(h('div', { class: 'chat-tools' },
    h('div', { class: 'chips' }, Object.entries(SCEN).map(([k, v]) => h('button', { class: 'chip', 'aria-pressed': String(CHAT.scen === k), onclick: () => { if (CHAT.scen === k) return; CHAT.scen = k; if (k === 'topic') CHAT.lesson = S.prefs.cur; resetChat(); renderChat(); } }, k === 'topic' ? '今日话题：' + (LESSONS[topicN - 1]?.t || '') : v.label))),
    h('div', { class: 'row' }, seg(['easy', 'normal'], S.prefs.level, v => { S.prefs.level = v; save(); }, v => (v === 'easy' ? '简单' : '正常')),
      h('label', { class: 'row small muted' }, h('input', { type: 'checkbox', checked: S.prefs.autoSpeak, onchange: e => { S.prefs.autoSpeak = e.target.checked; save(); } }), 'AI 的话自动朗读'),
      h('span', { class: 'grow' }), CHAT.started ? h('button', { class: 'btn ghost', onclick: () => { resetChat(); renderChat(); } }, '重新开始') : null), needKeyNote('text')));
  const log = h('div', { class: 'log' });
  if (!CHAT.started) log.append(h('div', { class: 'empty' }, h('p', { text: '选一个场景，AI 先开口。你点「说」用英文回答，录音会自动转成文字，每一轮它会顺手帮你改一句。' }), h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn primary', onclick: startChat }, '开始对话'))));
  for (const v of CHAT.view) {
    if (v.role === 'ai') { const zh = h('div', { class: 'zh', hidden: true, text: v.zh }); const sb = sayBtn(v.en); sb.classList.add('speak-btn'); log.append(h('div', { class: 'msg ai' }, h('div', { class: 'bubble' }, wordify(v.en, { src: '对话' })), h('div', { class: 'tools' }, sb, v.zh ? h('button', { class: 'btn ghost small', onclick: () => { zh.hidden = !zh.hidden; } }, '译') : null), zh)); }
    else log.append(h('div', { class: 'msg me' }, h('div', { class: 'bubble' }, wordify(v.text, { mine: true, src: '对话' })), v.fb ? h('div', { class: 'fb' }, h('div', { class: 'row' }, h('span', { class: 'better grow', text: v.fb.better }), sayBtn(v.fb.better), chunkBtn(v.fb.better, '', '对话 · ' + SCEN[CHAT.scen].label)), v.fb.note ? h('span', { class: 'small', text: v.fb.note }) : null) : null));
  }
  if (CHAT.busy) log.append(h('p', { class: 'thinking', text: 'AI 正在想…' }));
  if (CHAT.err) log.append(h('p', { class: 'err', text: CHAT.err }));
  frag.push(log);
  if (CHAT.summary) {
    const s = CHAT.summary, box = h('div', { class: 'result' }, h('h3', { text: '这次对话的总结' }));
    if (s.loading) box.append(h('p', { class: 'thinking', text: 'AI 正在整理…' }));
    else if (s.error) box.append(h('p', { class: 'err', text: s.error }));
    else {
      if (s.comment_zh) box.append(h('p', { text: esc(s.comment_zh) }));
      for (const p of (s.patterns || []).slice(0, 3)) box.append(h('div', { class: 'fix' }, h('b', { text: esc(p.issue_zh) }), h('div', {}, h('s', { text: esc(p.example) }), ' → ', h('span', { text: esc(p.better) }))));
      for (const x of (s.chunks || []).slice(0, 4)) box.append(h('div', { class: 'ex' }, sayBtn(esc(x.en)), h('span', { class: 'en', text: esc(x.en) }), chunkBtn(esc(x.en), esc(x.zh), '对话总结'), h('span', { class: 'zh', text: esc(x.zh) })));
      const errN = errNotice(s.errKeys); if (errN) box.append(errN);
    }
    frag.push(box);
  }
  if (CHAT.started) {
    const ta = h('textarea', { id: 'chatInput', placeholder: '点「说」录音，或直接打字。⌘ + Enter 发送' });
    ta.value = CHAT.draft; ta.oninput = () => { CHAT.draft = ta.value; };
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendChat(ta.value); } });
    const mineCount = CHAT.view.filter(v => v.role === 'me').length;
    frag.push(h('div', { class: 'composer' }, ta, h('div', { class: 'row' },
      micButton('chat', async blob => { CHAT.sttBusy = true; renderChat(); try { const t = await stt(blob, '', { kind: 'chat', line: SCEN[CHAT.scen].line || 'daily', meta: { scen: CHAT.scen } }); CHAT.draft = (CHAT.draft ? CHAT.draft + ' ' : '') + t; } catch (e) { alertBox(e.message); } CHAT.sttBusy = false; renderChat(); }),
      CHAT.sttBusy ? h('span', { class: 'thinking', text: '转写中…' }) : null,
      h('button', { class: 'btn primary', disabled: CHAT.busy, onclick: () => sendChat(ta.value) }, ic('send'), '发送'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn', disabled: mineCount < 2 || CHAT.busy, onclick: summarize }, '结束并总结'))));
  }
  root.replaceChildren(...frag);
  window.scrollTo(0, document.body.scrollHeight);
}

/* ================= 4/3/2 RETELL ================= */
const PLANS = { full: [240, 180, 120], short: [120, 90, 60] };
const RT = { topic: '', line: 'daily', plan: 'full', set: null, rounds: [] };
async function recordRound(i) {
  if (Rec.isOn('rt')) { Rec.stop(); return; }
  if (!RT.topic.trim()) { alertBox('先写下要讲的内容。'); return; }
  if (i === 0) RT.set = 's' + Date.now().toString(36);
  const lim = PLANS[RT.plan][i];
  const blob = await timedRec('rt', lim, renderRetell);
  if (!blob) { renderRetell(); return; }
  const r = { pending: true, url: URL.createObjectURL(blob) }; RT.rounds[i] = r; markDay('rt'); renderRetell();
  try {
    const j = await sttFull(blob, '', { kind: 'r432', line: RT.line, meta: { set: RT.set, round: i + 1, limit: lim, topic: RT.topic.trim().slice(0, 300) } });
    Object.assign(r, { id: j.id, metrics: j.metrics, text: j.text });
  } catch (e) { r.error = e.message; }
  r.pending = false; renderRetell();
}
function resetRetell() { if (Rec.isOn('rt')) Rec.stop(); RT.rounds.forEach(r => r?.url && URL.revokeObjectURL(r.url)); RT.rounds = []; RT.set = null; }
function renderRetell() {
  const root = $('#view-retell'); if (root.hidden) return;
  if (!RT.topic && N) RT.topic = promptText(LESSONS[S.prefs.cur - 1]);
  const limits = PLANS[RT.plan], k = RT.rounds.length, recOn = Rec.isOn('rt'), started = k > 0 || recOn;
  const frag = [h('h2', { class: 'page-title', text: '4/3/2 复述' }),
    h('p', { class: 'intro', text: '同一段内容连讲三遍，时间一遍比一遍短，到时间自动停。不用背稿，每遍把同样的意思讲完就行。第 2、3 遍是在重复第 1 遍，所以只有第 1 遍进「进步」页的曲线。' })];
  const ta = h('textarea', { style: 'min-height:64px', disabled: started, placeholder: '要讲的话题或内容' }); ta.value = RT.topic; ta.oninput = () => { RT.topic = ta.value; };
  frag.push(h('div', { class: 'card' }, h('h3', { class: 'sub-h', text: '讲什么' }), ta,
    started ? null : h('div', { class: 'row' },
      h('button', { class: 'btn ghost', onclick: () => { RT.topic = promptText(LESSONS[S.prefs.cur - 1]); RT.line = 'daily'; renderRetell(); } }, '用今天的话题'),
      h('button', { class: 'btn ghost', onclick: () => { RT.topic = BASELINES[1].en; RT.line = 'academic'; renderRetell(); } }, '讲我的研究'),
      h('span', { class: 'grow' }),
      seg(['daily', 'academic'], RT.line, v => { RT.line = v; }, v => (v === 'daily' ? '日常线' : '学术线')),
      seg(['full', 'short'], RT.plan, v => { RT.plan = v; renderRetell(); }, v => (v === 'full' ? '4/3/2 分钟' : '2/1.5/1 分钟')))));
  frag.push(h('div', { class: 'rounds' }, limits.map((lim, i) => {
    const r = RT.rounds[i], cur = i === k, on = recOn && cur;
    return h('div', { class: 'round' + (cur ? ' cur' : '') + (on ? ' live' : '') },
      h('div', { class: 'row' }, h('b', { class: 'grow', text: '第 ' + (i + 1) + ' 遍' }), h('span', { class: 'hint', text: '限时 ' + fmt(lim) })),
      cur ? timerView('rt', lim) : null,
      cur ? h('button', { class: 'big-rec' + (on ? ' on' : ''), onclick: () => recordRound(i) }, on ? [recDot(), '说完了'] : [ic('mic'), i ? '开始第 ' + (i + 1) + ' 遍' : '开始']) : null,
      r?.pending ? h('p', { class: 'thinking', text: '本地转写、计算指标中' }) : null,
      r?.error ? h('p', { class: 'err', text: r.error }) : null,
      r?.metrics ? metricsView(r.metrics, i && RT.rounds[0]?.metrics) : null,
      r ? h('audio', { controls: true, preload: 'none', src: r.id ? recAudio(r.id) : r.url }) : null,
      !r && !cur ? h('p', { class: 'hint', text: '等上一遍说完' }) : null);
  })));
  if (k === 3 && RT.rounds.every(r => r.metrics)) {
    const a = RT.rounds[0].metrics, c = RT.rounds[2].metrics;
    frag.push(h('div', { class: 'next-cta' }, h('span', { text: '第 1 遍 → 第 3 遍：语速 ' + Math.round(a.wpm) + ' → ' + Math.round(c.wpm) + ' 词/分，连贯段 ' + a.mlr + ' → ' + c.mlr + ' 词，填充词 ' + a.fillers_per100 + ' → ' + c.fillers_per100 + ' 个/百词。' }),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { resetRetell(); renderRetell(); } }, '同一内容再来一组'), h('button', { class: 'btn ghost', onclick: () => { resetRetell(); RT.topic = ''; renderRetell(); } }, '换个内容'))));
  } else if (started && !recOn) frag.push(h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => { resetRetell(); renderRetell(); } }, '放弃这一组，重新开始')));
  const hist = h('div', { class: 'section' });
  frag.push(hist);
  root.replaceChildren(...frag);
  loadRecs().then(() => {
    const sets = {};
    for (const r of RECS.list) if (r.kind === 'r432' && r.meta?.set) (sets[r.meta.set] ||= []).push(r);
    const rows = Object.values(sets).map(rs => rs.sort((x, y) => (x.meta.round || 0) - (y.meta.round || 0))).sort((x, y) => y[0].t - x[0].t).slice(0, 12);
    if (!rows.length) return;
    hist.replaceChildren(h('h2', { text: '以前的 4/3/2' }), h('div', { class: 'saved' }, rows.map(rs => h('div', { class: 'saved-item' },
      h('span', { class: 'en', text: rs[0].meta.topic || '' }),
      h('span', { class: 'zh', text: rs[0].date + ' · ' + (rs[0].line === 'academic' ? '学术线' : '日常线') + ' · 语速 ' + rs.map(r => Math.round(r.metrics?.wpm || 0)).join(' → ') + ' 词/分' })))));
  });
}

/* ================= PROGRESS ================= */
const PG = { line: 'daily', all: false, show: 20 };
const BL = {};
function curvePoints(line, key) {
  const by = {};
  for (const r of RECS.list) if (r.line === line && inCurve(r)) (by[r.date] ||= []).push(r.metrics[key]);
  return Object.keys(by).sort().map(d => {
    const v = by[d].sort((a, b) => a - b), n = v.length;
    return { x: d, y: n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2, label: n + ' 段录音的中位数' };
  });
}
async function recordBaseline(b) {
  const st = BL[b.id];
  const blob = await timedRec('bl-' + b.id, b.secs, renderProgress);
  if (!blob) { renderProgress(); return; }
  st.busy = true; renderProgress();
  try {
    const j = await sttFull(blob, '', { kind: 'baseline', line: b.line, meta: { bid: b.id, prompt: b.en } });
    markDay('bl'); await loadRecs(); st.pick = j.id;
  } catch (e) { alertBox(e.message); }
  st.busy = false; renderProgress();
}
function recCol(r, label, base) {
  return h('div', { class: 'ab-col' },
    h('div', { class: 'row' }, h('b', { class: 'grow', text: label }), h('span', { class: 'hint', text: r.date })),
    h('audio', { controls: true, preload: 'none', src: recAudio(r.id) }),
    metricsView(r.metrics, base),
    h('details', {}, h('summary', { text: '看转写' }), h('p', { class: 'small' }, r.text ? wordify(r.text, { mine: true, src: KIND_ZH[r.kind] || '' }) : '（没识别出文字）')));
}
function baselineCard(b) {
  const rs = baseRecs(b), st = BL[b.id] || (BL[b.id] = { busy: false, pick: null }), owner = 'bl-' + b.id, on = Rec.isOn(owner), due = baseDue(b);
  const first = rs[0], other = rs.find(r => r.id === st.pick && r !== first) || (rs.length > 1 ? rs[rs.length - 1] : null);
  const box = h('div', { class: 'base-card' + (due ? ' due' : '') },
    h('div', { class: 'row' }, h('h3', { class: 'grow', text: b.title }),
      h('span', { class: 'tag' + (due ? ' lamp' : ' good'), text: !rs.length ? '还没录过' : due ? '这个月该录了' : '下次 ' + ymd(new Date(rs[rs.length - 1].t + BASE_EVERY * 864e5)) })),
    h('div', { class: 'row' }, h('p', { class: 'prompt grow', text: b.en }), sayBtn(b.en, '朗读题目')),
    h('div', { class: 'timer' },
      h('button', { class: 'big-rec' + (on ? ' on' : ''), disabled: st.busy, onclick: () => recordBaseline(b) }, on ? [recDot(), '说完了'] : [ic('mic'), '录第 ' + (rs.length + 1) + ' 次']),
      timerView(owner, b.secs)),
    st.busy ? h('p', { class: 'thinking', text: '本地转写、计算指标中' }) : null);
  if (!first) box.append(h('p', { class: 'hint', text: '题目和时长永远不变，每月录一次，到 1 分钟自动停。第一次录的就是你的起点。' }));
  else if (!other) box.append(h('div', { class: 'ab one' }, recCol(first, '第 1 次', null)), h('p', { class: 'hint', text: '下个月再录一次，这里会把第 1 次和最新一次并排放，直接听出差别。' }));
  else {
    box.append(h('div', { class: 'ab' }, recCol(first, '第 1 次', null), recCol(other, '第 ' + (rs.indexOf(other) + 1) + ' 次', first.metrics)));
    if (rs.length > 2) box.append(h('label', { class: 'row small muted' }, '右边换成', h('select', { onchange: e => { st.pick = e.target.value; renderProgress(); } },
      rs.slice(1).map((r, i) => h('option', { value: r.id, selected: r === other }, '第 ' + (i + 2) + ' 次 · ' + r.date)))));
    box.append(h('p', { class: 'hint', text: '同一道题录得越多越熟，变化里有一部分来自熟悉题目；隔一个月录一次能减小这个影响。' }));
  }
  return box;
}
const recTopic = r => r.meta?.prompt || r.meta?.topic || r.meta?.ref || r.meta?.src || '';
async function renderProgress() {
  const root = $('#view-progress'); if (root.hidden) return;
  await loadRecs();
  if (root.hidden) return;
  const frag = [h('h2', { class: 'page-title', text: '进步' }),
    h('p', { class: 'intro', text: '这里只放你的录音和从录音里算出来的数字，不打分、不算等级。指标由本机 Whisper 的逐词时间戳算出，单次会有波动，看趋势。' })];
  frag.push(h('div', { class: 'section' }, h('h2', { text: '基准录音：第 1 次 vs 现在' }), BASELINES.map(baselineCard)));

  const curve = h('div', { class: 'section' }, h('div', { class: 'row' }, h('h2', { class: 'grow', text: '流利度曲线' }),
    seg(['daily', 'academic'], PG.line, v => { PG.line = v; renderProgress(); }, v => (v === 'daily' ? '日常线' : '学术线'))));
  const nIn = RECS.list.filter(r => r.line === PG.line && inCurve(r)).length;
  curve.append(h('p', { class: 'hint', text: '每个点是当天自由说话录音（开口说、基准录音、4/3/2 第 1 遍，每段 ≥ 20 词）的中位数。这条线上共有 ' + nIn + ' 段。' }));
  const charts = h('div', { class: 'charts' });
  for (const x of METRICS) {
    const pts = curvePoints(PG.line, x.k);
    charts.append(h('div', { class: 'chart-card' },
      h('div', { class: 'row' }, h('b', { class: 'grow', text: x.zh }), h('span', { class: 'hint', text: x.unit + ' · ' + (x.better === 'up' ? '越高越好' : '越低越好') })),
      lineChart(pts.map(p => ({ ...p, y: +p.y.toFixed(x.digits) })), { unit: x.unit, better: x.better, digits: x.digits, height: 150 }),
      h('p', { class: 'hint', text: x.tip })));
  }
  curve.append(charts);
  if (curvePoints(PG.line, 'wpm').length < 2) curve.append(h('p', { class: 'hint', text: '至少要两天的录音才看得出趋势。研究里语速通常 1–3 周就能测出变化。' }));
  frag.push(curve);

  const all = RECS.list.filter(r => PG.all || CURVE_KINDS.includes(r.kind) || r.kind === 'chat');
  const list = h('div', { class: 'saved' }, all.slice(0, PG.show).map(r => {
    const d = new Date(r.t), m = r.metrics;
    return h('div', { class: 'rec-item' },
      h('div', { class: 'row' }, h('b', { text: KIND_ZH[r.kind] || r.kind }), h('span', { class: 'tag', text: r.line === 'academic' ? '学术线' : '日常线' }),
        h('span', { class: 'hint grow', text: r.date + ' ' + z2(d.getHours()) + ':' + z2(d.getMinutes()) + ' · ' + Math.round(r.duration) + ' 秒' + (m?.reliable ? ' · ' + Math.round(m.wpm) + ' 词/分' : '') })),
      recTopic(r) ? h('p', { class: 'small muted', text: recTopic(r) }) : null,
      h('details', {}, h('summary', { text: '听 / 看转写' }), h('audio', { controls: true, preload: 'none', src: recAudio(r.id) }), h('p', { class: 'small' }, r.text ? wordify(r.text, { mine: true, src: KIND_ZH[r.kind] || '' }) : '（没识别出文字）'), metricsView(m)));
  }));
  if (!all.length) list.append(h('p', { class: 'hint', text: '还没有录音。今天课里的「开口说」、4/3/2、基准录音和 AI 对话，录完都会自动存在这里。' }));
  frag.push(h('div', { class: 'section' }, h('div', { class: 'row' }, h('h2', { class: 'grow', text: '录音存档 · ' + all.length }),
    h('label', { class: 'row small muted' }, h('input', { type: 'checkbox', checked: PG.all, onchange: e => { PG.all = e.target.checked; PG.show = 20; renderProgress(); } }), '也显示跟读、造句、复习的短录音')),
    list, all.length > PG.show ? h('button', { class: 'btn ghost', onclick: () => { PG.show += 40; renderProgress(); } }, '再显示 40 条') : null));

  const weeks = 20, end = new Date(), start = new Date(); start.setDate(end.getDate() - ((end.getDay() + 6) % 7) - (weeks - 1) * 7);
  const heat = h('div', { class: 'heat', role: 'img', 'aria-label': '最近 ' + weeks + ' 周' });
  for (let i = 0; i < weeks * 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const k = ymd(d); heat.append(h('i', { class: d > end ? 'future' : 'l' + level(k), title: k })); }
  const srsN = Object.keys(S.srs).length, mature = Object.values(S.srs).filter(v => v.ivl >= 21).length;
  frag.push(h('div', { class: 'section' }, h('h2', { text: '练习习惯' }),
    h('p', { class: 'hint', text: '日历只提醒你每天来，不代表进步。累计练了 ' + Object.keys(S.days).filter(active).length + ' 天，完成 ' + lessonsDone() + ' / ' + N + ' 课；语块本 ' + srsN + ' 条，' + mature + ' 条复习间隔已超过 3 周。' }),
    h('div', { class: 'heat-wrap' }, heat)));
  const y = window.scrollY; root.replaceChildren(...frag); window.scrollTo(0, y);
}

/* ================= SETTINGS ================= */
async function renderSettings() {
  const root = $('#view-settings'); if (root.hidden) return;
  try { CFG = await api('/api/config'); STATUS = await api('/api/status'); } catch (e) { root.replaceChildren(h('p', { class: 'err', text: e.message })); return; }
  const frag = [h('h2', { class: 'page-title', text: '设置' })];
  const U = await api('/api/usage').catch(() => null);
  if (U) {
    const tok = n => (n >= 1e4 ? (n / 1e4).toFixed(1) + ' 万' : String(n));
    frag.push(h('div', { class: 'prov' }, h('h3', { text: '本月 AI 花费（' + U.month + '）' }),
      h('div', { class: 'usage-total' }, h('b', { text: '¥' + U.total.toFixed(2) }), h('span', { class: 'hint', text: U.models.reduce((a, m) => a + m.calls, 0) + ' 次调用' })),
      U.models.length ? h('div', {}, U.models.map(m => h('div', { class: 'usage-row' },
        h('span', { class: 'grow', text: m.provider + ' · ' + m.model }),
        h('span', { class: 'hint', text: m.calls + ' 次 · 输入 ' + tok(m.in) + ' · 输出 ' + tok(m.out) + ' tokens' }),
        h('b', { text: m.unpriced === m.calls ? '未知' : '¥' + m.cost.toFixed(2) })))) : null,
      h('p', { class: 'hint', text: '按官方标价估算：DeepSeek 工作日 9–12 点、14–18 点是高峰价（翻倍），其余时间半价；实际以服务商账单为准。本机 Whisper 转写不花钱。' })));
  }
  const tp = h('select', { id: 'textProv', onchange: async e => { CFG = await post('/api/config', { text_provider: e.target.value }); STATUS = await api('/api/status'); } },
    ['deepseek', 'glm'].map(k => h('option', { value: k, selected: CFG.text_provider === k }, CFG.providers[k].label)));
  frag.push(h('div', { class: 'prov' }, h('h3', { text: '文字任务用哪个模型' }), h('label', {}, '讲解、点评、对话', tp)));
  for (const k of ['deepseek', 'glm', 'omni']) {
    const p = CFG.providers[k];
    const url = h('input', { value: p.base_url, id: k + '-url' }), model = h('input', { value: p.model, id: k + '-model', list: k + '-models', placeholder: '模型名' }),
      key = h('input', { type: 'password', id: k + '-key', placeholder: p.has_key ? '已保存（' + p.api_key + '），要换就重新填' : '粘贴 API key', autocomplete: 'off' });
    const dl = h('datalist', { id: k + '-models' });
    const msg = h('p', { class: 'hint' });
    const saveIt = async () => { CFG = await post('/api/config', { providers: { [k]: { base_url: url.value, model: model.value, api_key: key.value } } }); key.value = ''; STATUS = await api('/api/status'); };
    frag.push(h('div', { class: 'prov' },
      h('h3', {}, h('span', { class: p.has_key && p.model ? 'ok-dot' : 'no-dot' }), p.label),
      k === 'omni' ? h('p', { class: 'hint', text: '用来「听」你的录音、点评发音。在阿里云百炼开通后创建 API key；模型推荐 qwen3.8-omni-flash。接口地址如果报错，换成百炼控制台里你工作空间的地址。' }) : null,
      k === 'deepseek' && p.model === 'deepseek-chat' ? h('p', { class: 'hint warn', text: 'DeepSeek 已经不提供 deepseek-chat 了。点「获取模型列表」，在模型里选 deepseek-flash，再点保存。' }) : null,
      k === 'glm' ? h('p', { class: 'hint', text: '模型名填你在智谱开放平台能用的那个（可以先保存 key，再点「获取模型列表」挑）。' }) : null,
      h('label', {}, '接口地址', url), h('label', {}, '模型', model, dl), h('label', {}, 'API key（只存在这台电脑的 config.json 里）', key),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: async () => { try { await saveIt(); msg.textContent = '已保存。'; renderSettings(); } catch (e) { msg.textContent = e.message; } } }, '保存'),
        h('button', { class: 'btn', onclick: async () => { msg.textContent = '测试中…'; try { await saveIt(); const r = await post('/api/config/test', { provider: k }); msg.textContent = '连接成功，模型回复：' + r.reply; } catch (e) { msg.textContent = e.message; } } }, '测试连接'),
        h('button', { class: 'btn ghost', onclick: async () => { msg.textContent = '获取中…'; try { await saveIt(); const r = await post('/api/config/models', { provider: k }); dl.replaceChildren(...r.models.map(m => h('option', { value: m }))); msg.textContent = '共 ' + r.models.length + ' 个模型，点模型输入框可以选。'; } catch (e) { msg.textContent = e.message; } } }, '获取模型列表')),
      msg));
  }
  // whisper / transcripts
  const pct = STATUS.lessons ? Math.round(STATUS.ielts_transcribed / STATUS.lessons * 100) : 0;
  frag.push(h('div', { class: 'prov' }, h('h3', { text: '本地 Whisper 字幕' }),
    h('p', { class: 'hint', text: 'IELTSCast 已生成 ' + STATUS.ielts_transcribed + ' / ' + STATUS.lessons + ' 集逐句字幕；队列里还有 ' + STATUS.queue + ' 个。' + (STATUS.whisper?.error ? ' 最近的错误：' + STATUS.whisper.error : '') }),
    h('div', { class: 'progress' }, h('i', { style: 'width:' + pct + '%' })),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { const r = await post('/api/transcribe_all', {}); alertBox('已加入 ' + r.queued + ' 个文件，后台慢慢转写。'); renderSettings(); } }, '把全部课程音频加入转写队列'))));
  // voice
  const vsel = h('select', { id: 'voiceSel', onchange: e => { S.prefs.voice = e.target.value; save(); } }, h('option', { value: '' }, '自动选择'), VOICES.map(v => h('option', { value: v.voiceURI, selected: v.voiceURI === S.prefs.voice }, v.name + ' (' + v.lang + ')')));
  const rv = h('span', { class: 'mono', text: S.prefs.ttsRate.toFixed(2) + '×' });
  frag.push(h('div', { class: 'prov' }, h('h3', { text: '朗读声音' }), h('label', {}, 'AI 文字的朗读声音（来自 macOS）', vsel),
    h('label', {}, h('span', {}, '朗读速度 ', rv), h('input', { type: 'range', min: 0.6, max: 1.2, step: 0.05, value: S.prefs.ttsRate, oninput: e => { S.prefs.ttsRate = +e.target.value; rv.textContent = (+e.target.value).toFixed(2) + '×'; }, onchange: save })),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: e => say("Hi! This is how I sound. Let's practise speaking every day.", e.currentTarget) }, ic('speak'), '试听')),
    h('p', { class: 'hint', text: '想要更自然的声音：系统设置 › 辅助功能 › 朗读内容 › 系统声音 › 管理声音，下载英语的「Ava（高级）」或「Zoe（高级）」，然后回来选它。' })));
  root.replaceChildren(...frag);
}

/* ================= boot ================= */
(async function boot() {
  try {
    const [ls, st] = await Promise.all([api('/api/lessons'), api('/api/status')]);
    LESSONS = ls.lessons; N = LESSONS.length; STATUS = st;
    await Promise.all([
      api('/api/state').then(d => { for (const k of ['days', 'lessons', 'srs', 'cards', 'errs']) if (d[k]) S[k] = d[k]; Object.assign(S.prefs, d.prefs || {}); }).catch(() => {}),
      loadRecs()]);
  } catch (e) { $('#view-today').replaceChildren(h('p', { class: 'err', text: e.message })); return; }
  if (!S.prefs.cur || S.prefs.cur > N) S.prefs.cur = 1;
  CHAT.lesson = S.prefs.cur;
  renderHeader(); updateBadge();
  setTab((location.hash || '#today').slice(1));
  setInterval(updateBadge, 60000);
})();
