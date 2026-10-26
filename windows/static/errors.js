'use strict';
/* 个人错误日志：数据和调度。页面在 app.js 的「错误本」。

S.errs[key] = {
  key, cat, title_zh, rule_zh,
  status: 'active' | 'queued' | 'done',   // at most ERR_MAX_ACTIVE active at once
  seen: [{ t, said, better, src }],        // each time the AI found it in free speech
  tries: [{ t, zh, said, ok, note, better, due }],  // deploy / recheck attempts; due = was it a scheduled recheck; ok null = unsure, not counted
  drills: [{ zh, en }],                    // Chinese prompts whose English needs this pattern (made on first practice)
  due: null | ms,   // null: needs a deploy now (fresh, or failed); otherwise when the 48 h recheck opens
  t, act, grad,     // created, activated, graduated
}
One fix cycle: deploy right away (say a new sentence with the pattern) → recheck after 48 h → pass = graduated.
A failed recheck, or the error showing up again in free speech, starts the cycle over.
*/
const ERR_MAX_ACTIVE = 5, ERR_GAP = 48 * 3600e3;
const ERR_CATS = {
  article: '冠词', tense: '时态', agreement: '主谓一致', plural: '单复数', preposition: '介词',
  word_choice: '用词', collocation: '搭配', word_order: '语序', missing_word: '漏词', other: '其他',
};
const errSlug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const errList = st => Object.values(S.errs).filter(e => !st || e.status === st);
function errPromote() {
  const q = errList('queued').sort((a, b) => b.seen.length - a.seen.length || a.t - b.t);
  while (errList('active').length < ERR_MAX_ACTIVE && q.length) Object.assign(q.shift(), { status: 'active', act: Date.now(), due: null });
}
/* Text to append to a review prompt so the AI also returns `errors` in its JSON. */
function errPromptPart() {
  const known = Object.values(S.errs).sort((a, b) => b.t - a.t).slice(0, 40).map(e => e.key + ' = ' + e.title_zh).join('\n');
  return '\nAlso include "errors": the 1–3 grammar or word-choice errors in the learner\'s speech that most hurt understanding or look like habits (not one-off slips). '
    + 'Skip pronunciation, punctuation, capitalisation and anything that could be a speech-to-text mishearing. Empty list if there are none.\n'
    + 'Each: {"key": "short-english-slug naming the error pattern, e.g. missing-3sg-s", "cat": one of ' + Object.keys(ERR_CATS).map(k => '"' + k + '"').join(' | ')
    + ', "title_zh": "错误模式（中文，10 字以内）", "rule_zh": "规则（中文一句，带一个正确的英文小例子）", "said": "the learner\'s exact words", "better": "the corrected words"}.\n'
    + (known ? 'If an error is the same pattern as one already in the learner\'s log, reuse its key exactly:\n' + known + '\n' : '');
}
/* Merge errors found by the AI into the log. Returns the keys touched. */
function errIngest(list, src) {
  if (!Array.isArray(list)) return [];
  const now = Date.now(), out = [];
  for (const x of list.slice(0, 3)) {
    const key = errSlug(x?.key); if (!key || !x.said) continue;
    let e = S.errs[key];
    if (!e) e = S.errs[key] = { key, cat: ERR_CATS[x.cat] ? x.cat : 'other', title_zh: String(x.title_zh || key), rule_zh: String(x.rule_zh || ''), status: 'queued', seen: [], tries: [], drills: [], due: null, t: now, act: null, grad: null };
    e.seen.push({ t: now, said: String(x.said).slice(0, 300), better: String(x.better || '').slice(0, 300), src: src || '' });
    if (e.status === 'done') { e.status = 'queued'; e.grad = null; }
    else if (e.status === 'active') e.due = null; // came back in free speech: deploy again
    out.push(key);
  }
  errPromote(); save();
  return out;
}
/* What to practise now: active errors that need a deploy, then those whose recheck is open. */
function errDueList() {
  const now = Date.now();
  return errList('active').filter(e => e.due == null || e.due <= now).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
}
async function errDrills(e) {
  if (e.drills?.length) return e.drills;
  const ex = e.seen.slice(-3).map(s => '"' + s.said + '" → "' + s.better + '"').join('\n');
  const j = await aiText(LEARNER + '\n\nThe learner keeps making this error: ' + e.title_zh + ' (' + e.cat + '). Rule: ' + e.rule_zh + '\nWhat they said:\n' + ex
    + '\nWrite 4 short Chinese prompts (two about daily life, two about study or research life) whose natural English translation needs this exact pattern, so saying it aloud tests whether the error is fixed. Use different words from the examples. Each English answer under 15 words.\nJSON: {"drills": [{"zh": "...", "en": "..."}]}', { think: false });
  e.drills = (j?.drills || []).filter(d => d?.zh && d?.en).slice(0, 4).map(d => ({ zh: String(d.zh), en: String(d.en) }));
  if (!e.drills.length) throw new Error('AI 没出好练习题，再试一次。');
  save(); return e.drills;
}
/* Next drill to use: the one least recently tried. */
function errNextDrill(e) {
  const last = zh => Math.max(0, ...e.tries.filter(t => t.zh === zh).map(t => t.t));
  return [...(e.drills || [])].sort((a, b) => last(a.zh) - last(b.zh))[0] || null;
}
/* Words of a sentence, lowercased, for checking that a quote really comes from it. */
const errWords = s => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
/* Judge a spoken answer: local rules first, then the AI, then a check on the AI's answer.
   unsure = this attempt says nothing either way (too short, not English, pattern not used, or a pass the AI could not
   point at in their words), so it does not move the fix cycle; only a clear pass or a clear miss does. */
