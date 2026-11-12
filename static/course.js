'use strict';
/* 回声 · Rebirth 第 1 期：课程骨架
   载入 static/course.json，把「今天」页画成五段一节的课程：回忆 → 声音 → 新句 → 用 → 快。
   这里只做新课程；旧的雅思三步课程仍在 app.js 的 renderToday 里，由「雅思跟读」页使用。
   进度只在 S.rb 里读写，不碰 S.prefs.cur / S.lessons / S.cards。 */

let COURSE = null;
let COURSE_ERROR = '';
const COURSE_READY = (async () => {
  try {
    const res = await fetch('course.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('读不到课程数据 course.json（' + res.status + '）');
    const data = await res.json();
    if (!data || !Array.isArray(data.units)) throw new Error('course.json 里没有 units 数组');
    COURSE = data;
    return COURSE;
  } catch (e) {
    COURSE = null;
    COURSE_ERROR = e.message || String(e);
    return null;
  }
})();

/* 五段的顺序、预算和显示名。预算按规格固定，单位秒。 */
const RB_SEGS = [
  { id: 'recall', zh: '回忆', mins: 4, secs: 240 },
  { id: 'sound', zh: '声音', mins: 3, secs: 180 },
  { id: 'pattern', zh: '新句', mins: 6, secs: 360 },
  { id: 'use', zh: '用', mins: 9, secs: 540 },
  { id: 'fast', zh: '快', mins: 3, secs: 180 },
];
const RB_GRADE = { 3: '脱口而出 · 3', 2: '想起来了 · 2', 1: '有点卡 · 1', 0: '忘了 · 0' };
/* 开口快到什么程度算「3 分」：录音开始后 2.5 秒内出声（沿用 autoGrade 的判法）。 */
const RB_FAST_ONSET = 2.5;

/* 只放在内存里的进行状态；S.rb.cur 只负责刷新后回到这一段的开头。 */
const RB = {
  unit: null, seg: null, idx: 0, pass: 0, elapsed: 0, timeUp: false,
  busy: false, busyLabel: '', doneSegs: [], cards: [], items: [], result: null,
  finished: null, recallOnly: false, recallSkipped: false, use: null, fast: null, fastPrev: null,
  fastError: '', fastOwner: '', spoken: 0, lastTick: 0, started: false,
};

/* ================= 进度 S.rb ================= */
function rbNorm() {
  if (!S.rb || typeof S.rb !== 'object' || Array.isArray(S.rb)) S.rb = { n: 0, unit: 0, log: [], cur: null };
  const r = S.rb;
  r.n = Number.isFinite(+r.n) && +r.n >= 0 ? Math.floor(+r.n) : 0;
  r.unit = Number.isFinite(+r.unit) && +r.unit >= 0 ? Math.floor(+r.unit) : 0;
  r.log = Array.isArray(r.log) ? r.log : [];
  r.cur = r.cur && typeof r.cur === 'object' ? r.cur : null;
  return r;
}
const rbUnits = () => (COURSE && Array.isArray(COURSE.units) ? COURSE.units : []);
const rbSegInfo = id => RB_SEGS.find(s => s.id === id) || RB_SEGS[0];
const rbLeft = () => Math.max(0, (Number(COURSE?.total) || 0) - rbNorm().n);
const rbToMilestone = () => {
  const m = Math.max(1, Number(COURSE?.milestone) || 1);
  return m - (rbNorm().n % m);
};
function rbTodaySecs() {
  const d = today();
  const fromLog = rbNorm().log
    .filter(x => x && x.date === d)
    .reduce((a, x) => a + (Number(x.secs) || 0), 0);
  return Math.round(fromLog + (RB.finished ? 0 : RB.spoken));
}
function rbLastLogWpm() {
  const rows = rbNorm().log.filter(x => x && Number.isFinite(+x.wpm));
  return rows.length ? Math.round(+rows[rows.length - 1].wpm) : null;
}
function rbMetricsLine(m) {
  if (!m) return '';
  const bits = [];
  if (Number.isFinite(+m.wpm)) bits.push('语速 ' + Math.round(+m.wpm) + ' 词/分');
  if (Number.isFinite(+m.fillers_per100)) bits.push('填充词 ' + (+m.fillers_per100).toFixed(1) + ' 个/百词');
  if (Number.isFinite(+m.mlr)) bits.push('连贯段 ' + (+m.mlr).toFixed(1) + ' 词');
  return bits.join(' · ');
}

/* ================= 段与一节的推进 ================= */
function rbPatternItems(unit) {
  const sents = (unit?.pattern?.sentences || []).map((x, i) => ({ kind: 'sentence', i, ...x }));
  const swaps = (unit?.pattern?.swaps || []).map((x, i) => ({ kind: 'swap', i, ...x }));
  return [...sents, ...swaps];
}

function rbBeginSeg(id, unit) {
  RB.seg = id;
  RB.elapsed = 0;
  RB.timeUp = false;
  RB.busy = false;
  RB.busyLabel = '';
  RB.idx = 0;
  RB.pass = 0;
  RB.result = null;
  RB.lastTick = Date.now();
  RB.doneSegs = RB_SEGS.slice(0, Math.max(0, RB_SEGS.findIndex(x => x.id === id))).map(x => x.id);
  RB.cards = [];
  RB.items = [];
  RB.fastError = '';
  if (id === 'recall') RB.cards = dueList().slice(0, 8).map(([cid, card]) => ({ id: cid, card }));
  if (id === 'sound') RB.items = (unit?.sound?.items || []).slice();
  if (id === 'pattern') RB.items = rbPatternItems(unit);
  if (id === 'use') rbInitUse(unit);
  if (id === 'fast') rbInitFast(unit);
  if (!RB.recallOnly) {
    rbNorm().cur = { unit: rbNorm().unit, seg: id, date: today() };
    save();
  }
}

function rbResetForUnit(idx) {
  RB.unit = idx;
  RB.started = false;
  RB.seg = null;
  RB.finished = null;
  RB.recallOnly = false;
  RB.recallSkipped = false;
  RB.idx = 0;
  RB.pass = 0;
  RB.result = null;
  RB.elapsed = 0;
  RB.timeUp = false;
  RB.busy = false;
  RB.busyLabel = '';
  RB.doneSegs = [];
  RB.cards = [];
  RB.items = [];
  RB.use = null;
  RB.fast = null;
  RB.fastPrev = null;
  RB.fastError = '';
  RB.spoken = 0;
}

function rbEnsureSeg(unit) {
  if (RB.seg) return;
  const r = rbNorm();
  const cur = r.cur;
  let id = cur && Number(cur.unit) === r.unit && RB_SEGS.some(x => x.id === cur.seg) ? cur.seg : 'recall';
  /* 没有到期卡时不占回忆段的时间，直接进声音段。 */
  if (id === 'recall' && dueList().length === 0) {
    RB.doneSegs = ['recall'];
    RB.recallSkipped = true;
    id = 'sound';
  }
  rbBeginSeg(id, unit);
}

function rbAdvanceSeg() {
  if (RB.recallOnly) { rbFinishRecallOnly(); return; }
  const i = RB_SEGS.findIndex(x => x.id === RB.seg);
  if (i < 0 || i >= RB_SEGS.length - 1) { rbCompleteLesson(); return; }
  const unit = rbUnits()[rbNorm().unit];
  RB.doneSegs = RB_SEGS.slice(0, i + 1).map(x => x.id);
  rbBeginSeg(RB_SEGS[i + 1].id, unit);
  renderCourse();
  window.scrollTo({ top: 0 });
}

function rbAfterItem(total) {
  if (RB.timeUp) { rbAdvanceSeg(); return; }
  if (RB.idx + 1 >= total) { rbAdvanceSeg(); return; }
  RB.idx += 1;
  RB.pass = 0;
  RB.result = null;
  renderCourse();
}

function rbAdvanceLabel(normal) {
  if (RB.timeUp) return RB.recallOnly ? '时间到 · 结束回忆' : '时间到 · 进下一段';
  return normal;
}

function rbFinishRecallOnly() {
  RB.finished = { mode: 'recall' };
  RB.recallOnly = false;
  renderCourse();
  window.scrollTo({ top: 0 });
}

function rbStartRecallOnly() {
  RB.finished = null;
  RB.recallOnly = true;
  RB.recallSkipped = false;
  RB.unit = null;
  RB.seg = null;
  RB.idx = 0;
  RB.pass = 0;
  RB.result = null;
  RB.spoken = 0;
  RB.busy = false;
  RB.busyLabel = '';
  rbBeginSeg('recall', null);
  renderCourse();
  window.scrollTo({ top: 0 });
}

function rbStartNext() {
  RB.finished = null;
  RB.recallOnly = false;
  RB.recallSkipped = false;
  RB.seg = null;
  RB.unit = null;
  RB.idx = 0;
  RB.pass = 0;
  RB.result = null;
  RB.elapsed = 0;
  RB.timeUp = false;
  RB.busy = false;
  RB.busyLabel = '';
  RB.doneSegs = [];
  RB.cards = [];
  RB.items = [];
  RB.use = null;
  RB.fast = null;
  RB.fastPrev = null;
  RB.fastError = '';
  RB.spoken = 0;
  rbNorm().cur = null;
  save();
  renderCourse();
  window.scrollTo({ top: 0 });
}

function rbCompleteLesson() {
  if (RB.finished) return;
  const unit = rbUnits()[rbNorm().unit];
  if (!unit) { renderCourse(); return; }
  const secs = Math.round(RB.spoken);
  const hits = RB.use ? RB.use.n : 0;
  const wpm = RB.fast && RB.fast.m && Number.isFinite(+RB.fast.m.wpm) ? Math.round(+RB.fast.m.wpm) : null;
  rbNorm().n += 1;
  rbNorm().unit += 1;
  rbNorm().cur = null;
  rbNorm().log.push({ t: Date.now(), date: today(), unit: unit.id, secs, hits, wpm });
  for (const s of [...(unit.pattern?.sentences || []), ...(unit.pattern?.swaps || [])]) {
    if (s?.en) addChunk(s.en, s.cue_zh || '', 'Rebirth ' + unit.id);
  }
  const todaySecs = rbNorm().log
    .filter(x => x && x.date === today())
    .reduce((a, x) => a + (Number(x.secs) || 0), 0);
  RB.finished = {
    mode: 'lesson', unit, secs, hits, wpm, n: rbNorm().n,
    left: rbLeft(), toMilestone: rbToMilestone(), today: Math.round(todaySecs),
  };
  RB.spoken = 0;
  RB.unit = null;
  save();
  markDay('rb');
  renderCourse();
  window.scrollTo({ top: 0 });
}

/* ================= 计时 ================= */
function rbVisible() {
  try { return TAB === 'today' && !document.hidden && !$('#view-today').hidden; }
  catch { return false; }
}
function rbPaintTimer() {
  if (!RB.seg || RB.finished) return;
  const info = rbSegInfo(RB.seg);
  const rem = Math.max(0, info.secs - RB.elapsed);
  const clock = $('#rbClock');
  if (clock) clock.textContent = fmt(rem);
  const bar = $('#rbBar');
  if (bar) bar.style.width = Math.min(100, RB.elapsed / info.secs * 100) + '%';
  const box = $('#rbTimer');
  if (box) {
    box.classList.toggle('is-over', RB.timeUp);
    box.classList.toggle('is-busy', RB.busy);
  }
  const label = $('#rbTimerLabel');
  if (label) {
    label.textContent = RB.busy ? (RB.busyLabel || '计时暂停')
      : RB.timeUp ? '时间到 · 做完这一条就进下一段'
        : info.zh + '段 · ' + info.mins + ' 分钟';
  }
  const sb = $('.rb-stage.is-current .rb-stage-bar');
  if (sb) sb.style.width = Math.min(100, RB.elapsed / info.secs * 100) + '%';
}
setInterval(() => {
  if (!RB.seg || RB.finished || !COURSE) return;
  const now = Date.now();
  const dt = Math.min(2, Math.max(0, (now - (RB.lastTick || now)) / 1000));
  RB.lastTick = now;
  if (!rbVisible()) return;
  if (RB.busy) { rbPaintTimer(); return; }
  const info = rbSegInfo(RB.seg);
  if (RB.elapsed < info.secs) {
    RB.elapsed = Math.min(info.secs, RB.elapsed + dt);
    if (RB.elapsed >= info.secs && !RB.timeUp) { RB.timeUp = true; renderCourse(); }
  }
  rbPaintTimer();
}, 500);

/* ================= 小部件 ================= */
function rbBusy(text = RB.busyLabel || '处理中…') {
  return h('p', { class: 'notice rb-busy', text });
}
function rbGuard(fn) {
  return async blob => {
    try { await fn(blob); }
    catch (e) {
      RB.busy = false;
      RB.busyLabel = '';
      alertBox('出错了：' + (e?.message || e));
      renderCourse();
    }
  };
}
async function rbStt(blob, ref, meta) {
  RB.busy = true;
  RB.busyLabel = '识别中…';
  renderCourse();
  try {
    const j = await sttFull(blob, ref || '', { kind: 'course', line: 'daily', meta });
    RB.spoken += Number(j.duration) || 0;
    return j;
  } finally {
    RB.busy = false;
    RB.busyLabel = '';
  }
}
function rbLink(link) {
  if (!link?.url) return null;
  return h('p', { class: 'hint' }, h('span', { text: '参考：' }), h('a', { href: link.url, target: '_blank', rel: 'noopener' }, link.label || link.url));
}
/* Notes are short lines; **phrase** marks the words to look at first. */
function rbNote(text) {
  if (!text) return null;
  return h('div', { class: 'rb-note' }, String(text).split('\n').filter(x => x.trim()).map(line =>
    h('p', null, ...line.split('**').map((part, i) => (i % 2 ? h('b', { text: part }) : part)))));
}
function rbStepHead(tag, hint) {
  return h('div', { class: 'rb-step-head' }, h('span', { class: 'tag', text: tag }), hint ? h('span', { class: 'hint', text: hint }) : null);
}

/* ================= 一节课的界面 ================= */
function rbCountdownView() {
  return h('div', { class: 'rb-countdown' },
    h('div', { class: 'rb-countdown-main' },
      h('b', { class: 'rb-big', text: String(rbLeft()) }),
      h('span', { text: '节后到终点' })),
    h('div', { class: 'rb-countdown-meta' },
      h('span', { text: '离里程碑 ' + rbToMilestone() + ' 节' }),
      h('span', { class: 'mono', text: '今天开口 ' + rbTodaySecs() + ' 秒' })));
}

function rbUnitHead(unit) {
  const stage = (COURSE?.stages || []).find(s => String(s.id) === String(unit.stage));
  return h('header', { class: 'lesson-head' },
    h('div', { class: 'lesson-nav' },
      h('span', { class: 'mono', text: '第 ' + (rbNorm().n + 1) + ' 节 · ' + (unit.id || '') }),
      stage ? h('span', { class: 'tag', text: stage.name + ' · ' + stage.can }) : null),
    h('h2', { class: 'lesson-title', text: unit.title || '' }),
    unit.can ? h('p', { class: 'intro', text: unit.can }) : null);
}

function rbStagesView() {
  const cur = RB_SEGS.findIndex(x => x.id === RB.seg);
  return h('div', { class: 'rb-stages', role: 'list' }, RB_SEGS.map((s, i) => {
    const done = RB.doneSegs.includes(s.id) || (cur >= 0 && i < cur);
    const on = i === cur;
    const pct = done ? 100 : on ? Math.min(100, RB.elapsed / s.secs * 100) : 0;
    return h('div', {
      class: 'rb-stage' + (on ? ' is-current' : '') + (done ? ' is-done' : ''),
      role: 'listitem',
      title: s.zh + ' · ' + s.mins + ' 分钟',
    },
      h('i', { class: 'rb-stage-bar', style: 'width:' + pct + '%' }),
      h('b', { text: s.zh }),
      h('small', { text: s.mins + ' 分' }));
  }));
}

function rbTimerView() {
  const info = rbSegInfo(RB.seg);
  const rem = Math.max(0, info.secs - RB.elapsed);
  return h('div', { class: 'rb-timer' + (RB.timeUp ? ' is-over' : '') + (RB.busy ? ' is-busy' : ''), id: 'rbTimer' },
    h('div', { class: 'rb-timer-top' },
      h('b', { class: 'rb-clock', id: 'rbClock', text: fmt(rem) }),
      h('span', { class: 'rb-timer-label', id: 'rbTimerLabel', text: RB.busy ? (RB.busyLabel || '计时暂停') : RB.timeUp ? '时间到 · 做完这一条就进下一段' : info.zh + '段 · ' + info.mins + ' 分钟' })),
    h('div', { class: 'rb-bar' }, h('i', { id: 'rbBar', style: 'width:' + Math.min(100, RB.elapsed / info.secs * 100) + '%' })));
}

function rbStageEnd(text) {
  return h('section', { class: 'panel rb-panel' },
    h('p', { class: 'notice', text }),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => rbAdvanceSeg() }, RB.recallOnly ? '结束回忆' : '进下一段')));
}

