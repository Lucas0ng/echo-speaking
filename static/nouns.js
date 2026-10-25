'use strict';
/* 名词说法：中文习惯用动词说的事，英语常用名词说（我决定了 → I made a decision）。并在语块本里，不另起一套。

两条线分开：
  daily  日常：轻动词 + 名词（make a decision, have a look, take a break, give it a try）
  work   工作 / 学术：汇报、讲方法时的名词短语（the main finding is, an increase in, my concern is）
  日常线不推书面名词化，免得说话像念论文。

来源：
  精析  跟读和开口说的逐句精析里返回 nouns，点「加入」进语块本（sentences.js / analysisView）。
  点评  开口说点评里，学习者用动词说、母语者会用名词说的地方，自动入卡（最多 NOUN_MAX 张）。

卡片：S.srs 里普通语块卡加 nf: { line, cue }。cue 是动词式的中文（「我们最后决定换个方法。」），
复习时只给 cue，学习者要用名词说法把它说成英文（review.js 的说新句子模式，chunkJudge 按 cue 判）。
进步页按 nf.line 分开数「自由说话里用出」（evidence.js）。
*/
const NOUN_MAX = 2;
const NOUN_LINE = { daily: '日常', work: '工作' };
const NOUN_RULES = 'English often says with a noun what Chinese says with a verb. Two kinds: '
  + 'daily = a light verb + noun for everyday talk (make a decision, have a quick look, take a break, give it a try, have a chat with); '
  + 'work = a noun phrase for reporting or explaining at work or in research talk (the main finding is, an increase in, my main concern is, the reason for, make progress on). '
  + 'The chunk must contain and hinge on a noun that names an action, change or state (decision, look, break, try, increase, improvement, concern, progress) where a Chinese speaker would naturally use a verb or adjective instead. '
  + 'Not a plain verb + object where the verb carries the meaning (improve my English, help you, bring experience), not an -ing form (moving out), and not an ordinary noun compound (language coaching experience). '
  + 'Never give stiff written nominalisation for everyday talk.';
const NOUN_ITEM = '{"en": "the noun chunk in its base form, 2–6 words, e.g. make a decision", "zh": "中文意思（短）", "line": "daily" | "work", '
  + '"cue_zh": "一句中文，用中国人习惯的动词说法说同一件事（如 have a look at 对应：你帮我看一下这份数据。），学习者看着它要用这个名词说法说出英文"}';
/* For the sentence-analysis prompt (sentences.js). */
const nounAnaPart = () => '"nouns": [' + NOUN_ITEM + '] (0–2; most sentences have none, so an empty list is the usual answer) — only noun patterns this sentence really uses, '
  + 'where a Chinese speaker would naturally have used a verb instead; do not repeat them in chunks. ' + NOUN_RULES + ', ';
/* For the 开口说 review prompt: places where the learner used a verb and a native speaker would use a noun. */
function nounPromptPart() {
  return '\nAlso include "nouns": 0–2 places where the learner said something with a verb (or a clumsy wording) and a native speaker would more naturally use a noun pattern. '
    + NOUN_RULES + ' Each: {"original": "the learner\'s exact words", "better": "that part said with the noun pattern", '
    + NOUN_ITEM.slice(1) + '. Empty list when their wording is already natural; do not force it, and do not repeat a fix.\n';
}
const cleanNoun = x => {
  const en = String(x?.en || '').trim(), zh = String(x?.zh || '').trim(), cue = String(x?.cue_zh || '').trim();
  const n = en.split(/\s+/).length;
  if (!en || !cue || n < 2 || n > 6) return null;
  return { en: en.slice(0, 80), zh: zh.slice(0, 80), line: x?.line === 'work' ? 'work' : 'daily', cue: cue.slice(0, 200) };
};
const nounList = xs => (Array.isArray(xs) ? xs : []).map(cleanNoun).filter(Boolean);
/* Add (or upgrade an existing plain chunk into) a noun card. Returns the id. */
function addNounCard(nn, src) {
  const id = addChunk(nn.en, nn.zh, src);
  if (id && !S.srs[id].nf) { S.srs[id].nf = { line: nn.line, cue: nn.cue }; save(); }
  return id;
}
/* Cards from a review's "nouns". Returns [{ original, better, en, line }] for the ones added. */
function nounIngest(list, src) {
  const added = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (added.length >= NOUN_MAX) break;
    const nn = cleanNoun(x);
    if (!nn || findChunk(nn.en)?.[1].nf) continue;
    addNounCard(nn, '名词 · ' + (src || ''));
    added.push({ original: String(x.original || '').slice(0, 200), better: String(x.better || '').slice(0, 200), en: nn.en, line: nn.line });
  }
  if (added.length) updateBadge();
  return added;
}
const nounTag = line => h('span', { class: 'tag', text: '名词 · ' + (NOUN_LINE[line] || '日常') });
/* Star-like toggle for a noun item in the analysis view. */
function nounBtn(nn, src) {
  const b = h('button', { class: 'btn ghost small' });
  const paint = () => { const on = !!findChunk(nn.en)?.[1].nf; b.textContent = on ? '已加入 · 再点移出' : '加入语块本'; };
  b.onclick = () => { const f = findChunk(nn.en); if (f?.[1].nf) { delete S.srs[f[0]]; save(); updateBadge(); } else addNounCard(nn, src); paint(); };
  paint();
  return b;
}
/* Block in the analysis view. */
function nounView(list, src) {
  list = (Array.isArray(list) ? list : []).filter(nn => nn?.en && nn?.cue);
  if (!list.length) return null;
  return h('div', { class: 'ana-chunk-box' }, h('h3', { class: 'tpl-title', text: '名词说法' }),
    h('div', { class: 'ana-chunks' }, list.map(nn => h('div', { class: 'ana-chunk' },
      h('span', { class: 'en' }, nn.en, ' ', nounTag(nn.line)),
      h('span', { class: 'zh', text: (nn.zh ? nn.zh + ' · ' : '') + '中文常说：' + nn.cue }),
      sayBtn(nn.en), nounBtn(nn, src)))),
    h('p', { class: 'hint', text: '复习时只给动词式的中文，你用名词说法说出来。' }));
}
/* Notice under the 开口说 review for the noun cards that were added. */
function nounNotice(added) {
  if (!added?.length) return null;
  return h('div', { class: 'card' }, h('h3', { text: '换成名词说法 · 已加入语块本' }),
    added.map(x => h('div', { class: 'fix' },
      h('div', {}, x.original ? h('s', { text: x.original }) : null, x.original ? ' → ' : '', h('b', { text: x.better || x.en }), ' ', nounTag(x.line)),
      h('span', { class: 'hint', text: '语块：' + x.en + '。复习时看中文的动词说法，用它说出来。' }))));
}
