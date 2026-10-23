'use strict';
/* 语块复习：看中文，用语块说一句自己的新句子（不只是说出语块本身）。界面在 app.js 的 renderChunks。

Plain chunk cards (no cloze, no tpl) of at most CHUNK_MAX_WORDS words use this mode; longer entries (whole sentences
starred from a lesson) are still said as they are. Grading:
  chunk not used                         → 忘了
  used, but the sentence is wrong        → 模糊 (also the cap when the learner peeked at the chunk)
  used and correct, speech within 3 s    → 脱口而出, otherwise 想起来了
A sentence takes longer to start than a single chunk, hence 3 s instead of 2.5 s.
*/
const CHUNK_MAX_WORDS = 6;
const isSentenceCard = v => !v.cloze && !v.tpl && v.en.trim().split(/\s+/).length <= CHUNK_MAX_WORDS;
// placeholder words in dictionary-style chunks: "make up one's mind", "keep someone posted"
const CHUNK_SLOTS = new Set(['someone', "someone's", 'somebody', 'something', "one's", 'oneself', 'sb', 'sth', 'do', 'doing', 'your', 'my']);
// common irregular verb forms → base, so "grew up" counts for "grow up"
const IRREG = Object.fromEntries('went:go gone:go made:make took:take taken:take got:get gotten:get came:come gave:give given:give kept:keep ran:run brought:bring thought:think found:find told:tell said:say saw:see seen:see knew:know known:know felt:feel left:leave held:hold stood:stand spoke:speak spoken:speak broke:break broken:break fell:fall fallen:fall caught:catch bought:buy paid:pay lost:lose met:meet sent:send spent:spend built:build sat:sit won:win wore:wear worn:wear wrote:write written:write drove:drive driven:drive ate:eat eaten:eat began:begin begun:begin grew:grow grown:grow threw:throw thrown:throw blew:blow blown:blow drew:draw drawn:draw flew:fly flown:fly forgot:forget forgotten:forget chose:choose chosen:choose rose:rise risen:rise woke:wake woken:wake did:do done:do was:be were:be been:be had:have has:have taught:teach led:lead fed:feed sold:sell slept:sleep understood:understand dealt:deal meant:mean heard:hear hung:hang shook:shake shaken:shake'.split(' ').map(p => p.split(':')));
/* Did the learner use the chunk? Its words must appear in order (one-letter spelling slips allowed, slot words skipped).
   Inflected verbs count (makes/made/making a decision) through a shared stem of 3+ letters. */
function chunkUsed(chunk, heard) {
  const want = tokens(chunk).filter(w => !CHUNK_SLOTS.has(w)), got = tokens(heard);
  let j = 0;
  for (const w of want) {
    const stem = w.replace(/(ing|ed|es|s|e)$/, '');
    while (j < got.length && !(near(got[j], w) || IRREG[got[j]] === w || (stem.length >= 3 && got[j].startsWith(stem)))) j++;
    if (j >= got.length) return false;
    j++;
  }
  return want.length > 0;
}
async function chunkJudge(v, heard) {
  const j = await aiText(LEARNER + '\n\nThe learner was shown "' + (v.zh || v.en) + '" and asked to say a NEW sentence of their own that uses the chunk "' + v.en + '".'
    + '\nSpeech-to-text of what they said (ignore punctuation, capitalisation and obvious mishearings):\n"' + heard + '"\n'
    + 'Judge whether the chunk is used correctly and naturally and the sentence is acceptable spoken English. Small slips elsewhere do not fail it.\n'
    + 'JSON: {"ok": true or false, "note_zh": "中文一句：用得对不对、哪里要改", "better": "their sentence made natural, keeping their idea and the chunk"}', { think: false });
  return { ok: !!j?.ok, note: String(j?.note_zh || ''), better: String(j?.better || '') };
}
function chunkGrade(used, verdict, onset, peeked) {
  if (!used) return { g: 0, why: '没用上这个语块' };
  if (!verdict.ok) return { g: 1, why: '用上了，但句子要改' };
  if (peeked) return { g: 1, why: '看了语块才想起来' };
  return onset != null && onset <= 3 ? { g: 3, why: '用对了，' + onset.toFixed(1) + ' 秒开口' } : { g: 2, why: '用对了' + (onset != null ? '，' + onset.toFixed(1) + ' 秒开口' : '') };
}