/* ---------- 回忆 ---------- */
function rbRecallPanel() {
  if (!RB.cards.length) {
    return h('section', { class: 'panel rb-panel' },
      h('p', { class: 'notice', text: '今天没有到期的旧句子。' }),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => rbAdvanceSeg() }, RB.recallOnly ? '结束回忆' : '进下一段')));
  }
  if (RB.idx >= RB.cards.length) return rbStageEnd('旧句子都复习完了。');
  const it = RB.cards[RB.idx];
  const card = it.card;
  const r = RB.result;
  const kids = [
    rbStepHead('回忆 ' + (RB.idx + 1) + ' / ' + RB.cards.length, '看中文，把整句说出来'),
    h('p', { class: 'rb-cue', text: card.zh || '（这张卡没有中文提示）' }),
  ];
  if (r) {
    kids.push(h('p', { class: 'rb-en', text: card.en }));
    kids.push(diffView(card.en, r.text, r.words));
    kids.push(h('div', { class: 'row' },
      h('span', { class: 'tag ' + (r.grade >= 2 ? 'good' : 'lamp'), text: RB_GRADE[r.grade] }),
      h('span', { class: 'hint', text: '开口 ' + (Number.isFinite(+r.onset) ? (+r.onset).toFixed(1) + ' 秒' : '—') })));
    kids.push(h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => rbAfterItem(RB.cards.length) }, rbAdvanceLabel(RB.idx + 1 >= RB.cards.length ? (RB.recallOnly ? '结束回忆' : '进下一段') : '下一张'))));
  } else if (RB.busy) {
    kids.push(rbBusy());
  } else {
    kids.push(h('div', { class: 'row' },
      micButton('rb-recall-' + RB.idx, rbGuard(blob => rbRecallSay(blob, it.id, card)))));
  }
  return h('section', { class: 'panel rb-panel' }, ...kids);
}

