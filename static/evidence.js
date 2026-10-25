/* ================= progress evidence: weekly summary, milestones, chunks used in free speech =================
   Everything here is counted from saved recordings and the progress file. No scores, no estimates. */
const FREE_KINDS = ['talk', 'solo', 'r432', 'baseline', 'chat']; // speaking without a script
const DAY_MS = 864e5;

/* Chunk-book entries that are chunks (2–6 words), not word cloze cards or whole sentences. */
function bookChunks() {
  return Object.entries(S.srs).filter(([, v]) => !v.cloze && v.en && wordsOf(v.en).length >= 2 && wordsOf(v.en).length <= 6);
}
const CHUNK_SKIP = new Set(['someone', 'something', "someone's", "one's", 'sb', 'sth', 'a', 'an', 'the']);
/* Does the transcript contain the chunk? Each keyword by its stem, in order, within a few words of each other. */
function chunkIn(chunk, text) {
  const keys = wordsOf(chunk).filter(w => !CHUNK_SKIP.has(w)).map(w => w.length > 4 ? w.slice(0, w.length - 2) : w);
  if (!keys.length) return false;
  const ws = wordsOf(text), gap = 3;
  for (let i = 0; i < ws.length; i++) {
    if (!ws[i].startsWith(keys[0])) continue;
    let j = i, ok = true;
    for (const k of keys.slice(1)) {
      let f = -1;
      for (let x = j + 1; x <= Math.min(ws.length - 1, j + 1 + gap); x++) if (ws[x].startsWith(k)) { f = x; break; }
      if (f < 0) { ok = false; break; }
      j = f;
    }
    if (ok) return true;
  }
  return false;
}
/* First time each book chunk turned up in free speech at least 12 hours after it was added
   (so the same lesson that taught it doesn't count). Returns [{ id, en, zh, rec }] sorted by date. */
function chunkUses(recs) {
  const free = recs.filter(r => FREE_KINDS.includes(r.kind) && r.text && !r.metrics?.garbled).sort((a, b) => a.t - b.t);
  const out = [];
  for (const [id, v] of bookChunks()) {
    const rec = free.find(r => r.t >= (v.t || 0) + DAY_MS / 2 && chunkIn(v.en, r.text));
    if (rec) out.push({ id, en: v.en, zh: v.zh || '', rec });
  }
  return out.sort((a, b) => a.rec.t - b.rec.t);
}

const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/* The last 7 days against the 7 before. Returns plain lines; a line is left out when there is nothing to compare. */
function weekSummary(recs) {
  const now = Date.now(), wk = [now - 7 * DAY_MS, now], prev = [now - 14 * DAY_MS, now - 7 * DAY_MS];
  const inW = (t, w) => t >= w[0] && t < w[1];
  const dayT = d => new Date(d + 'T12:00:00').getTime();
  const lines = [];
  const days = w => Object.keys(S.days).filter(d => active(d) && inW(dayT(d), w)).length;
  lines.push({ k: 'days', text: '练了 ' + days(wk) + ' 天（上一周 ' + days(prev) + ' 天）' });

  const curve = recs.filter(inCurve);
  const parts = [];
  for (const x of METRICS) {
    const a = curve.filter(r => inW(r.t, prev)).map(r => r.metrics[x.k]), b = curve.filter(r => inW(r.t, wk)).map(r => r.metrics[x.k]);
    if (a.length < 2 || b.length < 2) continue;
    parts.push(x.zh + ' ' + median(a).toFixed(x.digits) + ' → ' + median(b).toFixed(x.digits) + ' ' + x.unit);
  }
  if (parts.length) lines.push({ k: 'metrics', text: '自由说话（中位数，上周 → 本周）：' + parts.join('，') });

  const cats = {};
  for (const e of Object.values(S.errs)) for (const s of e.seen || []) {
    const c = cats[e.cat] || (cats[e.cat] = [0, 0]);
    if (inW(s.t, prev)) c[0]++; else if (inW(s.t, wk)) c[1]++;
  }
  const errParts = Object.entries(cats).filter(([, [a, b]]) => a || b).sort((x, y) => (y[1][0] - y[1][1]) - (x[1][0] - x[1][1]))
    .slice(0, 3).map(([c, [a, b]]) => (ERR_CATS[c] || c) + ' ' + a + ' → ' + b + ' 次');
  if (errParts.length) lines.push({ k: 'errors', text: '点评里抓到的错误（上周 → 本周）：' + errParts.join('，') });

  const rp = (S.repairs || []).filter(r => inW(r.t, wk));
  if (rp.length) lines.push({ k: 'repairs', text: '点评前自己改对 ' + rp.filter(r => r.fixed).length + ' / ' + rp.length + ' 处' });

  const used = chunkUses(recs).filter(u => inW(u.rec.t, wk));
  if (used.length) lines.push({ k: 'chunks', text: '第一次在自由说话里用出：' + used.map(u => '「' + u.en + '」').join('、') });
  return lines;
}

/* Real tasks, each proven by the first recording that did it. rec is null until reached;
   `at` is set for the repair milestone, which has no single recording. */
