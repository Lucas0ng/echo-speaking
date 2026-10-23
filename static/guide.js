'use strict';
/* 首次打开的引导 + 「怎么用」页 + 每页右上角的「?」。
文字都在这里；渲染也在这个文件（guideCard、renderHelp、togglePageHelp），app.js 只在 renderToday 和 setTab 里调用。

引导是「今天」页顶部的「开始使用」清单卡，不是弹窗：有一步要去别的页面做（基准录音在「进步」页），回来清单还在。
S.prefs.guided 为空时显示；点「开始第 1 课」或「收起」就记上日期，以后从「怎么用」页可以重新打开。
每一步都看真实状态打勾（读到课程、AI key 能用、录过基准录音），不是点了「下一步」就算完成。
*/

// One line per page: what you practise there and why. Shown by the page's 「?」 and on the help page.
const PAGE_HELP = {
  today: { zh: '今天', what: '每天的主课，按顺序做三步：逐句跟读 → 今日语块 → 开口说。', why: '先模仿原声把句子说顺，再学一个地道说法，最后不看稿用它说一段，学到的东西当天就用出来。' },
  retell: { zh: '4/3/2 复述', what: '同一段内容连说三遍，限时 4 分钟、3 分钟、2 分钟。', why: '内容不变、时间越来越紧，逼着你越说越顺。这是研究里最常用的流利度练法之一。' },
  solo: { zh: '自言自语', what: '60 秒不停说、看图描述、睡前复述今天。卡住的地方会自动做成卡片。', why: '没有对象也能开口。专练「不停下来」，不练准确。' },
  chunks: { zh: '语块本', what: '学过的语块按间隔复习：看中文，开口说出整句，本机 Whisper 判对错。红色数字是今天到期的条数。', why: '会认不等于说得出。每次都要求你说出来，复习间隔按你说得顺不顺调整。' },
  errors: { zh: '错误本', what: '从你的录音里挑出反复出现的错误，同时最多练 5 条，48 小时后复检，说对了就毕业。', why: '少而准：只盯你自己真犯的错，改掉一条算一条。' },
  pron: { zh: '发音', what: '先做一次发音体检，找出你分不清的音，再用专属的最小对立对练：先听辨，再跟读。', why: '目标是让人听得懂，不是追求口音。只练真正影响理解的那几个音。' },
  chat: { zh: 'AI 对话', what: '和 AI 聊课程话题，或者演练点餐、问路这类日常场景。', why: '对话中不打断、不纠错，听不懂时才让你换个说法；结束后统一给反馈，保住开口的节奏。' },
  progress: { zh: '进步', what: '你所有的录音，以及从录音里算出的语速、填充词、连贯语段；基准录音可以拿第 1 次和现在对比。', why: '进步靠录音和数字证明。这里不打分、不排等级，看的是趋势。' },
  settings: { zh: '设置', what: '填 AI 服务的 key、看字幕转写进度、选朗读声音。', why: '' },
};

// The fixed daily routine shown at the top of the help page.
const ROUTINE = [
  { when: '每天 · 约 15–20 分钟', items: [
    ['今天 › 逐句跟读', '约 10 分钟。听一句、跟一句，每句有一个练习重点（连读、重音或语调），说完自动比对。'],
    ['今天 › 今日语块', '约 5 分钟。听 BBC 原声学一个地道说法，用它说一句你自己的话。'],
    ['今天 › 开口说', '约 3 分钟。不看稿就本课话题说 1–2 分钟，AI 给出「你说的 vs 母语者会怎么说」。'],
    ['语块本、错误本', '左侧有红色数字时，花 2–3 分钟把到期的做完。'],
  ] },
  { when: '每周挑 2–3 次', items: [
    ['AI 对话', '找一个日常场景说 5 分钟。'],
    ['4/3/2 复述 或 自言自语', '换着做，专练流利。'],
    ['进步', '看一眼曲线，听一条一周前的录音。'],
  ] },
  { when: '每月一次', items: [
    ['基准录音', '同一道题录 1 分钟，到期时「今天」页顶部会提醒。和第 1 次放在一起听，最能听出变化。'],
  ] },
];

