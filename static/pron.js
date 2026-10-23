'use strict';
/* 发音：跟读每句一个练习重点 + 个人发音诊断（最小对立对）。页面在 app.js。

跟读重点 shadowFocus(path, sents, i) → { kind: 'link'|'stress'|'tone', words, sound, tip_zh }
  Kinds rotate by sentence (i % 3) so a session covers linking, stress and intonation; AI writes 8 sentences per
  call, cached on disk.

发音诊断 uses CONTRASTS (minpairs.js). Words are read as a plain list with a pause after each: a carrier like
"Say think again." made Whisper merge words into it ("say sin" → "Seishin"). With two macOS voices reading all 176
words, the plain list was heard right 88% of the time; pairs Whisper missed with both voices are in ASR_UNRELIABLE
and only used for listening drills.
S.pron = {
  tests:  [{ t, items: [{ cid, word, partner, heard, ok, weak }] }],   // check-ups; ok: true / false (said the partner) / null (unclear)
  drills: { [cid]: [{ t, mode: 'listen'|'say', word, ok, heard? }] },  // every drill trial
}
*/
const FOCUS_KINDS = { link: '连读', stress: '重音', tone: '语调' };
const FOCUS_KEYS = Object.keys(FOCUS_KINDS), FOCUS_BLOCK = 8;
const FOCUS = new Map(); // path + block → promise of items
function focusPrompt(list, start) {
  return LEARNER + '\n\nThe learner shadows these sentences from native-speaker audio, one at a time. Give each sentence ONE thing to focus on, '
    + 'of the kind in brackets (if that kind has nothing worth practising in the sentence, use another kind and set "kind" to it):\n'
    + list.map((s, k) => (k + 1) + '. [' + FOCUS_KEYS[(start + k) % 3] + '] ' + s).join('\n')
    + '\nKinds: link = where words run together in natural speech (consonant-to-vowel linking, flapped t, dropped sounds, want to → wanna); '
    + 'stress = which words carry the sentence stress and which small words are weak; '
    + 'tone = the intonation (falling at the end of a statement or wh-question, rising on a yes/no question, list intonation, fall-rise).\n'
    + 'JSON: {"items": [one per sentence, same order: {"kind": "link" | "stress" | "tone", "words": "the exact words of the sentence this is about, 1–5 words, copied as written", '
    + '"sound": "how it really sounds in simple respelling, CAPITALS for stressed syllables, ↗ ↘ for pitch, e.g. \\"bring-tə-YOU\\", \\"LANguage COACHing\\", \\"your spoken ENGlish ↘\\"", '
    + '"tip_zh": "中文一句：跟读这句时只盯这一点，具体怎么做"}]}';
}
function shadowFocus(path, sents, i) {
  const start = Math.floor(i / FOCUS_BLOCK) * FOCUS_BLOCK, key = path + '#' + start;
  if (!FOCUS.has(key)) {
    const list = sents.slice(start, start + FOCUS_BLOCK).map(s => s.text);
    const p = aiText(focusPrompt(list, start), { think: false, cache: true }).then(j => {
      const items = Array.isArray(j?.items) ? j.items : [];
      if (!items.length) throw new Error('AI 返回的格式不对，再试一次。');
      return list.map((s, k) => {
        const x = items[k] || {};
        return { kind: FOCUS_KINDS[x.kind] ? x.kind : FOCUS_KEYS[(start + k) % 3], words: String(x.words || '').slice(0, 80), sound: String(x.sound || '').slice(0, 120), tip_zh: String(x.tip_zh || '').slice(0, 160) };
      });
    });
    p.catch(() => FOCUS.delete(key));
    FOCUS.set(key, p);
  }
  return FOCUS.get(key).then(items => items[i - start]);
}

/* ---------- 发音诊断 ---------- */
const PRON_LAST = 20; // drill accuracy is over the last 20 trials of a kind
const ASR_UNRELIABLE = new Set(['den', 'dough', 'gone', 'gong', 'peas', 'sort']);
const contrast = id => CONTRASTS.find(c => c.id === id);
const asrPairs = c => c.pairs.filter(p => !p.some(w => ASR_UNRELIABLE.has(w)));
const pron = () => S.pron || (S.pron = { tests: [], drills: {} });
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
/* One check-up: both words of one random pair per contrast, shuffled, in rounds of 10 words (one recording per round). */
function pronTestRounds() {
  const items = shuffle(CONTRASTS.flatMap(c => { const [a, b] = pick(asrPairs(c)); return [{ cid: c.id, word: a, partner: b }, { cid: c.id, word: b, partner: a }]; }));
  const rounds = [];
  for (let i = 0; i < items.length; i += 10) rounds.push(items.slice(i, i + 10));
  return rounds;
}
const pronLine = w => w + '.';
/* Spellings Whisper may write for a word that sounds exactly the same. A homophone of the word counts as the word;
   one that could be either word of the pair (been: bean/bin) is left out so it stays "unclear". */
