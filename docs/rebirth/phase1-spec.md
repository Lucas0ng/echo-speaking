# Rebirth 第 1 期规格：课程骨架

方案见 `PLAN.md`。这一期只做：课程数据、一节课的运行器、倒计时。不做定位测试、听辨训练、里程碑实测、课外输入（后面几期）。

## 1. 课程数据 `static/course.json`

```json
{
  "version": 1,
  "total": 3000,
  "milestone": 30,
  "stages": [
    { "id": 1, "name": "发声", "from": 3000, "to": 2880, "can": "A1–A2 的句子不假思索" }
  ],
  "units": [
    {
      "id": "s1-u01",
      "stage": 1,
      "title": "点一杯咖啡",
      "can": "能在咖啡店点单，并回答店员的追问",
      "sound": {
        "title": "词重音",
        "note_zh": "英语的每个多音节词有一个音节更响、更长、音更高，其余的轻而短。重音放错，对方会听不出是哪个词。",
        "link": { "label": "Rachel's English：Word Stress", "url": "" },
        "items": [
          { "text": "coffee", "mark": "COF-fee" },
          { "text": "banana", "mark": "ba-NA-na" },
          { "text": "I'd like a coffee, please.", "mark": "I'd LIKE a COF-fee, PLEASE." }
        ]
      },
      "pattern": {
        "frame": "I'd like ..., please.",
        "note_zh": "点东西、提要求时最常用的说法，比 I want 客气。I'd 是 I would 的缩写，读成一个音节 /aɪd/。",
        "sentences": [
          { "cue_zh": "我要一杯咖啡。", "cue_en": "coffee", "en": "I'd like a coffee, please." }
        ],
        "swaps": [
          { "cue_zh": "换成：两张去机场的票", "cue_en": "two tickets / airport", "en": "I'd like two tickets to the airport, please." }
        ]
      },
      "task": {
        "scene_zh": "你在咖啡店柜台。点一杯喝的和一样吃的，店员会追问大小和在这喝还是带走。",
        "role": "You are a barista at a small coffee shop. Take the customer's order. Ask about size, and whether it is for here or to go.",
        "opener": "Hi there! What can I get for you?",
        "goal_zh": "点到一杯喝的和一样吃的"
      }
    }
  ]
}
```

字段规则：

- `sound.items`：3–5 条，由词到句，最后一条必须是本单元句型里的一句。`mark` 用大写表示重读音节，连读用 `‿`，停顿用 ` / `。
- `sound.link.url`：只能填 `docs/rebirth/reports/C-gemini.md` 或 `C-deepseek.md` 里出现过的网址；没有合适的就留空字符串，界面不显示链接。不许编网址。
- `pattern.sentences`：5–6 句；`pattern.swaps`：2–3 句（同一句型换内容）。每句不超过 12 个词，用最常见的口语词。`cue_zh` 是自然的中文，不是逐词翻译；`cue_en` 是 1–3 个英文要点词。
- `task.role` 和 `task.opener` 用英文；任务必须自然地需要用到 `pattern.frame`。
- 一个单元 = 一节课的新内容。

## 2. 进度 `S.rb`

```js
S.rb = {
  n: 0,            // 做完的节数。倒计时 = course.total - n
  unit: 0,         // 下一节要上的单元在 units 里的下标
  log: [],         // 每节一条：{ t, date, unit, secs, hits, wpm }
  cur: null        // 进行中的一节：{ unit, seg, date }，刷新后从这一段的开头接着上
}
```

- `boot` 载入进度的字段名单里要加 `rb`，否则下次保存会丢。
- `S.days[日期].rb = true` 表示当天上过课；`DAY_FLAGS` 和 `FLAG_ZH`（"课程"）里各加一项。
- 不读写 `S.prefs.cur`、`S.lessons`、`S.cards`。

## 3. 一节课的流程

五段按顺序走，每段有时间预算和计时条。计时只在这一段处于活动状态、且没有在等识别或等 AI 时走。内容提前做完可以进下一段；时间到了，做完手上这一条就进下一段。