const TIPS = [
  '点任何英文单词都能查词典，例句用的是你自己说过的那句。',
  '所有录音、转写和进度只存在这台电脑的 data 文件夹里；备份这个文件夹就行。',
  '跟读、录音、指标都在本机完成，不需要 AI；讲解、点评和对话才需要 AI 服务的 key。',
  '页面卡住或出错时按 ⌘R 重新载入，不会丢进度。',
];

// Guide steps. `check` returns true when the step is really done; the renderer shows ✓ and lets you move on either way.
const GUIDE_STEPS = [
  { id: 'welcome', title: '欢迎使用回声',
    body: ['回声是一个逼你开口的英语口语练习软件，每天大约 15 分钟。', '三条原则：每一步都要你说出来；每次开口都自动录音存档；进步只看录音和真实数字，不打卡、不打分。', '下面 4 步把软件设置好，大约 3 分钟。'] },
  { id: 'lessons', title: '课程资料',
    body: ['课程音频来自你电脑里的雅思资料文件夹（IELTSCast 跟读 + BBC The English We Speak）。逐句字幕由本机 Whisper 在后台生成，不联网、不花钱。'],
    check: () => N > 0 },
  { id: 'ai', title: 'AI 服务（可以先跳过）',
    body: ['讲解句型、点评你说的话、AI 对话需要一个 AI 服务的 API key。推荐 DeepSeek：在 platform.deepseek.com 注册、充值几块钱、创建 API key，粘贴到下面。', 'key 只存在这台电脑上。跳过也能先练跟读和录音。'],
    check: () => !!STATUS.providers?.[STATUS.text_provider] && !GUIDE.keyBad },  // a saved key whose test just failed doesn't count
  { id: 'mic', title: '麦克风和第一条基准录音',
    body: ['先确认麦克风能用。然后录一条 1 分钟的基准录音：自我介绍。', '以后每个月录同一道题，拿来和这一次对比，这是最直观的进步证据。'],
    check: () => RECS.list.some(r => r.kind === 'baseline') },
  { id: 'start', title: '每天这样练',
    body: ['打开「今天」，按顺序做完三步：逐句跟读 → 今日语块 → 开口说。', '左侧有红色数字时，顺手把语块本和错误本里到期的做完。', '任何时候点右上角的「?」，或左侧的「怎么用」，都能看到说明。'] },
];

/* ================= 渲染 ================= */
/* GUIDE.open is only in memory: which step is expanded, the microphone result, and the AI test message. */
const GUIDE = { open: null, micOk: null, keyMsg: '', keyBad: false };
let HELP_FOCUS = null;
let HELP_POP = null;

const guideNext = id => {
  const i = GUIDE_STEPS.findIndex(s => s.id === id);
  return (GUIDE_STEPS[i + 1] || GUIDE_STEPS[i]).id;
};
function guideDefaultOpen() {
  if (!GUIDE_STEPS.some(s => s.check && s.check())) return 'welcome';
  const next = GUIDE_STEPS.find(s => s.check && !s.check());
  return next ? next.id : 'start';
}

function guideLessonsBody() {
  if (N > 0) return [h('p', { class: 'hint', text: '读到 ' + N + ' 课。本机字幕已生成 ' + STATUS.ielts_transcribed + ' / ' + STATUS.lessons + ' 集，其余在后台慢慢生成；第 1 课已经能用。' })];
  return [
    h('p', { class: 'hint', text: STATUS.lesson_error || '没有读到课程。' }),
    h('p', { class: 'hint', text: '打开项目文件夹里的 config.json，把 media_dir 改成资料文件夹的路径，然后退出并重新打开回声。' }),
  ];
}

