'use strict';
/* AI 对话：场景、提示词、求助和对话结束的总结。界面在 app.js 的 renderChat。

两种反馈方式（S.prefs.chatFix）：
  end（默认，不打断）：对话中 AI 不改错、不替你重说。听不懂时像真人一样追问（"Sorry, do you mean…?"），
       你自己换个说法让它听懂，就是一次自我修正。卡住了可以点「求助」要一个说法。错误和更好的说法在结束后统一给。
  each：每轮顺手给一句更自然的说法（以前的方式）。
每个场景都给 AI 一串最近学的语块（recentChunks），让它创造机会让你用上；界面上用上的会打勾。

CHAT.view 里你的每条消息 { role: 'me', text, unclear?, repair?, fb?, help? }：
  unclear  AI 对这句的回复是在追问（没听懂）
  repair   上一句被追问后，这一句让 AI 听懂了
  help     点过「求助」（结束总结时连同最该改的句子一起做成卡片，见 gaps.js）
  move     这句除了回答还做了什么：'asked' 反问了对方，'reacted' 接了对方的话（附和、表示兴趣），'answer' 只是回答。
           真实对话是两个人一起往下聊，只会回答的人聊不下去，所以界面上会标出来，连着两句只回答会提醒一下。
每个场景都有可判定的任务（CHAT.task），结束总结里 AI 判定完成 / 部分完成 / 没完成，没完成时给一句「这样说就能做到」并做成卡片；
结果记在 S.chatTasks。
*/
const SCEN = {
  // Every scene has goals that can be judged at the end: done, partly, or not (chatSummary "task").
  topic: { label: '今日话题', role: n => 'You are a friendly, curious friend. Chat with the learner about "' + LESSONS[n - 1].t + '": ask about their own experience and opinions, react to what they say and follow up on it, like a real conversation. Ask one question at a time.',
    tasks: [['说清你自己的看法和一个理由，再反过来问对方怎么看', 'make their own view and one reason clear, then ask the partner for their view'],
      ['讲一件和这个话题有关的亲身经历，让对方追问后再补充细节', 'tell a real experience related to the topic, and add details when the partner asks'],
      ['对方说完时接一句话再追问一个问题，至少做到两次', 'at least twice, react to what the partner said and ask a follow-up question']] },
  research: { label: '介绍研究', line: 'academic', role: () => 'You are a friendly professor from another university meeting the learner at a poster session at an international conference. Ask about their research topic, why it matters, their method, results so far, and next steps.',
    tasks: [['让对方能用一句话说出你的研究问题（结束前请对方复述一下）', 'make the professor able to say their research question back in one sentence; near the end, ask the professor to sum it up'],
      ['说清楚你的研究为什么重要，对谁有用', 'make clear why their research matters and who it helps'],
      ['问出对方的一个建议，并约好会后加个联系方式', 'get one piece of advice from the professor and arrange to stay in touch']] },
  meeting: { label: '组会汇报', line: 'academic', role: () => "You are the learner's supervisor in a weekly lab meeting held in English. Ask them to report this week's progress, then ask kind but probing follow-up questions.",
    tasks: [['让导师听懂你这周做了什么、结果如何，并答好他的 1 个追问', "make the supervisor understand what they did this week and what came out of it, and answer one follow-up question"],
      ['说明一个没做成或不顺的实验，以及下一步打算', 'explain an experiment that failed or went badly, and what they plan to do next'],
      ['提出你卡住的一个问题，请导师给意见', 'raise one problem they are stuck on and ask the supervisor for advice']] },
  probe: { label: '被追问方法', line: 'academic', role: () => 'You are a sharp but fair researcher from a neighbouring field, at a seminar after the learner has presented. Ask probing questions about their method, one at a time: why this method and not an obvious alternative, what its limits are, how they know it works, what could go wrong. Push back once or twice when an answer is vague, like a real colleague would, but stay polite.',
    tasks: [['解释你为什么选这个方法，而不是另一个常见的方法', 'explain why they chose their method and not an obvious alternative'],
      ['被问到局限时，先承认，再说明你怎么处理或打算怎么处理', 'when asked about a limitation, admit it first, then explain how they handle it or plan to'],
      ['有一个问题答不上时，礼貌地说明现在还不知道，并说你会怎么去弄清楚', 'for a question they cannot answer, say politely that they do not know yet and how they would find out']] },
  explain: { label: '给外行讲概念', line: 'academic', role: () => 'You are a curious friend who studies something completely different (history), with no science background. The learner will explain an idea from their field. Ask the naive questions a real outsider would ask, and say honestly when you get lost ("Wait, what does that word mean?"). When you think you understand, say it back in your own simple words so they can check.',
    tasks: [['给对方讲清你研究里的一个核心概念，直到对方能用自己的话说对', 'explain one key idea from their research until the friend can say it back correctly in their own words'],
      ['用一个生活里的类比讲清一个专业术语', 'explain one technical term with an everyday comparison'],
      ['对方没听懂时，换一种说法再讲一遍，而不是重复原话', 'when the friend gets lost, explain it again a different way instead of repeating the same words']] },
  interview: { label: '英文面试', role: () => 'You are an interviewer for a research internship or a graduate job. Ask common interview questions one at a time.',
    tasks: [['讲一个你解决过的难题：当时什么情况、你怎么做的、结果如何', 'tell about a hard problem they solved: the situation, what they did, the result'],
      ['说清楚你为什么想要这份工作', 'explain clearly why they want this job'],
      ['面试最后，问面试官两个有分量的问题', 'at the end, ask the interviewer two good questions']] },
  coffee: { label: '会议茶歇', role: () => 'You are a PhD student from another country chatting with the learner during a coffee break at a conference. Keep it light.',
    tasks: [['问出对方研究什么、从哪里来，并约好之后再聊', 'find out what the partner researches and where they are from, and arrange to talk again later'],
      ['聊到一个共同点（比如都喜欢的地方或食物），并多聊两句', 'find something in common (a place, food, hobby) and talk about it a bit more']] },
  free: { label: '自由聊天', role: () => 'You are a friendly English-speaking friend. Chat about daily life, food, hobbies and plans.',
    tasks: [['聊你这个周末的安排，也问出对方的安排', 'talk about their weekend plans and find out the friend\'s plans too'],
      ['推荐一部电影、一本书或一家店给对方，并说清理由', 'recommend a film, book or shop to the friend and give reasons']] },
  // Everyday service scenes: the AI is the staff member, the learner has a concrete goal (a random one each time).
  order: { label: '点餐', daily: true, role: () => 'You are a waiter at a busy casual restaurant in an English-speaking city. Greet the customer and serve them like a real waiter: menu questions, recommendations, allergies, drinks, the bill.',
    tasks: [['给自己和朋友点两人份的晚餐，其中一人不吃辣', 'order dinner for two; one of them cannot eat spicy food'],
      ['点一份外带，问清楚要等多久、能不能少放盐', 'order a takeaway, ask how long it takes and whether it can be less salty'],
      ['菜上错了，礼貌地说明并请对方换', 'the wrong dish has arrived; politely explain and ask for the right one'],
      ['结账时发现多收了一道菜', 'at the end, the bill has a dish they did not order']] },
  directions: { label: '问路', daily: true, role: () => 'You are a local person on the street (or a staff member at a station) in an English-speaking city. The learner stops you to ask something. Give directions like a real person: landmarks, left and right, how long it takes.',
    tasks: [['问去最近的地铁站怎么走，确认要走多久', 'find the nearest underground station and check how long the walk is'],
      ['在大学校园里找国际学生办公室', 'find the international student office on a big university campus'],
      ['错过了公交车，问下一班什么时候、在哪儿坐', 'they just missed their bus; find out when and where the next one is'],
      ['找一家附近还开着门的药店', 'find a pharmacy nearby that is still open']] },
  errand: { label: '办事', daily: true, role: () => 'You are a staff member (bank clerk, phone shop assistant, landlord or university office staff, whichever fits the learner\'s goal) in an English-speaking country. Be polite and realistic: ask for details and documents, explain options and rules.',
    tasks: [['去银行开户，问清楚要带什么材料', 'open a bank account and find out what documents to bring'],
      ['给房东打电话报修：热水器坏了', 'call the landlord: the water heater is broken'],
      ['在营业厅办手机套餐，问清楚流量和价格', 'get a mobile phone plan; compare data and prices'],
      ['在学校办公室补办丢了的学生卡', 'replace a lost student card at the university office']] },
  doctor: { label: '看病', daily: true, role: () => 'You are a GP doctor (or a pharmacist or clinic receptionist, whichever fits the learner\'s goal) in an English-speaking country. Ask the questions a real one would ask; keep medical words simple.',
    tasks: [['咳嗽三天了，跟医生描述症状', 'they have had a cough for three days; describe it to the doctor'],
      ['去药店买感冒药，问怎么吃、有没有副作用', 'buy cold medicine at a pharmacy; ask how to take it and about side effects'],
      ['打电话改约牙医，时间要往后挪', 'call the dentist to move an appointment to a later day'],
      ['运动时扭了脚踝，说清楚怎么受的伤', 'they twisted an ankle doing sport; explain how it happened']] },
  shop: { label: '买东西', daily: true, role: () => 'You are a shop assistant in an English-speaking city (clothes shop, second-hand shop or supermarket, whichever fits the learner\'s goal). Be helpful and realistic, including store policies.',
    tasks: [['退一件买小了的外套，但小票丢了', 'return a jacket that is too small; they lost the receipt'],
      ['买一辆二手自行车，试着砍价', 'buy a second-hand bike and try to get a lower price'],
      ['超市里找不到一样东西，问店员', 'they cannot find something in the supermarket; ask an assistant'],
      ['给朋友挑生日礼物，预算有限', 'choose a birthday present for a friend on a small budget']] },
};
const chatTask = scen => { const t = SCEN[scen]?.tasks; return t ? t[Math.floor(Math.random() * t.length)] : null; };