| 段 | id | 预算 | 内容 |
| --- | --- | --- | --- |
| 回忆 | `recall` | 4 分钟 | `dueList()` 里到期的卡，最多 8 张。每张：显示中文 → 点「说」录音 → 识别 → 显示英文原句和红绿对比、朗读原句 → 按 `align` 分数自动评分（≥0.9 且开口快记 3，≥0.75 记 2，≥0.5 记 1，否则 0）→ `schedule` 写回。没有到期卡时显示一句"今天没有到期的旧句子"，直接进下一段。 |
| 声音 | `sound` | 3 分钟 | 显示 `sound.title`、`note_zh`、链接。逐条 `items`：显示 `mark` → 点「听」用 `say(text)` 朗读 → 点「说」录音 → 识别后用 `diffView` 显示。每条说一次即可过。 |
| 新句 | `pattern` | 6 分钟 | 显示 `frame` 和 `note_zh`。逐句 `sentences`：只显示 `cue_zh`，英文藏着 → 点「说」先说 → 识别 → 揭开 `en`、红绿对比、朗读 → 再说一遍（这次看不到英文，只看 `cue_en`）。然后逐句 `swaps`：只显示 `cue_zh` → 说 → 揭开。 |
| 用 | `use` | 9 分钟 | 显示 `scene_zh` 和 `goal_zh`，不显示任何英文句子。AI 先说 `opener`（朗读）。用户每轮点「说」录音 → 识别 → 发给 AI（提示词见第 4 节）→ 显示并朗读 AI 的回话。界面上有"用上今天的句型：n / 2"。AI 返回 `slip` 时先不显示正确说法，只显示 `hint_zh`，让用户重说这一句（最多 2 次），说对或用完次数后显示 `fix`，并 `addChunk(fix, said 的中文意思留空用 hint_zh, 'Rebirth 纠错')`。时间到且 n ≥ 2 才能进下一段；n < 2 时继续，直到够 2。 |
| 快 | `fast` | 3 分钟 | 提示"把刚才那段对话里你做了什么，60 秒讲一遍，不停"。`timedRec` 60 秒 → 识别（带流利度指标）→ 用 `metricsView` 显示语速和停顿，旁边列上一节这一段的数。 |

做完五段：

1. `S.rb.n += 1`，`S.rb.unit += 1`，`S.rb.cur = null`，写一条 `log`。
2. 本单元 `pattern.sentences` 和 `swaps` 的每一句 `addChunk(en, cue_zh, 'Rebirth ' + unit.id)`，进语块本，之后在回忆段出现。
3. `markDay('rb')`。
4. 显示收尾卡：倒计时的新数字、离下一个里程碑还有几节、今天开口的总秒数、「再上一节」按钮。

单元用完了（`S.rb.unit >= units.length`）：今天页显示"新单元还在做"，并提供只做回忆段的按钮；只做回忆不减倒计时。

所有录音走 `sttFull(blob, ref, { kind: 'course', line: 'daily', meta: { unit, seg } })`。后端 `KINDS` 加 `"course"`，不进 `CURVE_KINDS`。

## 4. 「用」段的提示词

系统消息（`{…}` 处填单元数据）：

```
You are playing a role in a short spoken role-play with an adult Chinese learner of English (speaking level about A2).
Your role: {task.role}
The learner's goal: {task.goal_zh}
Target pattern the learner is practising today: "{pattern.frame}"
Example sentences the learner has already drilled (repeating one of these does NOT count as new):
{pattern.sentences 和 swaps 的 en，每行一句}

Rules for your reply:
- Stay in role. One or two short sentences, everyday words only. End with a question or a prompt that keeps the learner talking.
- Create natural chances to use the target pattern, but never say the pattern for them and never correct them inside your reply.
- The learner's text comes from speech recognition: ignore punctuation, capitalisation and obvious recognition noise.

After each learner turn, return JSON only:
{
  "reply": "your next line in role",
  "used": true or false,   // true if this turn contains a sentence built on the target pattern whose wording is not identical to an example sentence; a different object or detail is enough
  "slip": null or { "said": "the learner's faulty sentence", "hint_zh": "用中文提示哪里不对，不给出正确说法，不超过 25 个字", "fix": "the corrected sentence" },
  "done": true or false    // true when the learner's goal has been reached
}
Report at most one slip per turn. A slip is either (a) a mistake that would confuse a listener, or (b) the learner saying something the target pattern is made for but in another, cruder way: then hint_zh nudges them to use today's pattern and fix is their sentence rebuilt on the pattern. Small article or plural mistakes that recognition may have caused are not slips.
```

对话历史按轮传；AI 之前的回话要包成 `{"reply": "…"}` 再传回去，直接传纯文本的话模型从第二轮起就不再返回 JSON（实测）。重说之后判对错：把重说的识别结果和 `fix` 用 `align` 比，分数 ≥ 0.8 算改对。

## 5. 界面接入

- 侧栏顶部副标题（`#subline`）：`还剩 2999 节 · 离里程碑 29 节`。
- 「今天」页（`#view-today`）改由 `static/course.js` 的 `renderCourse()` 画。
- 旧的雅思课程保留：导航里在「我的素材」前面加一项「雅思跟读」（`#ielts`，`#view-ielts`）。现有的 `renderToday` 函数名不改，只把它取的根节点从 `#view-today` 换成 `#view-ielts`，`setTab` 的映射改成 `today: renderCourse, ielts: renderToday`。这样旧代码里所有对 `renderToday()` 的调用都不用动。
- `rerenderOwner`：owner 以 `rb` 开头时调用 `renderCourse()`。新课程里所有录音的 owner 都以 `rb` 开头。
- 开始使用的引导卡 `guideCard()` 在新的今天页顶部照样显示。
- 样式沿用现有的类名（`btn`、`notice`、`tag`、`hint`、`row`、`grow`、`mono`、`seg`），新增的样式写在 `style.css` 末尾，类名以 `rb-` 开头。
