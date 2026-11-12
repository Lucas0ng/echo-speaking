# Rebirth 定位测试规格

目的：找出学习者"张口就来"断在哪一级，决定课程从哪里起步。约 10 分钟。只测"看中文提示、立刻说出英文句子"这一件事。

## 1. 题库 `static/placement.json`

```json
{
  "version": 1,
  "levels": [
    {
      "id": 1,
      "name": "A1",
      "can": "说出最基本的需要和事实",
      "items": [
        { "cue_zh": "我饿了。", "en": "I'm hungry." }
      ]
    }
  ]
}
```

6 级，每级 6 题，共 36 题。`en` 是参考答案之一，判分不要求和它一样。

| 级 | 名称 | 这一级考什么 |
| --- | --- | --- |
| 1 | A1 | be 动词、一般现在时、最基本的需要和问句（多少钱、在哪里） |
| 2 | A2 | 一般过去时、be going to、can、比较级、频率 |
| 3 | A2+ | 现在完成时、have to、because / so 说理由、现在进行时表安排 |
| 4 | B1 | 第一条件句、定语从句、转述别人的话、说明一个问题并提请求 |
| 5 | B1+ | 第二条件句、被动、should have、although / even though 让步 |
| 6 | B2 | 第三条件句、委婉表达不同意、抽象看法、推测（might have / must have） |

出题规则：`cue_zh` 是成年人日常或工作中真会说的话，自然的中文，不是逐词硬译；一句话，不超过 25 个字。`en` 是自然的美式口语，不超过 16 个词。同一级的 6 题覆盖上表里这一级的全部语法点，内容互不重复。不出谚语、俚语、专业术语。

## 2. 流程

入口：今天页的开始卡。`S.rb.place` 不存在时，卡片顶部显示一条提示"先做一次定位测试（约 10 分钟），决定从哪里学起"和「开始定位测试」按钮，同时保留「开始第 N 节」。做过之后，开始卡底部留一个不显眼的「重做定位测试」。

测试界面替换今天页的内容（由 `static/placement.js` 的 `renderPlacement(root)` 画，`renderCourse` 在 `PL.on` 为真时调用它）：

1. 顶部显示"定位测试 · 第 k 级 / 6 · 第 i 题 / 6"和一句规则："看到中文就开口，说完自动停。说不出就点「说不出」。"
2. 每题只显示 `cue_zh`。点「说」开始录音，用 `Rec.autoStop(12, 1.5)`（说完静 1.5 秒或满 12 秒自动停）。录完立刻进下一题，**不显示对错、不显示参考答案、不等识别**。识别在后台进行（`sttFull`，`kind: 'course'`，`meta: { seg: 'place', level, i }`），结果存进这一题的记录。
3. 「说不出」按钮：这一题记 0 分，进下一题。
4. 一级 6 题做完：等这一级的识别全部返回（显示"判分中…"），然后一次 AI 调用给 6 题判分（提示词见第 3 节）。
5. 算这一级的两个数：
   - **说得出** = `ok ≥ 1` 的题数
   - **张口就来** = `ok = 2` 且反应时间 ≤ 5 秒的题数。反应时间从题目出现算到开口出声（题目出现到点「说」的时间，加上 `sttFull` 返回的 `onset`），这样看了题想半天再点「说」不算张口就来。5 秒里含读中文和点按钮的时间
6. 说得出 ≥ 4 且还没到第 6 级：进下一级。否则测试结束。
7. 结果页：一张表，每级一行（级别、这一级考什么、说得出 x/6、张口就来 y/6、反应时间中位数）。结论一句话："张口就来稳在第 X 级，从第 Y 级的内容学起。"其中 Y = 第一个"张口就来 < 4"的级别；六级全部 ≥ 4 时 Y 记为 7，结论写"六级都张口就来，从成段表达学起"。表下面逐级列出每题：中文提示、你说的（识别文本）、参考答案、判分和 `note_zh`；英文用 `wordify` 可点词。
8. 存盘：`S.rb.place = { t, date, start: Y, levels: [{ id, said, fluent, onset, items: [{ ok, onset, text, note }] }] }`，`save()`。按钮「回到今天」。

定位测试不减倒计时。测试中途离开页面或刷新，进度不保留，重新开始。

## 3. 判分提示词

```
You are grading a spoken placement test for an adult Chinese learner of English.
For each item you get: the Chinese cue the learner saw, one reference answer (only one of many acceptable answers), and the speech-recognition transcript of what the learner said (may be empty).

Judge meaning and form, not wording. Any natural way of saying it is as good as the reference.
ok = 2: conveys the meaning of the cue in grammatical, natural-enough spoken English. Ignore punctuation, capitalisation, fillers, a self-correction, and tiny slips that speech recognition could have caused (a missing article, a plural -s).
ok = 1: a listener would get the meaning, but there is a clear error in grammar or word choice (wrong tense, wrong word order, a missing verb, a Chinese-style construction).
ok = 0: empty, unfinished, the meaning is wrong or a listener would not understand.

Items:
{每题一行：i. cue: … | reference: … | said: …}

Return JSON only: {"items": [{"i": 1, "ok": 0|1|2, "note_zh": "ok 小于 2 时用中文说问题在哪，不超过 20 个字；ok 为 2 时留空字符串"}]}
```

用 `aiText(prompt, { think: false })`。AI 调用失败时允许点「重试判分」，不丢已录的内容。「说不出」的题不发给 AI，直接 0 分。

## 4. 不做的

不显示分数百分比，不给"你的水平是 B1"这种标签，只说从哪一级学起。不测发音（已有发音体检）。