async function rbRecallSay(blob, id, card) {
  const j = await rbStt(blob, card.en, { unit: rbNorm().unit, seg: 'recall', card: id });
  if (!j.text) { alertBox('没听清，再说一次。'); renderCourse(); return; }
  const a = align(card.en, j.text || '', j.words);
  const s = a.score / 100; // align 给的是百分数
  const fast = Number.isFinite(+j.onset) && +j.onset <= RB_FAST_ONSET;
  const grade = s >= 0.9 && fast ? 3 : s >= 0.75 ? 2 : s >= 0.5 ? 1 : 0;
  RB.result = { text: j.text || '', words: j.words, grade, onset: j.onset, align: a };
  if (S.srs[id]) {
    S.srs[id] = schedule(S.srs[id], grade);
    save();
    if (typeof updateBadge === 'function') updateBadge();
  }
  say(card.en);
  renderCourse();
}

/* ---------- 声音 ---------- */
function rbSoundPanel() {
  const unit = rbUnits()[rbNorm().unit];
  const sound = unit?.sound || {};
  const total = RB.items.length;
  const head = [
    h('h3', { class: 'rb-subtitle', text: sound.title || '声音' }),
    rbNote(sound.note_zh),
    rbLink(sound.link),
  ].filter(Boolean);
  if (!total) return h('section', { class: 'panel rb-panel' }, ...head, h('p', { class: 'notice', text: '这个单元没有声音练习。' }), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => rbAdvanceSeg() }, '进下一段')));
  if (RB.idx >= total) return h('section', { class: 'panel rb-panel' }, ...head, h('p', { class: 'notice', text: '声音练习做完了。' }), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => rbAdvanceSeg() }, rbAdvanceLabel('进下一段'))));
  const item = RB.items[RB.idx];
  const r = RB.result;
  const kids = [
    ...head,
    rbStepHead('声音 ' + (RB.idx + 1) + ' / ' + total, '先听重音，再自己说'),
    h('p', { class: 'rb-en', text: item.text || '' }),
    h('p', { class: 'rb-mark', text: item.mark || '' }),
  ];
  if (r) {
    if (r.text != null) kids.push(diffView(item.text || '', r.text, r.words));
    kids.push(h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: e => say(item.text || '', e.currentTarget) }, ic('speak'), '听原声'),
      h('button', { class: 'btn', onclick: () => playBlobUrl(r.url) }, ic('speak'), '听自己'),
      h('button', { class: 'btn', onclick: () => { RB.result = null; renderCourse(); } }, '再说一次'),
      h('button', { class: 'btn primary', onclick: () => rbAfterItem(total) }, rbAdvanceLabel(RB.idx + 1 >= total ? '进下一段' : '下一句'))));
  } else {
    kids.push(h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: e => say(item.text || '', e.currentTarget) }, ic('speak'), '听'),
      micButton('rb-sound-' + RB.idx, rbGuard(blob => rbSoundSay(blob, item)))));
  }
  return h('section', { class: 'panel rb-panel' }, ...kids);
}