function chatRules() {
  const sc = SCEN[CHAT.scen];
  const lvl = S.prefs.level === 'easy' ? 'Use simple, common words and short sentences (CEFR A2–B1).' : 'Use natural spoken English at about CEFR B2.';
  const chunks = CHAT.chunks || [];
  let p = LEARNER + '\n\nROLE-PLAY. ' + sc.role(CHAT.lesson);
  if (CHAT.task) p += "\nThe learner's goal in this scene: " + CHAT.task[1] + '. Stay in role and let them do the work of reaching it; do not solve it for them.';
  if (chunks.length) p += '\nThe learner is learning these chunks: ' + chunks.map(c => '"' + c.en + '"').join(', ') + '. Now and then ask something that gives them a natural chance to use one. Do not use them yourself before the learner does.';
  p += '\n' + lvl + ' Every reply, from the first to the last, is only the JSON object described below. Keep each reply to 1–3 short spoken sentences and end with one question, or with whatever the other person would naturally say next. '
    + 'About every third reply, do not end with a question: share a short opinion or experience of your own and stop, the way people do, so the learner has to react or ask you something to keep the conversation going. '
    + 'The learner uses speech-to-text, so ignore punctuation, capitalisation and small mishearings.';
  const move = ', "move": what the learner\'s LAST message did besides answering: "asked" if it asked you a real question (not just asking you to repeat), "reacted" if it responded to what you said (showed interest, agreed or disagreed, added to it, e.g. "Oh really? That sounds tough."), "answer" if it only answered; null when there is no learner message yet';
  if (S.prefs.chatFix === 'each') return p + '\nAfter every learner message reply with JSON: {"reply": "your next line in English", "reply_zh": "中文翻译"' + move + ', "feedback": null or {"better": "a more natural English version of the learner\'s LAST message", "note_zh": "中文一句，说明主要改动"}}. feedback is null when their message was already natural or there is no learner message yet. If the learner writes Chinese, put the English way to say it in feedback.better and set note_zh to "试着把这句英文读出来再接着聊".';
  return p + '\nDo NOT correct the learner and do NOT say their sentence back to them in better English: mistakes are discussed after the conversation, and being corrected every turn stops them talking. Behave like a real person. If you understood what they meant, even with mistakes, just carry on. Only when a message is genuinely unclear (a real listener would not be sure what they mean), ask the way a person would, e.g. "Sorry, do you mean the red one or the blue one?" or "I\'m not sure I follow. Could you say that another way?", without giving them a ready-made sentence to repeat. If they write Chinese, say kindly that you only speak English and ask them to try in simple English.'
    + '\nAfter every learner message reply with JSON: {"reply": "your next line in English", "reply_zh": "中文翻译", "unclear": true if this reply asks them to clarify or say it again because you did not understand, else false' + move + '}.';
}