function guideAiBody() {
  if (GUIDE_STEPS.find(s => s.id === 'ai').check()) {
    return [h('p', { class: 'hint', text: (GUIDE.keyMsg === '连接成功。' ? '连接成功，' : '') + '已经能用了。要换 key 或模型，去「设置」页。' })];
  }
  const sel = h('select', { 'aria-label': '选择 AI 服务' },
    [['deepseek', 'DeepSeek'], ['glm', 'GLM']].map(([v, label]) =>
      h('option', { value: v, selected: (STATUS.text_provider || 'deepseek') === v }, label)));
  const key = h('input', { class: 'text', type: 'password', placeholder: '粘贴 API key', autocomplete: 'off' });
  const btn = h('button', { class: 'btn primary' }, '保存并测试');
  btn.onclick = async () => {
    const value = key.value.trim();
    if (!value) { GUIDE.keyMsg = '先粘贴 key'; renderToday(); return; }
    const provider = sel.value;
    btn.disabled = true; btn.textContent = '测试中…';
    try {
      await post('/api/config', { text_provider: provider, providers: { [provider]: { api_key: value } } });
      await post('/api/config/test', { provider });
      GUIDE.keyMsg = '连接成功。'; GUIDE.keyBad = false;
    } catch (e) {
      GUIDE.keyMsg = e.message + '（可以去「设置」页检查模型名和接口地址）'; GUIDE.keyBad = true;
    }
    try { STATUS = await api('/api/status'); } catch {}
    renderToday();
  };
  return [
    h('div', { class: 'guide-ai' },
      h('div', { class: 'row' }, sel, h('button', { class: 'btn ghost', onclick: () => { GUIDE.open = guideNext('ai'); renderToday(); } }, '先跳过')),
      key,
      h('div', { class: 'row' }, btn),
      GUIDE.keyMsg ? h('p', { class: 'hint', text: GUIDE.keyMsg }) : null),
  ];
}

function guideMicBody() {
  if (GUIDE_STEPS.find(s => s.id === 'mic').check()) {
    return [h('p', { class: 'hint', text: '已经录好第 1 条基准录音。大约 4 周后「今天」页会提醒你再录。' })];
  }
  const msg = h('p', { class: 'hint' });
  if (GUIDE.micOk === true) msg.textContent = '麦克风可以用。';
  else if (typeof GUIDE.micOk === 'string') msg.textContent = '麦克风打不开：' + GUIDE.micOk + '。在系统设置 › 隐私与安全性 › 麦克风里允许回声。';
  const test = h('button', { class: 'btn' }, '测试麦克风');
  test.onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      GUIDE.micOk = true;
    } catch (e) { GUIDE.micOk = e.message; }
    renderToday();
  };
  return [
    h('div', { class: 'row' }, test, h('button', { class: 'btn primary', onclick: () => setTab('progress') }, '去录基准录音')),
    msg,
  ];
}

function guideStartBody() {
  return [h('button', { class: 'btn primary', onclick: () => { S.prefs.guided = today(); save(); renderToday(); window.scrollTo({ top: 0 }); } },
    S.prefs.cur > 1 ? '开始今天的课' : '开始第 1 课')];
}

function guideStepBody(step) {
  const box = h('div', { class: 'guide-body' });
  for (const p of step.body || []) box.append(h('p', { class: 'hint', text: p }));
  const extra = step.id === 'lessons' ? guideLessonsBody()
    : step.id === 'ai' ? guideAiBody()
    : step.id === 'mic' ? guideMicBody()
    : step.id === 'start' ? guideStartBody() : [];
  box.append(...extra.filter(Boolean));
  return box;
}

function guideCard() {
  if (S.prefs.guided) return null;
  if (GUIDE.open == null) GUIDE.open = guideDefaultOpen();
  const remaining = GUIDE_STEPS.filter(s => s.check && !s.check()).length;
  const head = h('div', { class: 'guide-head row' },
    h('h2', { text: '开始使用' }),
    h('span', { class: 'hint grow', text: '还差 ' + remaining + ' 步' }),
    h('button', { class: 'btn ghost small', onclick: () => {
      S.prefs.guided = today(); save(); renderToday();
      alertBox('以后可以在左侧「怎么用」里重新打开。');
    } }, '收起'));
  const list = h('ol', { class: 'guide-steps' });
  GUIDE_STEPS.forEach((step, i) => {
    const done = !!(step.check && step.check());
    const open = GUIDE.open === step.id;
    const title = h('button', { class: 'guide-step-title', 'aria-expanded': String(open), onclick: () => { GUIDE.open = step.id; renderToday(); } },
      h('span', { class: 'guide-n' }, done ? ic('check') : String(i + 1)),
      h('b', { text: step.title }));
    const li = h('li', { class: 'guide-step' + (done ? ' is-done' : '') + (open ? ' is-open' : '') }, title);
    if (open) li.append(guideStepBody(step));
    list.append(li);
  });
  return h('section', { class: 'guide' }, head, list);
}

