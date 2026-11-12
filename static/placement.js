'use strict';
/* 回声 · Rebirth 定位测试
   载入 static/placement.json，看中文提示立刻说英文，找出「张口就来」断在哪一级。
   题库只有 6 级、每级 6 题时按规格走；代码按 json 里实际的级数和题数算，不写死 6。
   进度只放在内存 PL 里，不刷新保留；结果写进 S.rb.place。 */

let PLACEMENT = null;
let PLACEMENT_ERROR = '';
const PLACEMENT_READY = (async () => {
  try {
    const res = await fetch('placement.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('读不到定位题库 placement.json（' + res.status + '）');
    const data = await res.json();
    if (!data || !Array.isArray(data.levels) || !data.levels.length) throw new Error('placement.json 里没有 levels 数组');
    for (const lv of data.levels) {
      if (!lv || !Array.isArray(lv.items) || !lv.items.length) throw new Error('placement.json 里有一级没有题目');
    }
    PLACEMENT = data;
    return data;
  } catch (e) {
    PLACEMENT = null;
    PLACEMENT_ERROR = e.message || String(e);
    return null;
  }
})();

/* ================= 进行状态（只在内存里） ================= */
const PL = {
  on: false, root: null, run: 0,
  levels: [], cur: 0, i: 0,
  phase: 'ask', owner: '', error: '', waits: [], result: null,
};

const plCurrent = () => PL.levels[PL.cur] || null;
const plTotalLevels = () => PL.levels.length;
/* 一级要答对多少题才晋级：规格的 4/6 换成「题数的三分之二向上取整」，2 题时就是 2 题。 */
const plThreshold = n => Math.ceil(n * 2 / 3);
function plMedian(xs) {
  const a = (xs || []).filter(x => x != null && Number.isFinite(+x)).map(Number).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
const plOnset = v => (v == null || !Number.isFinite(+v) ? '—' : (+v).toFixed(1) + ' 秒');

/* ================= 开始 / 结束 ================= */
function startPlacement() {
  PL.run += 1;
  PL.on = true;
  PL.root = (typeof $ === 'function' ? $('#view-today') : null) || PL.root;
  PL.cur = 0;
  PL.i = 0;
  PL.phase = 'ask';
  PL.shownAt = Date.now(); // reaction time runs from the moment the cue appears, not from the click
  PL.owner = '';
  PL.error = '';
  PL.waits = [];
  PL.result = null;
  PL.levels = (PLACEMENT?.levels || []).map((lv, k) => ({
    id: Number.isFinite(+lv?.id) ? +lv.id : k + 1,
    name: String(lv?.name || ('第 ' + (k + 1) + ' 级')),
    can: String(lv?.can || ''),
    items: (Array.isArray(lv?.items) ? lv.items : []).map(it => ({
      cue_zh: String(it?.cue_zh ?? ''),
      en: String(it?.en ?? ''),
      ok: null, onset: null, text: '', note: '', pending: false,
    })),
    waits: [],
  }));
  if (!PLACEMENT) PL.error = PLACEMENT_ERROR || '定位题库没有载入';
  plPaint();
  try { window.scrollTo({ top: 0 }); } catch {}
}

/* 测试中途切到别的页签：进度不保留。刷新或关页本来就会清空内存。 */
function plAbort() {
  PL.run += 1;
  PL.on = false;
  PL.owner = '';
  PL.phase = 'ask';
  PL.error = '';
  PL.result = null;
  PL.levels = [];
  PL.waits = [];
  try { if (typeof Rec !== 'undefined') Rec.stop(); } catch {}
}
try {
  const view = typeof document !== 'undefined' && document.getElementById ? document.getElementById('view-today') : null;
  if (view && typeof MutationObserver === 'function') {
    new MutationObserver(() => { if (PL.on && PL.phase !== 'result' && view.hidden) plAbort(); })
      .observe(view, { attributes: true, attributeFilter: ['hidden'] });
  }
} catch {}

function plHome() {
  PL.on = false;
  PL.owner = '';
  PL.phase = 'ask';
  PL.result = null;
  PL.root = null;
  if (typeof renderCourse === 'function') renderCourse();
  try { window.scrollTo({ top: 0 }); } catch {}
}

function plPaint() {
  const root = PL.root || (typeof $ === 'function' ? $('#view-today') : null);
  if (root) renderPlacement(root);
}

/* ================= 一题 ================= */
async function plSay() {
  if (!PL.on || PL.phase !== 'ask') return;
  const lv = plCurrent(), item = lv?.items[PL.i];
  if (!lv || !item) return;
  const run = PL.run;
  const wait = PL.shownAt ? (Date.now() - PL.shownAt) / 1000 : 0; // time spent before pressing 说
  const owner = 'rbpl-' + run + '-' + PL.cur + '-' + PL.i;
  if (typeof Rec.isOn === 'function' && Rec.isOn(owner)) { Rec.stop(); return; }
  PL.phase = 'starting';
  PL.error = '';
  plPaint();
  try {
    await Rec.start(owner);
  } catch (e) {
    PL.phase = 'ask';
    plPaint();
    alertBox(e?.message || String(e));
    return;
  }
  if (run !== PL.run || !PL.on) { try { Rec.stop(); } catch {} return; }
  PL.phase = 'recording';
  PL.owner = owner;
  plPaint();
  Rec.autoStop(12, 1.5);
  let blob = null;
  try { blob = await Rec.done; }
  catch (e) {
    if (run === PL.run) {
      PL.phase = 'ask';
      PL.owner = '';
      plPaint();
      alertBox('没录到声音：' + (e?.message || e));
    }
    return;
  }
  if (run !== PL.run || !PL.on) return;
  PL.phase = 'ask';
  PL.owner = '';
  const idx = PL.i + 1;
  if (blob && blob.size >= 800) {
    item.pending = true;
    /* 识别放在后台：这一题已经翻过去了，不显示对错、不等识别。 */
    const p = sttFull(blob, item.en, { kind: 'course', line: 'daily', meta: { seg: 'place', level: lv.id, i: idx } })
      .then(j => {
        item.text = String(j?.text || '');
        item.onset = (j?.onset != null && Number.isFinite(+j.onset)) ? Math.round((wait + +j.onset) * 10) / 10 : null;
      })
      .catch(() => {
        item.text = '';
        item.onset = null;
      })
      .finally(() => { item.pending = false; });
    lv.waits.push(p);
  } else {
    /* 录到了但几乎没有声音：当作空回答交给判分，和「说不出」一样记 0。 */
    item.text = '';
    item.onset = null;
  }
  await plNext(run);
}

async function plCantSay() {
  if (!PL.on || PL.phase !== 'ask') return;
  const lv = plCurrent(), item = lv?.items[PL.i];
  if (!lv || !item) return;
  item.ok = 0;
  item.onset = null;
  item.text = '';
  item.note = '';
  await plNext(PL.run);
}

async function plNext(run) {
  if (run !== PL.run) return;
  const lv = plCurrent();
  if (!lv) return;
  PL.i += 1;
  if (PL.i < lv.items.length) {
    PL.phase = 'ask';
    PL.shownAt = Date.now(); // reaction time runs from the moment the cue appears, not from the click
    plPaint();
    return;
  }
  PL.phase = 'grading';
  PL.error = '';
  plPaint();
  await plGrade(run);
}

/* ================= 判分 ================= */
const PL_PROMPT_HEAD = `You are grading a spoken placement test for an adult Chinese learner of English.
For each item you get: the Chinese cue the learner saw, one reference answer (only one of many acceptable answers), and the speech-recognition transcript of what the learner said (may be empty).

Judge meaning and form, not wording. Any natural way of saying it is as good as the reference.
ok = 2: conveys the meaning of the cue in grammatical, natural-enough spoken English. Ignore punctuation, capitalisation, fillers, a self-correction, and tiny slips that speech recognition could have caused (a missing article, a plural -s).
ok = 1: a listener would get the meaning, but there is a clear error in grammar or word choice (wrong tense, wrong word order, a missing verb, a Chinese-style construction).
ok = 0: empty, unfinished, the meaning is wrong or a listener would not understand.

Items:`;

function plPrompt(lv, list) {
  const lines = list.map(({ it, i }) => (i + 1) + '. cue: ' + it.cue_zh + ' | reference: ' + it.en + ' | said: ' + (it.text || ''));
  return PL_PROMPT_HEAD + '\n' + lines.join('\n') + '\n\nReturn JSON only: {"items": [{"i": 1, "ok": 0|1|2, "note_zh": "ok 小于 2 时用中文说问题在哪，不超过 20 个字；ok 为 2 时留空字符串"}]}';
}

async function plGrade(run) {
  const lv = plCurrent();
  if (!lv || run !== PL.run) return;
  PL.phase = 'grading';
  PL.error = '';
  plPaint();
  try {
    await Promise.all(lv.waits);
    if (run !== PL.run) return;
    const toGrade = lv.items.map((it, i) => ({ it, i })).filter(({ it }) => it.ok == null);
    if (toGrade.length) {
      const j = await aiText(plPrompt(lv, toGrade), { think: false });
      if (run !== PL.run) return;
      const got = new Map((Array.isArray(j?.items) ? j.items : []).map(x => [+x.i, x]));
      for (const { it, i } of toGrade) {
        const x = got.get(i + 1);
        if (!x || ![0, 1, 2].includes(+x.ok)) throw new Error('AI 判分结果不完整，重试判分。');
        it.ok = +x.ok;
        it.note = it.ok === 2 ? '' : String(x.note_zh || '');
      }
    }
    lv.waits = [];
    const row = plScoreLevel(lv);
    const last = PL.cur >= PL.levels.length - 1;
    if (row.fluent >= plThreshold(lv.items.length) && !last) {
      PL.cur += 1;
      PL.i = 0;
      PL.phase = 'ask';
      PL.shownAt = Date.now(); // reaction time runs from the moment the cue appears, not from the click
      PL.error = '';
      PL.waits = [];
      plPaint();
      try { window.scrollTo({ top: 0 }); } catch {}
      return;
    }
    plFinish();
  } catch (e) {
    if (run !== PL.run) return;
    PL.phase = 'gradeError';
    PL.error = e?.message || String(e);
    plPaint();
  }
}

async function plRetry() {
  if (!PL.on || PL.phase !== 'gradeError') return;
  await plGrade(PL.run);
}

function plScoreLevel(lv) {
  const items = lv.items.map(it => ({
    ok: it.ok == null ? 0 : +it.ok,
    onset: (it.onset != null && Number.isFinite(+it.onset)) ? +it.onset : null,
    text: String(it.text || ''),
    note: String(it.note || ''),
  }));
  const said = items.filter(x => x.ok >= 1).length;
  const fluent = items.filter(x => x.ok === 2 && x.onset != null && x.onset <= 5).length;
  const onset = plMedian(items.map(x => x.onset));
  return {
    id: lv.id,
    said,
    fluent,
    onset: onset == null ? null : Math.round(onset * 10) / 10,
    items,
  };
}

function plFinish() {
  const done = PL.levels.slice(0, PL.cur + 1);
  const levels = done.map(plScoreLevel);
  let start = PL.levels.length + 1;
  for (let k = 0; k < levels.length; k++) {
    if (levels[k].fluent < plThreshold(done[k].items.length)) { start = done[k].id; break; }
  }
  PL.result = {
    start,
    levels,
    meta: done.map(lv => ({ id: lv.id, name: lv.name, can: lv.can, total: lv.items.length })),
  };
  PL.phase = 'result';
  if (!S.rb || typeof S.rb !== 'object') S.rb = { n: 0, unit: 0, log: [], cur: null };
  S.rb.place = { t: Date.now(), date: today(), start, levels };
  save();
  plPaint();
  try { window.scrollTo({ top: 0 }); } catch {}
}

function plConclusion() {
  if (!PL.result) return '';
  const n = PL.levels.length;
  if (PL.result.start > n) return n === 6 ? '六级都张口就来，从成段表达学起。' : '全部 ' + n + ' 级都张口就来，从成段表达学起。';
  if (PL.result.start <= 1) return '张口就来还没稳在第 1 级，从第 1 级的内容学起。';
  return '张口就来稳在第 ' + (PL.result.start - 1) + ' 级，从第 ' + PL.result.start + ' 级的内容学起。';
}

/* ================= 界面 ================= */
function plTop(lv) {
  return h('div', { class: 'rbpl-top' },
    h('span', { class: 'tag lamp', text: '定位测试' }),
    h('span', { class: 'hint', text: '· 第 ' + (PL.cur + 1) + ' 级 / ' + plTotalLevels() + ' · 第 ' + Math.min(PL.i + 1, lv.items.length) + ' 题 / ' + lv.items.length }));
}

function plPanel(root) {
  const lv = plCurrent();
  if (!lv) return h('section', { class: 'panel rb-panel rbpl-panel' }, h('p', { class: 'err', text: PL.error || '定位题库没有载入' }), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => plHome() }, '回到今天')));

  if (PL.phase === 'grading' || PL.phase === 'gradeError') {
    const kids = [
      plTop(lv),
      PL.phase === 'grading'
        ? h('p', { class: 'notice rbpl-wait', text: '判分中…' })
        : h('p', { class: 'err', text: '判分没有完成：' + PL.error }),
      PL.phase === 'grading'
        ? h('p', { class: 'hint', text: '等这一级录的音全部识别完，再一起判。' })
        : h('p', { class: 'hint', text: '已经录的内容还在，可以重试。' }),
    ];
    if (PL.phase === 'gradeError') kids.push(h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => plRetry() }, '重试判分')));
    return h('section', { class: 'panel rb-panel rbpl-panel' }, ...kids);
  }

  const item = lv.items[Math.min(PL.i, lv.items.length - 1)];
  const kids = [
    plTop(lv),
    h('p', { class: 'hint', text: '看到中文就开口，说完自动停。说不出就点「说不出」。' }),
    h('p', { class: 'rbpl-cue', text: item?.cue_zh || '' }),
  ];
  if (PL.phase === 'starting') {
    kids.push(h('p', { class: 'notice rbpl-wait', text: '正在打开麦克风…' }));
  } else if (PL.phase === 'recording') {
    kids.push(h('p', { class: 'notice rbpl-wait', text: '录音中… 说完自动停（最长 12 秒）。' }));
    kids.push(h('div', { class: 'row' }, h('button', { class: 'btn rec', onclick: () => { try { Rec.stop(); } catch {} } }, ic('stop'), '停')));
  } else if (PL.phase === 'error') {
    kids.push(h('p', { class: 'err', text: PL.error }));
    kids.push(h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => plHome() }, '回到今天')));
  } else {
    kids.push(h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => plSay() }, ic('mic'), '说'),
      h('button', { class: 'btn', onclick: () => plCantSay() }, '说不出')));
  }
  return h('section', { class: 'panel rb-panel rbpl-panel' }, ...kids);
}