async function rbSoundSay(blob, item) {
  /* Stress and rhythm are judged by ear, not by speech recognition: play the recording back straight away.
     Whisper is slow and unreliable on a single word, so only sentences are transcribed, and in the background. */
  const idx = RB.idx;
  if (RB.soundUrl) URL.revokeObjectURL(RB.soundUrl);
  RB.soundUrl = URL.createObjectURL(blob);
  const res = RB.result = { url: RB.soundUrl, text: null, words: null };
  renderCourse();
  playBlobUrl(res.url);
  if (!/\s/.test(String(item.text || '').trim())) return;
  sttFull(blob, item.text || '', { kind: 'course', line: 'daily', meta: { unit: rbNorm().unit, seg: 'sound', item: idx } }).then(j => {
    RB.spoken += Number(j.duration) || 0;
    if (RB.seg === 'sound' && RB.result === res && j.text) { res.text = j.text; res.words = j.words; renderCourse(); }
  }).catch(() => {});
}

/* ---------- 新句 ---------- */
function rbPatternPanel() {
  const unit = rbUnits()[rbNorm().unit];
  const p = unit?.pattern || {};
  const total = RB.items.length;
  const head = [
    h('div', { class: 'rb-pattern-head' },
      h('span', { class: 'tag lamp', text: '句型' }),
      h('p', { class: 'rb-frame', text: p.frame || '' }),
      rbNote(p.note_zh)),
  ];
  if (!total) return h('section', { class: 'panel rb-panel' }, ...head, h('p', { class: 'notice', text: '这个单元没有新句练习。' }), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => rbAdvanceSeg() }, '进下一段')));
  if (RB.idx >= total) return h('section', { class: 'panel rb-panel' }, ...head, h('p', { class: 'notice', text: '新句练完了。' }), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => rbAdvanceSeg() }, rbAdvanceLabel('进下一段'))));
  const item = RB.items[RB.idx];
  const sentence = item.kind === 'sentence';
  const r = RB.result && RB.result.pass === RB.pass ? RB.result : null;
  const kids = [
    ...head,
    rbStepHead((sentence ? '新句 ' : '换内容 ') + (RB.idx + 1) + ' / ' + total,
      sentence ? (RB.pass ? '只看要点词，再说一遍' : '先自己说，再看英文') : '换个内容说同一句型'),
    h('p', { class: 'rb-cue', text: item.cue_zh || '' }),
  ];
  if (sentence && RB.pass === 1 && !r && item.cue_en) {
    kids.push(h('p', { class: 'rb-hint-en', text: item.cue_en }));
  }
  if (r) {
    kids.push(h('p', { class: 'rb-en', text: item.en || '' }));
    kids.push(diffView(item.en || '', r.text, r.words));
    if (sentence && RB.pass === 0) {
      kids.push(h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => { RB.pass = 1; RB.result = null; renderCourse(); } }, '再说一遍（不看英文）')));
    } else {
      kids.push(h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => rbAfterItem(total) }, rbAdvanceLabel(RB.idx + 1 >= total ? '进下一段' : '下一句'))));
    }
  } else if (RB.busy) {
    kids.push(rbBusy());
  } else {
    kids.push(h('div', { class: 'row' },
      micButton('rb-pattern-' + RB.idx + '-' + RB.pass, rbGuard(blob => rbPatternSay(blob, item)))));
  }
  return h('section', { class: 'panel rb-panel' }, ...kids);
}