const SOUNDS_LIKE = {
  sum: ['some'], sink: ['sync'], tense: ['tents'], there: ['their', "they're"], dough: ['doe'], load: ['lode'], seed: ['cede'],
  wine: ['whine'], wet: ['whet'], veil: ['vale'], wail: ['whale', 'wale'], vain: ['vein', 'vane'], wane: ['wayne', 'wain'], wheel: ["we'll"], while: ['wile'],
  heel: ['heal', "he'll"], beat: ['beet'], peel: ['peal'], mat: ['matte'], jam: ['jamb'], low: ['lo'], no: ['know'], lock: ['loch'],
  right: ['write', 'rite'], rain: ['reign', 'rein'], lane: ['lain'], red: ['read'], led: ['lead'], lay: ['lei'],
  sun: ['son'], ton: ['tun'], prize: ['pries'], rise: ['ryes'], peas: ['pees'], peace: ['piece'], leak: ['leek'],
  sack: ['sac'], sell: ['cell'], sore: ['soar', 'saw'], shore: ['shaw'], // non-rhotic voices drop the r
};
const tokens = text => String(text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/\b10th\b/g, 'tenth').replace(/\b10\b/g, 'ten').replace(/\b9\b/g, 'nine')
  .split(/[^a-z']+/).filter(Boolean);
const sameWord = (tok, w) => tok === w || (SOUNDS_LIKE[w] || []).includes(tok);
/* Which of the two words was heard for each item, in reading order: the next occurrence of either word after the
   previous match (a skipped word becomes unclear without shifting the rest). words = Whisper [word, start, end, probability] for the weak flag. */
function pronParse(heard, words, items) {
  const toks = tokens(heard), probs = (words || []).map(w => [tokens(w[0])[0], w[3] ?? 1]);
  let at = 0;
  return items.map(it => {
    let k = -1;
    for (let j = at; j < toks.length; j++) if (sameWord(toks[j], it.word) || sameWord(toks[j], it.partner)) { k = j; break; }
    if (k < 0) return { ...it, heard: null, ok: null, weak: false };
    at = k + 1;
    const raw = toks[k], got = sameWord(raw, it.word) ? it.word : it.partner, pr = probs.find(([w]) => w === raw)?.[1] ?? 1;
    return { ...it, heard: got, ok: got === it.word, weak: pr < WEAK };
  });
}
function pronSaveTest(items) { pron().tests.push({ t: Date.now(), items }); save(); }
/* Per contrast for one check-up: right / counted (unclear items are not counted). */
function pronTestScore(test) {
  const by = {};
  for (const it of test.items) {
    const s = by[it.cid] || (by[it.cid] = { ok: 0, n: 0, wrong: [] });
    if (it.ok == null) continue;
    s.n++; if (it.ok && !it.weak) s.ok++; else if (it.ok) s.ok += 0.5; else s.wrong.push(it);
  }
  return by;
}
/* Contrasts to work on, worst first, from the latest check-up: anything under 100%. */
function pronFocusList() {
  const tests = pron().tests; if (!tests.length) return [];
  const sc = pronTestScore(tests[tests.length - 1]);
  return Object.entries(sc).filter(([, s]) => s.n && s.ok < s.n).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).map(([cid, s]) => ({ cid, ...s }));
}
/* Listening drill (high-variability: a different voice each time). Returns the trial; the page plays it with pronSpeak. */
// macOS novelty voices (Zarvox, Bells…) and the old formant voices (Eddy, Grandma…) would teach wrong sounds
const ODD_VOICES = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|organ|pipe organ|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|kathy|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;
function pronVoices() { const seen = new Set(); return VOICES.filter(v => /^en[-_](US|GB|AU|IE|CA|NZ|ZA|IN)/i.test(v.lang) && !ODD_VOICES.test(v.name) && !seen.has(v.name) && seen.add(v.name)); }
function pronListenTrial(cid, lastVoice) {
  const c = contrast(cid), pair = pick(c.pairs), word = pick(pair), vs = pronVoices();
  const voice = pick(vs.filter(v => v !== lastVoice).length ? vs.filter(v => v !== lastVoice) : vs) || null;
  return { cid, word, options: shuffle(pair), voice };
}
function pronSpeak(word, voice) {
  try {
    speechSynthesis.cancel(); pauseAll();
    const u = new SpeechSynthesisUtterance(word);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-US';
    u.rate = 0.9; speechSynthesis.speak(u);
  } catch {}
}
/* Speaking drill: a word to say, then judge what Whisper heard. ok: true / false (heard the partner) / null (unclear). */
function pronSayTrial(cid) { const c = contrast(cid), pair = pick(asrPairs(c)), i = Math.random() < 0.5 ? 0 : 1; return { cid, word: pair[i], partner: pair[1 - i] }; }
function pronSayJudge(trial, heard, words) { const [r] = pronParse(heard, words, [trial]); return r; }
function pronRecord(cid, mode, word, ok, heard) {
  const d = pron().drills; (d[cid] || (d[cid] = [])).push({ t: Date.now(), mode, word, ok, ...(heard !== undefined ? { heard } : {}) });
  save();
}
/* { listen: { ok, n }, say: { ok, n } } over the last PRON_LAST trials of each kind, and every check-up's score for this contrast. */
function pronStats(cid) {
  const d = pron().drills[cid] || [], last = mode => d.filter(x => x.mode === mode && x.ok != null).slice(-PRON_LAST);
  const acc = a => ({ ok: a.filter(x => x.ok).length, n: a.length });
  return { listen: acc(last('listen')), say: acc(last('say')), tests: pron().tests.map(t => ({ t: t.t, ...(pronTestScore(t)[cid] || { ok: 0, n: 0 }) })).filter(x => x.n) };
}