function milestones(recs) {
  const free = recs.filter(r => FREE_KINDS.includes(r.kind) && r.metrics && !r.metrics.garbled).sort((a, b) => a.t - b.t);
  const mono = free.filter(r => r.kind !== 'chat');
  const first = f => free.find(f) || null;
  const uses = chunkUses(recs);
  const fixed = (S.repairs || []).filter(r => r.fixed);
  return [
    { id: 'min1', title: '不看稿连续说满 1 分钟', how: '开口说、自言自语、4/3/2 或基准录音里，一段说满 60 秒、80 词以上。', rec: mono.find(r => r.duration >= 60 && r.metrics.words >= 80) || null },
    { id: 'min2', title: '不看稿讲满 2 分钟', how: '一段说满 120 秒、180 词以上（Part 2 话题或 4/3/2 第一遍最容易做到）。', rec: mono.find(r => r.duration >= 120 && r.metrics.words >= 180) || null },
    { id: 'research', title: '用 1 分钟给外行讲清你的研究', how: '「进步」页的学术线基准录音，说满 100 词。', rec: mono.find(r => r.kind === 'baseline' && r.meta?.bid === 'research' && r.metrics.words >= 100) || null },
    { id: 'chat30', title: '在 AI 对话里一口气说 30 个词以上', how: 'AI 对话里有一轮回答说满 30 词，不是只答一两句。', rec: first(r => r.kind === 'chat' && r.metrics.words >= 30) },
    { id: 'fluent', title: '说 100 词以上，每百词的 um / uh 不超过 2 个', how: '一段 100 词以上的自由说话，填充词每百词 ≤ 2。', rec: mono.find(r => r.metrics.words >= 100 && r.metrics.fillers_per100 <= 2) || null },
    { id: 'chunk', title: '第一次在自由说话里用出学过的语块', how: '语块本里的语块，学了之后在开口说、对话或自言自语里自己说出来。', rec: uses[0]?.rec || null, note: uses[0] ? '「' + uses[0].en + '」' : '' },
    { id: 'task', title: '在 AI 对话里完成一个任务', how: 'AI 对话的每个场景都有一个任务，结束总结里判定「任务完成」。', rec: null, at: (S.chatTasks || []).find(x => x.done === 'yes')?.t ?? null, note: (S.chatTasks || []).find(x => x.done === 'yes')?.task ? '（' + (S.chatTasks || []).find(x => x.done === 'yes').task + '）' : '' },
    { id: 'repair10', title: '点评前自己改对 10 处', how: '开口说点评前的「先自己改一处」，累计自己改对 10 次。', rec: null, at: fixed.length >= 10 ? fixed[9].t : null },
  ];
}

/* ================= 「进步证据」界面 =================
   All content comes from recordings already saved; this only lays it out. */
function evidenceSection(recs) {
  const box = h('div', { class: 'section ev' },
    h('h2', { text: '进步证据' }),
    h('p', { class: 'hint', text: '全部从你的录音里数出来，不打分。' }));

  const week = h('div', { class: 'card ev-card' }, h('h3', { text: '最近 7 天' }));
  for (const line of weekSummary(recs)) week.append(h('p', { text: line.text }));
  box.append(week);

  const done = [], todo = [];
  for (const m of milestones(recs)) (m.rec || m.at != null ? done : todo).push(m);
  const when = m => m.rec ? m.rec.t : m.at;
  done.sort((a, b) => when(a) - when(b));
  const day = t => {
    const d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const milestoneList = h('div', { class: 'ev-list' });
  for (const m of done) {
    const rec = m.rec;
    milestoneList.append(h('div', { class: 'ev-item' },
      h('div', { class: 'row ev-line' },
        h('span', { class: 'tag good', text: '做到了' }),
        h('b', { class: 'ev-title' }, m.title, m.note ? h('span', { class: 'ev-note', text: m.note }) : null),
        h('span', { class: 'ev-date', text: rec ? rec.date : day(m.at) })),
      rec ? h('details', {},
        h('summary', { text: '听当时的录音' }),
        h('audio', { controls: true, preload: 'none', src: recAudio(rec.id) }),
        h('p', { class: 'small' }, wordify(rec.text || '', { mine: true, src: '里程碑' }))) : null));
  }
  for (const m of todo) {
    milestoneList.append(h('div', { class: 'ev-item ev-todo' },
      h('div', { class: 'row ev-line' },
        h('span', { class: 'tag', text: '还没有' }),
        h('b', { class: 'ev-title', text: m.title })),
      h('p', { class: 'hint', text: m.how })));
  }
  box.append(h('div', { class: 'ev-block' }, h('h3', { text: '做到的事' }), milestoneList));

  const uses = chunkUses(recs);
  const chunkBlock = h('div', { class: 'ev-block' },
    h('h3', { text: '自由说话里用出的语块 · ' + uses.length + ' 个' }));
  if (!uses.length) {
    chunkBlock.append(h('p', { class: 'hint', text: '语块本里的语块，学了之后在开口说、对话或自言自语里自己说出来，就会记在这里。' }));
  } else {
    const shown = uses.length > 8 ? uses.slice(-8) : uses;
    const chunks = h('div', { class: 'ev-chunks' });
    for (const u of shown) {
      chunks.append(h('div', { class: 'ev-chunk' },
        h('b', { class: 'ev-en', text: u.en }),
        u.zh ? h('span', { class: 'ev-zh', text: u.zh }) : null,
        h('span', { class: 'ev-meta', text: u.rec.date + ' · ' + (KIND_ZH[u.rec.kind] || u.rec.kind) })));
    }
    chunkBlock.append(chunks);
    if (uses.length > shown.length) chunkBlock.append(h('p', { class: 'hint ev-more', text: '还有 ' + (uses.length - shown.length) + ' 个' }));
  }
  box.append(chunkBlock);

  return box;
}
