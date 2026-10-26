'use strict';
/* 自言自语：不看稿、对着自己说。三种练法，录音都存成 kind 'solo'（meta.mode 区分），进「进步」页的流利度曲线。
页面在 app.js 的 renderSolo。

nonstop  60 秒不停说：不许停。只看「卡住」（服务器从音频算：静音 ≥ 2 秒算一次，见 app.py stop_metrics）、
         不停顿秒数（flow_s）、最长一口气（longest_s）和填充词。不点评内容：这一项只练不停，不练准确。
picture  看图描述：自己选一张照片（只在本机显示，不上传），或描述眼前的房间、实验室。可以让 AI 点评内容。
day      睡前复述今天：按时间顺序讲今天，试着用上最近学的语块；说完标出用上了哪几个。可以让 AI 点评内容。
*/
const SOLO_MODES = {
  nonstop: { zh: '60 秒不停说', secs: 60, intro: '看到题目马上开口，60 秒里不许停。卡住了就说 "let me think"、换个说法、随便说下去都行，只要别停。不看对错，只看停了几次。' },
  picture: { zh: '看图描述', secs: 90, intro: '选一张照片（只在这台电脑上显示，不上传），或者直接描述你现在在的地方。先说整体，再说细节：有什么、在哪、在发生什么、给你什么感觉。' },
  day: { zh: '睡前复述今天', secs: 60, intro: '用 1 分钟按时间顺序讲今天：做了什么、哪件事顺利、哪件事烦人。试着用上下面最近学的语块。' },
};
// Everyday prompts for 60 秒不停说: things you can talk about without preparing, nothing you need facts for.
const SOLO_TOPICS = [
  ['What did you have for breakfast, and why?', '早饭吃了什么、为什么'],
  ['Describe the way from your home to your lab or office.', '从住处到实验室/办公室的路'],
  ['Talk about a phone app you use every day.', '每天都用的一个 App'],
  ['What would you do with a free day tomorrow?', '明天突然放假一天会做什么'],
  ['Describe your favourite place to eat near your university.', '学校附近最喜欢吃的地方'],
  ['Talk about a person who helped you recently.', '最近帮过你的一个人'],
  ['What is something you want to buy, and why?', '想买的一样东西'],
  ['Describe the weather today and how it changed your plans.', '今天的天气和对安排的影响'],
  ['Talk about your hometown in winter.', '冬天的家乡'],
  ['What is the most annoying part of your research right now?', '现在研究里最烦的部分'],
  ['Describe a TV show or video you watched recently.', '最近看的一个节目或视频'],
  ['Talk about how you usually spend your weekends.', '周末一般怎么过'],
  ['What is a skill you want to learn, and how would you start?', '想学的一个技能，怎么开始'],
  ['Describe your desk right now.', '你现在的桌面'],
  ['Talk about a time you got lost.', '一次迷路的经历'],
  ['What do you usually do when you can not sleep?', '睡不着的时候做什么'],
  ['Describe a good teacher you had.', '遇到过的一位好老师'],
  ['Talk about cooking: what can you make, what can you not?', '做饭：会做什么、不会做什么'],
  ['What is the best way to relax after a long day?', '累了一天怎么放松'],
  ['Describe a trip you would like to take.', '想去的一次旅行'],
  ['Talk about your phone: what you like and what annoys you.', '你的手机：喜欢和烦的地方'],
  ['What are the good and bad sides of living in a dorm?', '住宿舍的好处和坏处'],
  ['Describe your morning routine.', '早上的固定流程'],
  ['Talk about something you changed your mind about.', '改变过看法的一件事'],
  ['What makes a good group meeting?', '什么样的组会算好'],
  ['Describe a small thing that made you happy this week.', '这周让你开心的一件小事'],
  ['Talk about how you use English in your daily life.', '平时在哪里用英语'],
  ['What would you tell a new student in your lab?', '会对实验室新生说什么'],
  ['Describe the last time you went shopping.', '上次购物'],
  ['Talk about a sport or exercise you do, or wish you did.', '在做或想做的运动'],
];
const SOLO_SCENES = [
  ['Describe the room you are in right now: what you see, where things are, and what it feels like.', '描述你现在在的房间'],
  ['Describe your lab or the place you usually work: the space, the equipment, the people.', '描述你的实验室或常待的工作地方'],
  ['Look out of the nearest window and describe what you see.', '看向最近的窗外，描述看到的'],
];
const soloPick = (list, not) => { const pool = list.filter(x => x[0] !== not); return pool[Math.floor(Math.random() * pool.length)] || list[0]; };

