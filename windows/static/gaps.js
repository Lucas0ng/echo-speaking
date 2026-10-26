'use strict';
/* 卡壳和说错的句子 → 自动做成卡片（语块本里「看中文说整句」）。

来源：
  卡壳  独白录音（开口说、4/3/2、自言自语）里句子中间停了 2 秒以上的地方。服务器在 /api/stt 返回
        stuck: [{ at, secs, before, after }]（app.py stuck_points）。点评时把这些位置交给 AI，同一次调用里
        让它说出你当时想找的说法（gapPromptPart），不额外花钱。只是停下来想内容、不是找词的，AI 会跳过。
  求助  AI 对话里点过「求助」的句子（chat.js chatHelp）。
  说错  AI 对话结束总结里最该改的句子（chat.js chatSummary 的 fixes）。
  任务  AI 对话的任务没完成时，「这样说就能做到」的那句。
  复述  4/3/2 第 3 遍里最值得换个说法的 1–3 句（app.js retellReview）。
每次最多自动加 GAP_MAX 张，避免一次塞太多；加过的不重复加（addChunk 按英文去重）。
卡片的 src 以「卡壳 · 」「求助 · 」「改错 · 」「任务 · 」「复述 · 」开头，在语块本里可以删。
*/
const GAP_MAX = 4;
function gapPromptPart(stuck) {
  if (!Array.isArray(stuck) || !stuck.length) return '';
  return '\nThe learner stopped for 2 seconds or more in the middle of a sentence at these points ("‖" marks the stop):\n'
    + stuck.slice(0, 8).map((g, i) => (i + 1) + '. "' + g.before + ' ‖ ' + g.after + '" (' + g.secs + ' s)').join('\n')
    + '\nAlso include "gaps": for each point where they were clearly searching for a word or a way to say something, '
    + '{"en": "the natural phrase or short sentence they needed, under 15 words, one way of saying it (no alternatives with /)", "zh": "中文意思", "why_zh": "中文一句：卡在哪"}. '
    + 'Skip points where they were only deciding what to say next. Empty list if none.\n';
}
/* Add cards from a list of { en, zh }. kind: '卡壳' | '求助' | '改错' | '任务' | '复述'. Returns the English of the cards added. */
function gapIngest(list, kind, src) {
  const added = [];
  for (const g of (Array.isArray(list) ? list : [])) {
    if (added.length >= GAP_MAX) break;
    const en = String(g?.en || '').trim(), zh = String(g?.zh || '').trim();
    if (!en || !zh || en.split(/\s+/).length > 20 || findChunk(en)) continue;
    addChunk(en, zh, kind + ' · ' + (src || ''));
    added.push(en);
  }
  if (added.length) updateBadge();
  return added;
}
/* The notice shown under a review when cards were added. */
function gapNotice(added) {
  if (!added?.length) return null;
  return h('div', { class: 'notice' }, h('span', { text: '自动加入语块本 ' + added.length + ' 张，复习时看中文说整句：' }),
    h('ul', { class: 'gap-list' }, added.map(en => h('li', { text: en }))),
    h('span', { class: 'hint', text: '不想要的可以在语块本里删。' }));
}