function plLevelDetail(row, meta, lv) {
  const kids = [
    h('div', { class: 'rbpl-level-head' },
      h('h3', { class: 'rbpl-level-title', text: meta.name + ' · 第 ' + row.id + ' 级' }),
      meta.can ? h('p', { class: 'hint', text: meta.can }) : null,
      h('p', { class: 'rbpl-level-stats mono', text: '说得出 ' + row.said + '/' + meta.total + ' · 张口就来 ' + row.fluent + '/' + meta.total + ' · 反应时间中位数 ' + plOnset(row.onset) })),
  ];
  row.items.forEach((x, j) => {
    const src = '定位测试 ' + meta.name;
    kids.push(h('div', { class: 'rbpl-item' },
      h('div', { class: 'rbpl-item-head' },
        h('span', { class: 'tag ' + (x.ok >= 2 ? 'good' : x.ok >= 1 ? 'lamp' : ''), text: x.ok >= 2 ? '说对了' : x.ok >= 1 ? '意思到了，有错' : '没说出' }),
        h('span', { class: 'hint', text: '第 ' + (j + 1) + ' 题' })),
      h('p', { class: 'rbpl-item-cue', text: lv.items[j]?.cue_zh || '' }),
      h('p', { class: 'rbpl-item-said' },
        h('span', { class: 'rbpl-label', text: '你说的' }),
        x.text ? wordify(x.text, { mine: true, src }) : h('span', { class: 'hint', text: '（没听到 / 说不出）' })),
      h('p', { class: 'rbpl-item-ref' },
        h('span', { class: 'rbpl-label', text: '参考答案' }),
        wordify(lv.items[j]?.en || '', { src })),
      x.note ? h('p', { class: 'rbpl-note-line', text: x.note }) : null));
  });
  return h('section', { class: 'panel rbpl-level' }, ...kids);
}