/* Chunks to try in 睡前复述今天 and in every AI chat scene: today's lesson chunk, then the newest chunk-sized cards from the last 3 days. */
function recentChunks(max = 5) {
  const out = [], seen = new Set(), add = (en, zh) => { const k = en.trim().toLowerCase(); if (k && !seen.has(k)) { seen.add(k); out.push({ en: en.trim(), zh: zh || '' }); } };
  const L = typeof LESSONS !== 'undefined' ? LESSONS[S.prefs.cur - 1] : null;
  if (L?.x) add(L.x, '今日语块');
  Object.values(S.srs).filter(v => isSentenceCard(v) && Date.now() - (v.t || 0) < 3 * 864e5)
    .sort((a, b) => b.t - a.t).forEach(v => add(v.en, v.zh));
  return out.slice(0, max);
}
/* Which of the suggested chunks the transcript used (same matcher as chunk review). */
const soloUsed = (chunks, text) => chunks.filter(c => chunkUsed(c.en, text)).map(c => c.en);

/* AI feedback for 看图描述 / 睡前复述今天, in the shape renderReview draws. Errors go into the error log. */
async function soloReview(mode, topic, text, chunks = [], stuck = []) {
  const task = mode === 'day' ? 'The learner retold their own day in English for one minute, in order.'
    : 'The learner described a picture or the place they are in for about a minute. Task: "' + topic + '"';
  const j = await aiText(LEARNER + '\n\n' + task
    + (chunks.length ? '\nThey were encouraged to use these chunks: ' + chunks.map(c => '"' + c.en + '"').join(', ') + '.' : '')
    + '\nSpeech-to-text transcript (ignore punctuation and obvious mis-hearings):\n---\n' + text.slice(0, 6000) + '\n---\n'
    + 'This is free speaking practice, not an exam: no band score. Focus on what would make them easier to understand and more natural, '
    + (mode === 'day' ? 'especially past tenses, time order words and linking.' : 'especially words for positions, objects and actions they were missing.')
    + '\nJSON: {"comment_zh": "中文两句：做得好的一点 + 最该改的一点", "corrected": "their speech with grammar and word choice fixed, same meaning", '
    + '"natural": "a more fluent, natural version, about the same length", "fixes": [{"original": "...", "better": "...", "why_zh": "中文一句"}], '
    + '"chunks": [{"en": "a useful multi-word chunk for what they were trying to say", "zh": "..."}]}. At most 5 fixes. Exactly 4 chunks.' + gapPromptPart(stuck) + errPromptPart());
  const src = (SOLO_MODES[mode]?.zh || '自言自语') + (mode === 'day' ? '' : ' · ' + topic.slice(0, 40));
  if (j) { j.errKeys = errIngest(j.errors, src); j.cards = gapIngest(j.gaps, '卡壳', src); }
  return j;
}
/* 60 秒不停说 has no content review (it only trains not stopping), but where they got stuck can still become cards. */
async function soloGapCards(text, stuck) {
  const j = await aiText(LEARNER + '\n\nThe learner talked for a minute without preparing. Speech-to-text transcript (ignore punctuation and obvious mis-hearings):\n---\n'
    + text.slice(0, 4000) + '\n---\n' + gapPromptPart(stuck) + 'JSON: {"gaps": [...]}', { think: false });
  return gapIngest(j?.gaps, '卡壳', SOLO_MODES.nonstop.zh);
}

/* Past attempts of one mode from the recordings archive (oldest first), and first vs latest for 60 秒不停说. */
const soloRecs = mode => RECS.list.filter(r => r.kind === 'solo' && r.meta?.mode === mode).sort((a, b) => a.t - b.t);
function soloTrend(mode) {
  const rs = soloRecs(mode).filter(r => r.metrics?.flow_s != null);
  if (!rs.length) return null;
  const pick = r => ({ date: r.date, stops: r.metrics.stops, flow: r.metrics.flow_s, longest: r.metrics.longest_s, fillers: r.metrics.fillers_per100 });
  // one point per day: that day's best flow, so a bad second try does not hide a good first one
  const byDay = {};
  for (const r of rs) if (!byDay[r.date] || r.metrics.flow_s > byDay[r.date].metrics.flow_s) byDay[r.date] = r;
  return { n: rs.length, first: pick(rs[0]), last: pick(rs[rs.length - 1]),
    points: Object.keys(byDay).sort().map(d => ({ x: d, y: byDay[d].metrics.flow_s })) };
}
