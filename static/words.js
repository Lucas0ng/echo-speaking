'use strict';
/* 点词词典：查词、「在这句里」的 AI 讲解、整句卡。卡片界面在 app.js。

GET /api/dict?w=cooks → { found: true, w, phonetic, zh: [...], tags: [...], frq, form_zh, lemma: null | { w, phonetic, zh, tags } }; { found: false } when unknown.
dictLookup resolves to that object, or null for an unknown word.
Word cards live in the same spaced-repetition store as chunks (S.srs), with extra fields:
  { en: the whole sentence, zh: '做饭 · c…' (sense + first letter, never the word itself), cloze: the word as written in the sentence, word: dictionary form, mine: the learner said this sentence }
Review shows the sentence with the word blanked plus zh; the learner says the WHOLE sentence.
*/
const DICT = new Map(), SENSE = new Map();
const wordKey = w => String(w || '').toLowerCase().replace(/[’‘]/g, "'").replace(/^[^a-z]+|[^a-z']+$/g, '').replace(/'s$/, '');
function dictLookup(w) {
  const k = wordKey(w); if (!k) return Promise.resolve(null);
  if (!DICT.has(k)) DICT.set(k, api('/api/dict?w=' + encodeURIComponent(k)).then(j => (j?.found ? j : null)).catch(e => { DICT.delete(k); throw e; }));
  return DICT.get(k);
}
/* What the word means in this very sentence, plus collocations worth saying. Asked only when the learner wants it;
   the answer is kept on disk per word + sentence, so it is never paid for twice.
   cacheOnly: resolve null instead of asking the AI when there is no saved answer. */
function wordSense(w, sentence, { cacheOnly = false } = {}) {
  const id = wordKey(w) + '\n' + sentence;
  if (!SENSE.has(id)) {
    const p = aiText(LEARNER + '\n\nThe learner clicked the word "' + w + '" in this sentence:\n"' + sentence + '"\n'
      + 'JSON: {"sense_zh": "它在这句里的意思（中文，12 字以内）", "pos": "its part of speech here, e.g. verb", '
      + '"collocations": [{"en": "a common collocation with this word, 2–4 words", "zh": "..."}], '
      + '"note_zh": "如果这句里这个词用得不自然或用错了，中文一句指出并给出更好的说法；用得对就空字符串"} with exactly 3 collocations, the most useful ones for everyday or academic speaking.', { think: false, cache: !cacheOnly, cacheOnly })
      .then(j => (j === undefined ? null : { sense: String(j?.sense_zh || ''), pos: String(j?.pos || ''), note: String(j?.note_zh || ''),
        colls: (j?.collocations || []).filter(c => c?.en).slice(0, 3).map(c => ({ en: String(c.en), zh: String(c.zh || '') })) }))
      .then(r => { if (!r) SENSE.delete(id); return r; }, e => { SENSE.delete(id); throw e; });
    SENSE.set(id, p);
  }
  return SENSE.get(id);
}
/* Sentence of `text` that contains character offset `at`. */
function sentenceAt(text, at) {
  const re = /[^.!?。！？]+[.!?。！？]*["')\]]*\s*/g; let m;
  while ((m = re.exec(text))) if (at < m.index + m[0].length) return m[0].trim();
  return text.trim();
}
/* Text as a span whose English words are clickable (class "w", data-s = their sentence, data-mine = learner's own words). */
function wordify(text, { mine = false, src = '' } = {}) {
  text = String(text ?? ''); const box = h('span', { class: 'wordified' }); let last = 0;
  for (const m of text.matchAll(/[A-Za-z][A-Za-z’']*(?:-[A-Za-z]+)*/g)) {
    if (m.index > last) box.append(text.slice(last, m.index));
    box.append(h('span', { class: 'w', 'data-s': sentenceAt(text, m.index), 'data-mine': mine ? '1' : null, 'data-src': src || null, text: m[0] }));
    last = m.index + m[0].length;
  }
  if (last < text.length) box.append(text.slice(last));
  return box;
}
const clozeOf = (sentence, w) => sentence.replace(new RegExp('(^|[^A-Za-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])'), '$1_____');
const findWordCard = (w, sentence) => Object.entries(S.srs).find(([, v]) => v.cloze && v.en === sentence && wordKey(v.cloze) === wordKey(w));
/* Add the sentence as a word card, or remove it if it is already there. Returns true when the card now exists. */
function toggleWordCard(w, sentence, { sense = '', lemma = '', src = '', mine = false } = {}) {
  const f = findWordCard(w, sentence);
  if (f) delete S.srs[f[0]];
  else {
    const id = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), word = wordKey(lemma || w);
    // the hint must not give the answer away: Chinese sense plus the first letter only
    S.srs[id] = { en: sentence, zh: (sense ? sense + ' · ' : '') + w[0] + '…', src: src || (mine ? '我说的' : ''), cloze: w, word, mine: !!mine, t: Date.now(), due: Date.now(), ivl: 0, ease: 2.5, reps: 0 };
  }
  save(); updateBadge(); return !f;
}