function plResultView() {
  const res = PL.result;
  return h('div', { class: 'rbpl-result' },
    h('header', { class: 'lesson-head' },
      h('h2', { class: 'lesson-title', text: '定位测试结果' }),
      h('p', { class: 'intro', text: '只测了「看中文，立刻说英文」这一件事。测试不减倒计时。' })),
    h('p', { class: 'rbpl-conclusion', text: plConclusion() }),
    h('div', { class: 'rbpl-table-wrap' },
      h('table', { class: 'rbpl-table' },
        h('thead', null, h('tr', null,
          h('th', { text: '级别' }),
          h('th', { text: '这一级考什么' }),
          h('th', { text: '说得出' }),
          h('th', { text: '张口就来' }),
          h('th', { text: '反应时间中位数' }))),
        h('tbody', null, res.levels.map((row, k) => {
          const meta = res.meta[k];
          return h('tr', null,
            h('td', null, h('b', { text: meta.name }), h('span', { class: 'rbpl-level-id', text: '第 ' + row.id + ' 级' })),
            h('td', { text: meta.can }),
            h('td', { class: 'rbpl-num', text: row.said + '/' + meta.total }),
            h('td', { class: 'rbpl-num', text: row.fluent + '/' + meta.total }),
            h('td', { class: 'rbpl-num', text: plOnset(row.onset) }));
        })))),
    h('div', { class: 'rbpl-levels' }, res.levels.map((row, k) => plLevelDetail(row, res.meta[k], PL.levels[k]))),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => plHome() }, '回到今天')));
}

function renderPlacement(root) {
  if (!root || !PL.on) return;
  PL.root = root;
  if (PL.phase === 'result' && PL.result) {
    root.replaceChildren(plResultView());
    return;
  }
  if (!PLACEMENT) {
    root.replaceChildren(h('section', { class: 'panel rb-panel rbpl-panel' },
      h('p', { class: 'err', text: '定位题库没有载入：' + (PLACEMENT_ERROR || '检查 static/placement.json') }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => plHome() }, '回到今天'))));
    return;
  }
  root.replaceChildren(plPanel(root));
}
