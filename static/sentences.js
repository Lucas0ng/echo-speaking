'use strict';
/* 句型精析：句子骨架、可迁移句型模板、「你说的 vs 母语者会怎么说」。卡片界面在 app.js。

analyzeSentences(['...', ...], { mine }) → [{
  s: the sentence as given,
  native: mine only — how a native speaker would naturally say it ('' when it is already natural),
  why_zh: mine only — what changed and why,
  skeleton: [{ text, role }],   // the analysed sentence (native version when there is one) split into its parts, in order
  tense_zh, pattern_zh,
  template: null | { en: 'The main reason I ___ is that ___.', zh, example: { en, zh } },
  chunks: [{ en, zh }],
}]
Answers are cached on disk, so analysing the same sentences again is free.
Template cards go into S.srs with { tpl, tplZh }: review shows example.zh + the frame, the learner says the example sentence.
*/
const SKEL_ROLES = ['主语', '谓语', '宾语', '表语', '宾补', '状语', '定语', '从句', '连词', '插入语'];
const SENT_BATCH = 6;
/* Sentences of a transcript, dropping fragments too short to have a pattern. */
function splitSentences(text) {
  return (String(text || '').match(/[^.!?。！？]+[.!?。！？]*["')\]]*/g) || []).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 3);
}
function sentPrompt(list, mine) {
  return LEARNER + '\n\n' + (mine
    ? 'These sentences are what the LEARNER said (speech-to-text; ignore punctuation, capitalisation and obvious mishearings).'
    : 'These sentences are from native-speaker listening material the learner is studying.')
    + '\nFor each sentence, help the learner steal its pattern for their own speaking.\n'
    + list.map((s, i) => (i + 1) + '. ' + s).join('\n')
    + '\nJSON: {"items": [ one object per sentence, same order: {'
    + (mine ? '"native": "how a native speaker would naturally say the same thing in conversation; empty string if it is already natural", "why_zh": "中文一句：主要改了什么、为什么；没改就空字符串", ' : '')
    + '"skeleton": [{"text": "consecutive words of the sentence' + (mine ? ' (the native version if you gave one)' : '') + '", "role": one of ' + SKEL_ROLES.map(r => '"' + r + '"').join(' | ') + '}] covering the whole sentence in order, at most 8 parts; 谓语 is only the verb group (auxiliaries, linking verb, phrasal-verb particle), never with its object, complement or an infinitive of purpose (those are separate parts), '
    + '"tense_zh": "时态和语态，如：现在完成时，主动", '
    + '"pattern_zh": "中文一句说明句子结构，如：主句 + because 引导的原因状语从句", '
    + '"template": {"en": "the ONE transferable pattern in this sentence as a short frame, 4–12 words, with ___ for the swappable parts — keep only the reusable core, not the whole sentence with blanks; for a long sentence pick its single most useful clause and drop the rest, so \\"After three months in the lab we finally figured out why the samples kept cracking.\\" gives \\"It took us ___ to figure out why ___.\\" (other frames: \\"The main reason I ___ is that ___.\\", \\"I\'ve been ___ since ___.\\")", "zh": "这个句型的中文意思", "example": {"en": "a new sentence using the frame, about a graduate student\'s research or daily life", "zh": "..."}} or null when the sentence is too short or formulaic to be worth a frame, '
    + '"chunks": [{"en": "a multi-word chunk from the sentence that is worth reusing in other conversations (not trivial ones like I think, not words tied to this one topic)", "zh": "..."}] (0–3)'
    + '} ]}';
}
const clean = (x, n = 300) => String(x ?? '').slice(0, n);
const sameWords = (a, b) => a.toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim() === b.toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
function sentItem(s, x, mine) {
  const t = x?.template;
  // the AI sometimes echoes an already-natural sentence instead of leaving native empty
  const native = mine && !sameWords(clean(x?.native), s) ? clean(x?.native) : '';
  return {
    s, native, why_zh: native ? clean(x?.why_zh) : '',
    skeleton: (Array.isArray(x?.skeleton) ? x.skeleton : []).filter(p => p?.text).slice(0, 8).map(p => ({ text: clean(p.text, 200), role: SKEL_ROLES.includes(p.role) ? p.role : '其他' })),
    tense_zh: clean(x?.tense_zh, 60), pattern_zh: clean(x?.pattern_zh, 120),
    template: t?.en ? { en: clean(t.en, 200), zh: clean(t.zh, 120), example: { en: clean(t.example?.en, 200), zh: clean(t.example?.zh, 200) } } : null,
    chunks: (Array.isArray(x?.chunks) ? x.chunks : []).filter(c => c?.en).slice(0, 3).map(c => ({ en: clean(c.en, 80), zh: clean(c.zh, 80) })),
  };
}
async function analyzeSentences(list, { mine = false } = {}) {
  list = list.map(s => String(s).trim()).filter(Boolean);
  const batches = [];
  for (let i = 0; i < list.length; i += SENT_BATCH) batches.push(list.slice(i, i + SENT_BATCH));
  const out = await Promise.all(batches.map(async b => {
    const j = await aiText(sentPrompt(b, mine), { think: false, cache: true });
    const items = Array.isArray(j?.items) ? j.items : [];
    if (!items.length) throw new Error('AI 返回的格式不对，再试一次。');
    return b.map((s, i) => sentItem(s, items[i], mine));
  }));
  return out.flat();
}
const findTemplateCard = tpl => Object.entries(S.srs).find(([, v]) => v.tpl && v.tpl === tpl);
/* Add a template card, or remove it if it is already there. Returns true when the card now exists. */
function toggleTemplateCard(t, src = '') {
  const f = findTemplateCard(t.en);
  if (f) delete S.srs[f[0]];
  else {
    const id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    S.srs[id] = { en: t.example.en, zh: t.example.zh, tpl: t.en, tplZh: t.zh, src, t: Date.now(), due: Date.now(), ivl: 0, ease: 2.5, reps: 0 };
  }
  save(); updateBadge(); return !f;
}