async function rbPatternSay(blob, item) {
  const j = await rbStt(blob, item.en || '', { unit: rbNorm().unit, seg: 'pattern', item: RB.idx, pass: RB.pass });
  if (!j.text) { alertBox('没听清，再说一次。'); renderCourse(); return; }
  RB.result = { pass: RB.pass, text: j.text || '', words: j.words };
  if (item.kind === 'sentence' && RB.pass === 0) say(item.en || '');
  renderCourse();
}

/* ---------- 用 ---------- */
function rbUsePrompt(unit) {
  const t = unit?.task || {};
  const p = unit?.pattern || {};
  const examples = [...(p.sentences || []), ...(p.swaps || [])].map(x => x.en).filter(Boolean);
  return [
    'You are playing a role in a short spoken role-play with an adult Chinese learner of English (speaking level about A2).',
    'Your role: ' + (t.role || ''),
    "The learner's goal: " + (t.goal_zh || ''),
    'Target pattern the learner is practising today: "' + (p.frame || '') + '"',
    'Example sentences the learner has already drilled (repeating one of these does NOT count as new):',
    examples.join('\n'),
    '',
    'Rules for your reply:',
    '- Stay in role. One or two short sentences, everyday words only. End with a question or a prompt that keeps the learner talking.',
    '- Create natural chances to use the target pattern, but never say the pattern for them and never correct them inside your reply.',
    "- The learner's text comes from speech recognition: ignore punctuation, capitalisation and obvious recognition noise.",
    '',
    'After each learner turn, return JSON only:',
    '{',
    '  "reply": "your next line in role",',
    '  "used": true or false,   // true if this turn contains a sentence built on the target pattern whose wording is not identical to an example sentence. A different object or detail is enough ("I\'d like a large latte" counts when the example is "I\'d like a coffee"). Only a word-for-word repeat of an example is false.',
    '  "slip": null or { "said": "the learner\'s faulty sentence", "hint_zh": "用中文提示哪里不对，不给出正确说法，不超过 25 个字", "fix": "the corrected sentence" },',
    '  "done": true or false    // true when the learner\'s goal has been reached',
    '}',
    'Report at most one slip per turn. A slip is either (a) a mistake that would confuse a listener, or (b) the learner saying something the target pattern is made for but in another, cruder way (for example "I want muffin" when the pattern is "I\'d like ..., please."): then hint_zh nudges them to use today\'s pattern and fix is their sentence rebuilt on the pattern. Small article or plural mistakes that recognition may have caused are not slips. When "used" is true and nothing would confuse a listener, slip is null.',
  ].join('\n');
}