/* Mark the learner's last message from the AI's reply: unclear if the AI had to ask; repair if it was understood
   right after an unclear one. Called by chatCall with the parsed JSON. */
function chatMarkUnclear(r) {
  const mine = CHAT.view.filter(v => v.role === 'me'), last = mine[mine.length - 1], prev = mine[mine.length - 2];
  if (!last) return;
  if (r?.unclear === true) last.unclear = true;
  else if (prev?.unclear) last.repair = true;
  if (['asked', 'reacted', 'answer'].includes(r?.move)) last.move = r.move;
}
const chatStats = () => { const me = CHAT.view.filter(v => v.role === 'me'); return { msgs: me.length, unclear: me.filter(v => v.unclear).length, repair: me.filter(v => v.repair).length, help: me.filter(v => v.help).length, asked: me.filter(v => v.move === 'asked').length, reacted: me.filter(v => v.move === 'reacted').length }; };
/* The last two learner messages only answered: time for a nudge to react or ask back. */
const chatOnlyAnswering = () => { const me = CHAT.view.filter(v => v.role === 'me'); return me.length >= 2 && me.slice(-2).every(v => v.move === 'answer'); };

/* 求助: the learner is stuck on what they just tried to say (English, broken English or Chinese). One cheap call. */
async function chatHelp(v) {
  const lastAi = [...CHAT.view].reverse().find(x => x.role === 'ai');
  const j = await aiText(LEARNER + '\n\nIn a role-play (' + SCEN[CHAT.scen].label + '), the partner said: "' + (lastAi?.en || '') + '"\nThe learner tried to answer (speech-to-text, may be broken English or Chinese):\n"' + v.text + '"\n'
    + 'Give the simple, natural spoken English for what they meant, short enough to say right away.\nJSON: {"better": "...", "zh": "这句英文的中文意思", "note_zh": "中文一句：关键的词或说法"}', { think: false });
  v.help = true;
  v.fb = { better: String(j?.better || ''), zh: String(j?.zh || ''), note: String(j?.note_zh || '') };
  save();
  return v.fb;
}