async function errJudge(e, drill, said) {
  const unsure = note => ({ ok: false, unsure: true, note, better: '' });
  if (/[\u3400-\u9fff]/.test(said)) return unsure('识别出来有中文。用英文再说一次。');
  const words = errWords(said);
  if (words.length < 3) return unsure('太短了，听不出这个说法用得对不对。说一句完整的。');
  const j = await aiText(LEARNER + '\n\nThe learner is fixing a recurring error: ' + e.title_zh + '. Rule: ' + e.rule_zh
    + '\nThey were asked to say this in English: ' + drill.zh + '\nOne good answer: ' + drill.en
    + '\nSpeech-to-text of what they said (ignore punctuation, capitalisation and obvious mishearings; a different sentence is fine if it is correct):\n"' + said + '"\n'
    + 'Judge ONLY this pattern. Other mistakes do not fail it.\n'
    + 'JSON: {"used": true if their sentence contains a place where this pattern is needed, false if it avoids the pattern entirely, '
    + '"ok": true if every such place is right, "evidence": "the words from THEIR sentence where the pattern appears, copied exactly, 1–6 words", '
    + '"note_zh": "中文一句：这个点对不对、为什么；有别的明显错误可顺带提一句", "better": "their sentence, corrected"}');
  const note = String(j?.note_zh || ''), better = String(j?.better || '');
  if (j?.used === false) return { ...unsure('这句没用到这个说法，不算。换一句要用到它的。' + (note ? ' ' + note : '')), better };
  // A pass must point at where the pattern is in their own words; a miss needs no proof to count against nothing.
  const ev = errWords(j?.evidence);
  const found = ev.length > 0 && (' ' + words.join(' ') + ' ').includes(' ' + ev.join(' ') + ' ');
  if (j?.ok && !found) return { ...unsure('AI 没能在你的句子里指出用到这个说法的地方，这次不算。' + (note ? ' ' + note : '')), better };
  return { ok: !!j.ok, unsure: false, note, better, evidence: ev.join(' ') };
}
/* Record an attempt and move the error along its fix cycle. Returns 'deployed' | 'graduated' | 'again' | 'practice' | 'unsure'. */
function errRecord(e, drill, said, verdict) {
  const now = Date.now(), sched = e.due != null && e.due <= now, deploy = e.due == null;
  e.tries.push({ t: now, zh: drill.zh, said, ok: verdict.unsure ? null : verdict.ok, note: verdict.note, better: verdict.better, due: sched });
  let r = 'practice';
  if (verdict.unsure) r = 'unsure';
  else if (deploy && verdict.ok) { e.due = now + ERR_GAP; r = 'deployed'; }
  else if (sched && verdict.ok) { Object.assign(e, { status: 'done', grad: now, due: null }); errPromote(); r = 'graduated'; }
  else if (!verdict.ok && (deploy || sched)) { e.due = null; r = 'again'; }
  save(); return r;
}
/* For charts: occurrences per ISO week (Monday date) for one error, and cumulative graduations by day. */
function errWeekly(e) {
  const by = {};
  for (const s of e.seen) { const d = new Date(s.t); d.setDate(d.getDate() - (d.getDay() + 6) % 7); const k = ymd(d); by[k] = (by[k] || 0) + 1; }
  return Object.keys(by).sort().map(x => ({ x, y: by[x] }));
}
function errGradCurve() {
  const days = errList('done').map(e => ymd(new Date(e.grad))).sort();
  return days.reduce((a, d) => { if (a.length && a[a.length - 1].x === d) a[a.length - 1].y++; else a.push({ x: d, y: (a.length ? a[a.length - 1].y : 0) + 1 }); return a; }, []);
}