/* Whether a turn used today's pattern is checked here, not left to the model: with thinking off it under-reports
   (it returned false for "I'd like a large latte, please."). The fixed parts of the frame must appear in order, and the
   turn must not be a word-for-word repeat of a drilled sentence. The model's own "used: true" still counts, for variants
   such as "I would like". */
const rbNormEn = s => String(s || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
function rbFrameUsed(said, unit) {
  const p = unit?.pattern || {};
  const text = ' ' + rbNormEn(said) + ' ';
  const parts = String(p.frame || '').split('...').map(rbNormEn).filter(x => x && x !== 'please');
  if (!parts.length) return false;
  let at = 0;
  for (const part of parts) {
    const i = text.indexOf(' ' + part + ' ', at);
    if (i < 0) return false;
    at = i + part.length + 1;
  }
  const drilled = [...(p.sentences || []), ...(p.swaps || [])].map(x => rbNormEn(x.en));
  return !drilled.includes(rbNormEn(said));
}

function rbUseMessages(unit) {
  return [
    { role: 'system', content: rbUsePrompt(unit) },
    /* Earlier assistant turns go back as JSON too: shown as plain text, the model copies that and stops returning JSON. */
    ...(RB.use?.history || []).map(m => ({ role: m.role, content: m.role === 'assistant' ? JSON.stringify({ reply: m.text }) : m.text })),
  ];
}

function rbInitUse(unit) {
  const opener = unit?.task?.opener || '';
  RB.use = {
    history: opener ? [{ role: 'assistant', text: opener }] : [],
    n: 0, done: false, slip: null, turn: 0, error: '',
  };
  if (opener) setTimeout(() => say(opener), 250);
}

function rbDialogView() {
  const rows = RB.use?.history || [];
  return h('div', { class: 'rb-dialog' }, rows.map(m => h('div', { class: 'rb-turn ' + (m.role === 'assistant' ? 'ai' : 'me') },
    h('span', { class: 'rb-who', text: m.role === 'assistant' ? 'AI' : '你' }),
    h('p', { text: m.text }),
    m.role === 'assistant' ? sayBtn(m.text, '再听一遍') : null)));
}

function rbSlipView(unit) {
  const s = RB.use.slip;
  const kids = [
    h('div', { class: 'notice rb-slip' },
      h('p', { class: 'hint warn', text: '提示：' + (s.hint_zh || '这句话再顺一下') }),
      h('p', { class: 'hint', text: '先用正确说法再说一遍（第 ' + (s.tries + 1) + ' / 2 次）。' })),
  ];
  if (s.heard) kids.push(h('p', { class: 'hint', text: '这次识别到：' + s.heard }));
  if (RB.busy) kids.push(rbBusy('识别中…'));
  else kids.push(h('div', { class: 'row' },
    micButton('rb-use-retry', rbGuard(blob => rbUseRetry(blob, unit)), ['再说一遍', '停'])));
  return h('div', { class: 'rb-slip-wrap' }, ...kids);
}

function rbUsePanel() {
  const unit = rbUnits()[rbNorm().unit];
  const t = unit?.task || {};
  const u = RB.use || (RB.use = { history: [], n: 0, done: false, slip: null, turn: 0, error: '' });
  const kids = [
    h('div', { class: 'notice rb-scene' },
      h('b', { text: '场景' }),
      h('p', { text: t.scene_zh || '' }),
      h('p', { class: 'hint', text: '目标：' + (t.goal_zh || '') })),
    h('div', { class: 'rb-step-head' },
      h('span', { class: 'tag ' + (u.n >= 2 ? 'good' : 'lamp'), text: '用上今天的句型：' + u.n + ' / 2' }),
      u.done ? h('span', { class: 'tag good', text: '目标达成' }) : null),
    rbDialogView(),
  ];
  if (u.slip && u.slip.resolved) {
    kids.push(h('div', { class: 'notice rb-fix' },
      h('p', { class: 'hint', text: '更自然的说法' }),
      h('p', { class: 'rb-en', text: u.slip.fix }),
      h('p', { class: 'hint', text: '已记入语块本 · ' + (u.slip.hint_zh || '') })));
  }
  if (u.slip && !u.slip.resolved) {
    kids.push(rbSlipView(unit));
  } else if (RB.busy) {
    kids.push(rbBusy());
  } else {
    kids.push(h('div', { class: 'row' },
      micButton('rb-use', rbGuard(blob => rbUseSay(blob, unit))),
      u.n >= 2 ? h('button', { class: 'btn primary', onclick: () => rbAdvanceSeg() }, '进下一段') : null));
  }
  if (u.n < 2 && RB.timeUp) {
    kids.push(h('p', { class: 'hint warn', text: '时间到，但还要再用上今天的句型（' + u.n + ' / 2）。' }));
  }
  if (u.error) kids.push(h('p', { class: 'err', text: u.error }));
  return h('section', { class: 'panel rb-panel' }, ...kids);
}

async function rbUseSay(blob, unit) {
  const u = RB.use;
  const j = await rbStt(blob, '', { unit: rbNorm().unit, seg: 'use', turn: u.turn });
  const said = (j.text || '').trim();
  if (!said) {
    alertBox('没听到说话，再说一次。');
    renderCourse();
    return;
  }
  u.history.push({ role: 'user', text: said });
  u.turn += 1;
  u.error = '';
  RB.busy = true;
  RB.busyLabel = 'AI 正在回话…';
  renderCourse();
  let out;
  try {
    const ask = () => aiText('', { messages: rbUseMessages(unit), json: true, temperature: 0.7, think: false });
    try { out = await ask(); } catch { out = await ask(); } // one retry: a malformed reply is usually a one-off
  } catch (e) {
    u.history.pop();
    u.turn -= 1;
    RB.busy = false;
    RB.busyLabel = '';
    u.error = 'AI 没有回话：' + (e?.message || e);
    renderCourse();
    return;
  }
  RB.busy = false;
  RB.busyLabel = '';
  if (!out || !out.reply) {
    u.history.pop();
    u.turn -= 1;
    u.error = 'AI 的回话读不出来，再说一次。';
    renderCourse();
    return;
  }
  const reply = String(out.reply).trim();
  u.history.push({ role: 'assistant', text: reply });
  if (out.used === true || rbFrameUsed(said, unit)) u.n += 1;
  if (out.done === true) u.done = true;
  if (out.slip && out.slip.fix) {
    u.slip = {
      said: String(out.slip.said || said),
      hint_zh: String(out.slip.hint_zh || ''),
      fix: String(out.slip.fix),
      tries: 0, resolved: false, heard: '', heardWords: null,
    };
  } else {
    u.slip = null;
  }
  say(reply);
  renderCourse();
}

async function rbUseRetry(blob, unit) {
  const s = RB.use?.slip;
  if (!s || s.resolved || !s.fix) return;
  const j = await rbStt(blob, s.fix, { unit: rbNorm().unit, seg: 'use', retry: true });
  const a = align(s.fix, j.text || '', j.words);
  s.tries += 1;
  s.heard = j.text || '';
  s.heardWords = j.words;
  s.score = a.score;
  s.ok = a.score / 100 >= 0.8;
  if (s.ok || s.tries >= 2) {
    s.resolved = true;
    addChunk(s.fix, s.hint_zh, 'Rebirth 纠错');
    if (s.ok) say(s.fix);
  }
  renderCourse();
}

/* ---------- 快 ---------- */
function rbPrevFast() {
  const cur = rbNorm().unit;
  const list = (typeof RECS !== 'undefined' ? RECS.list : []) || [];
  const rows = list.filter(r => r.kind === 'course' && r.meta?.seg === 'fast' &&
    Number.isFinite(+r.meta?.unit) && +r.meta.unit < cur && r.metrics);
  rows.sort((a, b) => (+b.meta.unit - +a.meta.unit) || (b.t - a.t));
  return rows[0] || null;
}

function rbInitFast(unit) {
  RB.fast = null;
  RB.fastPrev = null;
  RB.fastError = '';
  RB.fastOwner = 'rbfast-' + rbNorm().unit;
  if (typeof loadRecs === 'function') {
    loadRecs().then(() => {
      if (RB.seg === 'fast' && !RB.finished) {
        RB.fastPrev = rbPrevFast();
        renderCourse();
      }
    }).catch(() => {});
  }
}

async function rbStartFast() {
  RB.fast = null;
  RB.fastError = '';
  const blob = await timedRec(RB.fastOwner, 60, renderCourse);
  if (!blob) {
    RB.fastError = '没录到声音，再来一次。';
    renderCourse();
    return;
  }
  RB.busy = true;
  RB.busyLabel = '识别中…';
  renderCourse();
  try {
    const j = await sttFull(blob, '', { kind: 'course', line: 'daily', meta: { unit: rbNorm().unit, seg: 'fast' } });
    RB.spoken += Number(j.duration) || 0;
    RB.fast = { text: j.text || '', words: j.words, m: j.metrics || {} };
  } catch (e) {
    RB.fastError = '识别失败：' + (e?.message || e);
  } finally {
    RB.busy = false;
    RB.busyLabel = '';
    renderCourse();
  }
}

function rbFastPanel() {
  const unit = rbUnits()[rbNorm().unit];
  const owner = RB.fastOwner || ('rbfast-' + rbNorm().unit);
  const recOn = typeof TMR !== 'undefined' && TMR.owner === owner;
  const kids = [
    h('p', { class: 'rb-cue', text: '把刚才那段对话里你做了什么，60 秒讲一遍，不停。' }),
    h('p', { class: 'hint', text: '说完自动停；录音只在本机转写，不传给 AI。' }),
  ];
  if (recOn) {
    kids.push(timerView(owner, 60));
    kids.push(h('div', { class: 'row' },
      h('button', { class: 'btn rec', onclick: () => Rec.stop() }, ic('stop'), '停')));
  } else if (RB.fast) {
    const f = RB.fast;
    const prev = RB.fastPrev;
    const prevWpm = prev?.metrics?.wpm ?? rbLastLogWpm();
    kids.push(h('p', { class: 'rb-en', text: f.text || '（没识别到内容）' }));
    kids.push(metricsView(f.m, prev?.metrics || null));
    kids.push(h('p', { class: 'hint', text: prev ? '上一节这一段：' + rbMetricsLine(prev.metrics) : (prevWpm != null ? '上一节这一段：语速 ' + Math.round(prevWpm) + ' 词/分' : '这是第一节，下一节就有对比了。') }));
    kids.push(h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => rbCompleteLesson() }, '完成本节'),
      h('button', { class: 'btn', onclick: () => { RB.fast = null; RB.fastError = ''; renderCourse(); } }, '再录一次')));
  } else if (RB.busy) {
    kids.push(rbBusy());
  } else {
    if (RB.fastError) kids.push(h('p', { class: 'err', text: RB.fastError }));
    kids.push(h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => rbStartFast(unit) }, ic('mic'), '开始 60 秒')));
  }
  return h('section', { class: 'panel rb-panel' }, ...kids);
}