/* ================= 「怎么用」页 ================= */
function helpFocusKey() {
  if (HELP_FOCUS) { const k = HELP_FOCUS; HELP_FOCUS = null; return k; }
  const q = new URLSearchParams(location.search);
  const k = q.get('help');
  if (k) {
    q.delete('help');
    const qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }
  return k;
}

function renderHelp() {
  const root = $('#view-help'); if (root.hidden) return;
  const frag = [
    h('h2', { class: 'page-title', text: '怎么用' }),
    h('p', { class: 'intro', text: '每天 15 分钟左右。核心只有一件事：每一步都开口说出来。' }),
  ];
  const routine = h('section', { class: 'section' }, h('h2', { text: '每天怎么练' }));
  for (const group of ROUTINE) {
    routine.append(h('div', { class: 'help-group' },
      h('h3', { class: 'help-when', text: group.when }),
      h('div', { class: 'help-list' }, group.items.map(([name, desc]) =>
        h('div', { class: 'help-item' }, h('b', { text: name }), h('span', { class: 'hint', text: desc }))))));
  }
  frag.push(routine);
  const pages = h('section', { class: 'section' }, h('h2', { text: '每一页是做什么的' }));
  for (const [key, p] of Object.entries(PAGE_HELP)) {
    pages.append(h('div', { class: 'help-page', id: 'help-' + key },
      h('a', { href: '#' + key, onclick: e => { e.preventDefault(); setTab(key); } }, p.zh),
      h('p', { text: p.what }),
      p.why ? h('p', { class: 'hint', text: p.why }) : null));
  }
  frag.push(pages);
  frag.push(h('section', { class: 'section' }, h('h2', { text: '小技巧' }),
    h('ul', { class: 'tips' }, TIPS.map(t => h('li', { text: t })))));
  frag.push(h('div', { class: 'row' },
    h('button', { class: 'btn', onclick: () => { delete S.prefs.guided; save(); setTab('today'); } }, '重新显示开始使用清单')));
  root.replaceChildren(...frag);

  const want = helpFocusKey();
  if (want && PAGE_HELP[want]) {
    const row = document.getElementById('help-' + want);
    if (row) {
      row.scrollIntoView({ block: 'center' });
      row.classList.add('flash');
      setTimeout(() => row.classList.remove('flash'), 1500);
    }
  }
}

/* ================= 右上角的「?」 ================= */
function closePageHelp() {
  if (HELP_POP) { HELP_POP.remove(); HELP_POP = null; }
  const btn = document.getElementById('pageHelp');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function togglePageHelp(force) {
  const btn = document.getElementById('pageHelp'); if (!btn) return;
  if (force === false) { closePageHelp(); return; }
  if (HELP_POP) { closePageHelp(); return; }
  if (TAB === 'help' || btn.hidden) return;
  const p = PAGE_HELP[TAB];
  if (!p) return;
  const pop = h('div', { class: 'help-pop', role: 'dialog', 'aria-label': p.zh + '怎么用' },
    h('b', { text: p.zh }),
    h('p', { text: p.what }),
    p.why ? h('p', { class: 'hint', text: p.why }) : null,
    h('a', { class: 'help-more', href: '#help', onclick: e => {
      e.preventDefault();
      const key = TAB;
      closePageHelp();
      HELP_FOCUS = key;
      setTab('help');
    } }, '完整说明'));
  $('.main').append(pop);
  HELP_POP = pop;
  btn.setAttribute('aria-expanded', 'true');
}

document.getElementById('pageHelp')?.addEventListener('click', e => { e.stopPropagation(); togglePageHelp(); });
document.addEventListener('click', e => {
  if (!HELP_POP) return;
  if (e.target.closest && (e.target.closest('#pageHelp') || e.target.closest('.help-pop'))) return;
  closePageHelp();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && HELP_POP) closePageHelp(); });