/* End-of-conversation review. In 不打断 mode this is where the corrections are: up to 5 of the learner's sentences
   most worth fixing, each with the reason, plus recurring patterns and chunks. Errors go into the error log. */
async function chatSummary() {
  const transcriptTxt = CHAT.view.map(v => (v.role === 'ai' ? 'Partner: ' + v.en : 'Learner: ' + v.text)).join('\n');
  const s = await aiText(LEARNER + '\n\nPractice conversation (' + SCEN[CHAT.scen].label + (CHAT.task ? '; learner\'s goal: ' + CHAT.task[1] : '') + '):\n---\n' + transcriptTxt.slice(-12000) + "\n---\nReview the LEARNER's English only. "
    + 'JSON: {"comment_zh": "中文，三句以内总评' + (CHAT.task ? '，包括任务有没有完成' : '') + '", '
    + '"fixes": [{"said": "one of the learner\'s sentences, exactly as written", "better": "how a fluent speaker would say it", "zh": "这句的中文意思", "why_zh": "中文一句"}], '
    + '"patterns": [{"issue_zh": "反复出现的问题", "example": "learner\'s words", "better": "corrected"}], '
    + '"chunks": [{"en": "multi-word chunk they could have used", "zh": "..."}]'
    + (CHAT.task ? ', "task": {"done": "yes" | "partly" | "no", "why_zh": "中文一句：根据对话里哪几句这样判断", "better": "only when not fully done: one natural English sentence, under 20 words, the learner could have said that would have got them there, else empty", "better_zh": "中文意思"}' : '') + '}. '
    + (CHAT.task ? 'Judge the goal strictly from what the learner actually said in the conversation; the partner doing the work for them does not count. ' : '')
    + 'fixes: the up to 5 sentences most worth fixing, the ones that would most confuse a listener first; skip sentences that were fine. At most 3 patterns, exactly 4 chunks.' + errPromptPart());
  if (s) {
    s.errKeys = errIngest(s.errors, 'AI 对话 · ' + SCEN[CHAT.scen].label);
    const mineText = CHAT.view.filter(v => v.role === 'me').map(v => v.text).join(' ');
    s.used = (CHAT.chunks || []).filter(c => chunkUsed(c.en, mineText)).map(c => c.en);
    s.stats = chatStats();
    // what they asked for help with, then the sentences most worth fixing, become cards
    const src = SCEN[CHAT.scen].label;
    s.cards = [...gapIngest(CHAT.view.filter(v => v.help && v.fb?.better).map(v => ({ en: v.fb.better, zh: v.fb.zh })), '求助', src),
      ...gapIngest((s.fixes || []).map(f => ({ en: f.better, zh: f.zh })), '改错', src)];
    if (CHAT.task && s.task && ['yes', 'partly', 'no'].includes(s.task.done)) {
      (S.chatTasks ||= []).push({ t: Date.now(), scen: CHAT.scen, task: CHAT.task[0], done: s.task.done });
      if (s.task.done !== 'yes' && s.task.better) s.cards.push(...gapIngest([{ en: s.task.better, zh: s.task.better_zh }], '任务', src));
      save();
    } else s.task = null;
  }
  return s;
}