/* ================= 收尾 ================= */
function rbFinishCard() {
  const f = RB.finished;
  if (!f) return null;
  if (f.mode === 'recall') {
    return h('div', { class: 'result rb-finish' },
      h('h3', { text: '回忆做完了' }),
      h('p', { class: 'hint', text: '只做回忆不减倒计时。' }),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => rbStartNext() }, '回到今天')));
  }
  const more = rbNorm().unit < rbUnits().length;
  return h('div', { class: 'result rb-finish' },
    h('h3', { text: '第 ' + f.n + ' 节完成' }),
    h('div', { class: 'rb-finish-main' },
      h('b', { class: 'rb-big', text: String(f.left) }),
      h('span', { text: '节后到终点' })),
    h('p', { class: 'hint', text: '离下一个里程碑还有 ' + f.toMilestone + ' 节。' }),
    h('p', { class: 'hint', text: '今天开口 ' + f.today + ' 秒。' }),
    more ? null : h('p', { class: 'hint', text: '新单元还在做。今天可以回到今天页只做回忆。' }),
    h('div', { class: 'row' },
      more ? h('button', { class: 'btn primary', onclick: () => rbStartNext() }, '再上一节')
        : h('button', { class: 'btn primary', onclick: () => rbStartNext() }, '回到今天'),
      h('button', { class: 'btn', onclick: () => setTab('chunks') }, '去语块本看看')));
}

/* ================= 主渲染 ================= */
function rbPanel(unit) {
  if (RB.seg === 'recall') return rbRecallPanel();
  if (RB.seg === 'sound') return rbSoundPanel();
  if (RB.seg === 'pattern') return rbPatternPanel();
  if (RB.seg === 'use') return rbUsePanel();
  if (RB.seg === 'fast') return rbFastPanel();
  return h('section', { class: 'panel rb-panel' }, h('p', { class: 'notice', text: '这一段还没有内容。' }));
}

function renderCourse() {
  const root = $('#view-today');
  if (!root || root.hidden) return;
  rbNorm();
  const frag = [];
  const gc = guideCard();
  if (gc) frag.push(gc);
  if (!COURSE) {
    frag.push(h('p', { class: 'err', text: '课程数据没有载入：' + (COURSE_ERROR || '检查 static/course.json') }));
    root.replaceChildren(...frag);
    return;
  }
  if (RB.finished) {
    frag.push(rbFinishCard());
    const y = window.scrollY;
    root.replaceChildren(...frag);
    window.scrollTo(0, y);
    return;
  }
  const units = rbUnits();
  if (RB.recallOnly) {
    frag.push(h('header', { class: 'lesson-head' },
      h('h2', { class: 'lesson-title', text: '只做回忆' }),
      h('p', { class: 'intro', text: '复习到期旧句，不减倒计时。' })));
    frag.push(rbCountdownView(), rbStagesView(), rbTimerView(), rbRecallPanel());
    const y = window.scrollY;
    root.replaceChildren(...frag);
    window.scrollTo(0, y);
    return;
  }
  if (rbNorm().unit >= units.length) {
    frag.push(h('header', { class: 'lesson-head' },
      h('h2', { class: 'lesson-title', text: '新单元还在做' }),
      h('p', { class: 'intro', text: '课的下一单元还没有准备好。今天可以只复习到期旧句；只做回忆不减倒计时。' })));
    frag.push(rbCountdownView());
    frag.push(h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => rbStartRecallOnly() }, '只做回忆段')));
    const y = window.scrollY;
    root.replaceChildren(...frag);
    window.scrollTo(0, y);
    return;
  }
  if (RB.unit !== rbNorm().unit) rbResetForUnit(rbNorm().unit);
  const unit = units[rbNorm().unit];
  /* The clock only starts when the learner says so: opening the app must not start a lesson. */
  if (!RB.started) {
    const cur = rbNorm().cur;
    const resume = cur && Number(cur.unit) === rbNorm().unit && cur.seg !== 'recall' ? rbSegInfo(cur.seg) : null;
    frag.push(rbUnitHead(unit), rbCountdownView(), rbStagesView());
    frag.push(h('section', { class: 'panel rb-panel' },
      h('p', { class: 'hint', text: '一节 25 分钟，五段：回忆旧句、一个发音点、新句型、和 AI 无稿完成任务、限时重讲。等识别和等 AI 回话的时间不计。' }),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => { RB.started = true; renderCourse(); } }, resume ? '接着上（从「' + resume.zh + '」段）' : '开始第 ' + (rbNorm().n + 1) + ' 节'))));
    const y0 = window.scrollY;
    root.replaceChildren(...frag);
    window.scrollTo(0, y0);
    return;
  }
  rbEnsureSeg(unit);
  frag.push(rbUnitHead(unit));
  frag.push(rbCountdownView());
  frag.push(rbStagesView());
  frag.push(rbTimerView());
  if (RB.recallSkipped && RB.seg === 'sound') frag.push(h('p', { class: 'notice', text: '今天没有到期的旧句子。' }));
  frag.push(rbPanel(unit));
  const y = window.scrollY;
  root.replaceChildren(...frag);
  window.scrollTo(0, y);
}
