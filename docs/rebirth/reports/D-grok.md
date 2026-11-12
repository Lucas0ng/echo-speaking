调研者：Grok；日期：2026-11-12

状态：完成

## 结论小结

新课程可以旁路接上，录音、识别、点评、语块本和错误本不用重写。课程顺序只集中在一条链上：`app.py` 的 `build_lessons()` 产出「一集雅思音频 = 一课」，前端用 `S.prefs.cur` 当 1 起的下标，`renderToday` 固定走跟读、语块、开口说三步。

最少改四处就能让「今天」改跑新课程，同时「我的素材」「语块本」「错误本」保持原样：`index.html` 加一个脚本，`boot` 在没有雅思音频时也放行，`renderToday` 开头把页面交给 `course.js`，顶栏那句「第 n 课」改读新课程。新单元用新的进度键，不要复用 `S.lessons` 和 `S.cards` 的数字课号，也不要改写 `S.prefs.cur`，否则旧的完成标记和「今日话题」会错位。

换课之后仍然有意义的，是语块本、错误本、发音记录、自我修正、全部录音文件，以及声音和语速这些偏好。按课号记的完成情况和 BBC 讲解只对旧课号有意义，留着当历史，不要映射到新单元。

## 1. 功能清单

前端没有框架。页面壳在 `static/index.html`（第 41–51 行各页 `data-view`），脚本按 `chart.js` → `errors.js` → `words.js` → `sentences.js` → `minpairs.js` → `pron.js` → `pitch.js` → `review.js` → `gaps.js` → `nouns.js` → `solo.js` → `chat.js` → `guide.js` → `evidence.js` → `app.js` 的顺序加载。业务页面几乎都画在 `static/app.js`；算法和提示词拆在同目录的小文件里。后端入口都在 `app.py`。`windows/` 是独立副本，这次没读。

行号按 2026-11-12 这份工作区的源码。

### 跟读

- `static/app.js` `class Shadow`（424–654）：一集字幕逐句跟读。`record`（439）录音并在说完停顿后自动停；`check`（515）走 `sttFull`，`kind: 'shadow'`，再用 `align`（328）对原文打匹配分；`runAuto`（551）连续跟读；`renderBooth`（585）画出原声、跟读、比对、语调、发音点评、拆句型。
- 今天页第 1 步 `buildStep1`（855–883）：用课程文件 `L.f` 建一个 `Shadow`。跟读满 5 句调用 `markLesson(n, 'sh')`。
- 第 2 步里 BBC 原声命中句也会再建一个 `Shadow`（901–903），不记完成。
- 「我的素材」用同一个 `Shadow` 跟读用户自己的音频（见第 11 节）。
- 每句练习重点在 `static/pron.js`：`FOCUS_KINDS`（18，连读 / 重音 / 语调 / 断句轮换），`shadowFocus`（33–48）向 AI 要 8 句一批并缓存。`Shadow.renderBooth`（588–597）在当前句调用它；语调类重点会自动打开曲线。
- 跟读分数存档在 `static/pitch.js`：`shRecord`（52）写入 `S.shadow[path][i]`，`shHistory`（53）、`shFileStats`（55）。界面回看是 `shHistoryView`（`app.js` 373）。
- 词级红绿对比：`align`（328）、`diffView`（344）。
- 字幕：前端 `transcript`（658）请求 `GET /api/transcript?ensure=1`；后端 `api_transcript`（`app.py` 1034）、`transcribe_file`（660）、`to_sentences`（266）。

### 语调对比

- `Shadow.pitchLoad`（457–474）同时取原声句和这次录音的基频，`pitchContour` 换成相对自己中位数的半音，`pitchVerdict` 只比句末走向。`pitchView`（497–514）用 `pitchSvg`（352–372）画两条线。
- `static/pitch.js`：`pitchOfSegment`（11，原声，`GET /api/pitch/media`）、`pitchOfBlob`（20，用户录音，`POST /api/pitch`）、`pitchContour`（25）、`pitchEnd`（33）、`pitchVerdict`（43）。
- 后端 `pitch_track`（`app.py` 395）每 10 ms 一个 f0；接口是 `api_pitch`（1144）和 `api_pitch_media`（1155，按秒切课程音频）。

### 开口说点评

- 今天页第 3 步 `buildStep3`（949–1005）出题、限时说、转写、内容点评、听发音。
- `speakRec`（1009–1026）录音，`sttFull` 的 `kind: 'talk'`，满 15 个词（`SP_MIN_WORDS`，1006）才 `markLesson(n, 'sp')`。指标进 `st.metrics`，卡壳点进 `st.stuck`。
- 内容点评按钮（964–976）一次 AI 调用里收：总评、改正版、更地道说法、先改一处、语块、是否用上今日语块，并接上 `gapPromptPart`、`nounPromptPart`、`errPromptPart`。返回后 `errIngest` / `gapIngest` / `nounIngest` 自动入错误本和语块本；`natural` 写进 `S.lessons[n].natural`，留给下次热身对照。
- 先改再看答案：`repairJudge`（1040）、`repairEnd`（1046，写入 `S.repairs`）、`repairCard`（1052）。通过或放弃后 `renderReview`（1083）才展开全文。`renderAudioReview`（1096）画「听发音和流利度」（`aiAudio`，977）。
- 逐句精析按钮（988–1001）调用 `static/sentences.js` `analyzeSentences`（56），界面是 `analysisView`（`app.js` 1368）。句型卡 `toggleTemplateCard`（`sentences.js` 70）。
- 流利度数字本身在后端 `fluency`（`app.py` 454）：语速、每百词填充词、平均连贯段。`garbled`（495）丢掉 Whisper 打转的结果。

### 4/3/2

- `static/app.js` `PLANS`（2162，完整 240/180/120 秒，短版 120/90/60）、`recordRound`（2164）、`retellReview`（2181，第 3 遍里值得换说法的句子经 `gapIngest` 入卡，来源标「复述」）、`renderRetell`（2198）。页是 `#view-retell`。
- 录音 `kind: 'r432'`。进步曲线只用第 1 遍（`inCurve`，269：后两遍是同一段压缩，不进趋势）。

### 自言自语

- 规则在 `static/solo.js`：`SOLO_MODES`（10，60 秒不停说 / 看图描述 / 睡前复述今天）、`soloReview`（68，可选内容点评）、`soloGapCards`（84）、`soloTrend`（92）。
- 页面在 `app.js`：`renderSolo`（2281）、`soloRecord`（2402）。录音 `kind: 'solo'`，`meta.mode` 区分三种。60 秒不停说只看停顿，不评内容；停顿由后端 `stop_metrics`（`app.py` 538，静音 ≥ 2 秒）和 `stuck_points`（551）算。看图的照片只留在浏览器里，不上传（`solo.js` 第 8–12 行的说明）。

### 语块本和间隔复习

- 入库：`addChunk`（`app.js` 142）。同一句英文去重。字段是 `en, zh, src, t, due, ivl, ease, reps`，有原声时加 `clip: { path, s, e }`。
- 调度：`schedule`（156）。0 忘了（10 分钟后再来）、1 模糊、2 想起来了、3 脱口而出。到期列表 `dueList`（155），角标 `updateBadge`（165）。
- 复习页 `renderChunks`（1457–1576，`#view-chunks`）。短语句块走「看中文、用它造新句」：判定在 `static/review.js` `chunkUsed`（21）、`chunkJudge`（32）、`chunkGrade`（40）。整句卡是说原句；单词卡是说整句（见点词词典）；句型卡看中文加骨架；名词卡看动词式中文 cue（`static/nouns.js` `addNounCard` 44，`nf: { line, cue }`）。
- 自动入卡的另一路是 `static/gaps.js` `gapIngest`（25）：卡壳、求助、改错、任务、复述，每次最多 4 张。
- 导出：`app.py` `anki_rows`（1296）、`POST /api/export/anki`（1323）。

### 错误本

- 数据在 `static/errors.js`：`errIngest`（37）合并 AI 找到的错误，`errPromote`（23）保证活跃不超过 5 条，`errDueList`（53）到 48 小时复检，`errJudge`（76）判这次说对没有，`errRecord`（97）记尝试，通过则毕业。
- 页面 `renderErrors`（`app.js` 1598–1742，`#view-errors`）。开口说、对话总结、4/3/2、自言自语点评都会把 `errPromptPart`（`errors.js` 28）接进同一次 AI 调用。

### 发音体检和最小对立对

- 对立对词表：`static/minpairs.js` `CONTRASTS`（从第 3 行起）。
- 诊断和练习逻辑在 `static/pron.js`：`pronTestRounds`（60）体检轮次，`pronParse`（85）判听成了哪个词，`pronEnrich`（133）从平时跟读里补混淆（注释写明这一路），`pronListenTrial`（164）听辨，`pronSayTrial`（178）跟读产出，`pronRecord`（180）写入 `S.pron.drills`，`pronStats`（185）。
- 页面全在 `app.js` `PR`（1743）到 `renderPron`（2000–2023）：`pronStartTest`（1755）、`pronTestView`（1760）、`pronListenView`（1891）、`pronSayView`（1944）。系统语音读词，Whisper 判产出；`ASR_UNRELIABLE`（`pron.js` 53）里的词只用于听辨。

### AI 对话

- 场景和提示词在 `static/chat.js`：`SCEN`（19，今日话题、介绍研究、组会汇报、点餐等）、`chatRules`（80）、`chatHelp`（110）、`chatSummary`（122，结束时判任务、收错误和该改的句子）。任务结果推进 `S.chatTasks`（约 142 行）。
- 界面在 `app.js`：`CHAT`（2024）、`chatCall`（2027）、`renderChat`（2056–2161）。两种反馈记在 `S.prefs.chatFix`：`end` 对话中不改错，`each` 每轮给一句更自然的说法（`chat.js` 4–7 行）。

### 进步页

- 计数在 `static/evidence.js`：`chunkUses`（34）自由说话里自发用出的语块，`weekSummary`（46）一周里某类错误少了多少、自我修正、练了几天，`milestones`（94），`evidenceSection`（114）拼成页面块。自由说话种类是 `talk / solo / r432 / baseline / chat`（第 3 行）。
- 页面 `renderProgress`（`app.js` 2470–2519）。曲线点 `curvePoints`（2422），同题基准 `recordBaseline`（2430）和 `baselineCard`（2448）。固定题目在 `BASELINES`（305），至少隔 28 天再录。图由 `static/chart.js` 画。
- 指标来自已存录音，不另打一个「流利度百分比」。哪些录音进曲线由前端 `inCurve`（269）和后端 `CURVE_KINDS`（`app.py` 566）一起卡：自由独白、非胡话、4/3/2 只取第 1 遍、热身不算。

### 我的素材

- 前端 `loadMine`（1108）、`renderMine`（1123）、`mineStatus`（1116）、`myPoll`（1201）。跟读仍用 `Shadow`，和课程完成标记无关。
- 后端 `my_dir`（727）、`materials`（731）、`GET/POST /api/materials`（1063、1075）、`POST /api/materials/reveal`（1098，在访达里打开文件夹）。音频落在资料目录的 `我的素材/`，字幕仍进 `data/transcripts/`。

### 点词词典

- `static/words.js`：`dictLookup`（12）查 `GET /api/dict`，`wordSense`（20）问这句里的意思和搭配（可磁盘缓存），`wordify`（41）把英文词变成可点的 `<span class="w">`，`toggleWordCard`（54）把整句做成挖空卡放进 `S.srs`。
- 弹层在 `app.js`：`openWordCard`（1250）、`closeWordCard`（1216）、`positionWordPop`（1224）。跟读句、开口说转写、点评改正版都会套 `wordify`。
- 后端词典：`dict_lookup`（935）、`api_dict`（1017），数据来自本机离线词库，不把词发到网上。

## 2. 状态结构

持久进度是前端对象 `S`，整份 POST 到 `/api/state`，落在 `data/progress.json`。录音不在这份 JSON 里，在 `data/recordings/`。当前这一课的输入框、转写、点评、录音 blob 在内存对象 `LP` 里，刷新就没了。

### `S` 的字段

定义在 `static/app.js` 第 75 行。启动时 `boot`（2574–2588）用 `GET /api/state` 覆盖这些键，再 `Object.assign` 进 `prefs`。`save`（79–84）在进度载入之后才允许写，400 ms 防抖，POST 整个 `S`。

| 字段 | 存什么 | 谁写 | 谁读 |
| --- | --- | --- | --- |
| `days` | 按日期 `YYYY-MM-DD`。开口标记：`sh ph sp rv rt bl er pr so wu` 为 `true`；`ch` 是对话次数（数字，可累加）。 | `markDay`（87）。课内步骤经 `markLesson`（89）顺手标当天。复习打分标 `rv`（1535），热身说够标 `wu`（804），其余页各自 `markDay`。 | `active`（99）、`level`（105）、顶栏 `renderHeader`（676）、收尾加练 `pickExtra`（830）、进步页 `weekSummary`（`evidence.js` 46）。 |
| `lessons` | 键是课号字符串。值：`sh/ph/sp` 为做过；`d.步骤` 是该步最后开口的日期；`skip.步骤` 是没说就跳过的日期；`at` 是整课第一次做完的日期；`natural` 是开口说点评里的地道说法（最多 1200 字）。 | `markLesson`、`skipLesson`（97）、`buildStep3` 把 `natural` 写回去（972）。 | `lessonDone`（107）、`renderToday`（739）、热身 `warmupSource`（784）、进步页「完成了几课」。 |
| `srs` | 语块本，一张卡一个 id。公共字段：`en zh src t due ivl ease reps`。变体：单词卡多 `cloze word mine`；句型卡多 `tpl tplZh`；名词卡多 `nf: { line, cue }`；有原声则多 `clip: { path, s, e }`。 | `addChunk`（142）、`toggleWordCard`（`words.js` 54）、`toggleTemplateCard`（`sentences.js` 70）、`addNounCard`（`nouns.js` 44）、`gapIngest`（`gaps.js` 25）。复习打分用 `schedule`（156）换一张新对象写回（1535）。删除在星标再点、语块本删除钮。 | `dueList`（155）、`renderChunks`（1457）、`evidence.js` 的语块计数、对话 `recentChunks`（`solo.js` 56）。 |
| `cards` | 键是课号。BBC 语块讲解：`meaning_zh register note_zh examples[{en,zh}]`。 | 只在第 2 步生成讲解时写（915）。 | `buildStep2`（890）、`renderCard`（1027）。 |
| `errs` | 键是错误 slug。字段见 `errors.js` 第 4–12 行：`key cat title_zh rule_zh status seen[] tries[] drills[] due t act grad`。`status` 为 `queued` / `active` / `done`，活跃最多 5 条。 | `errIngest`（37）、`errDrills`（57）、`errRecord`（97）、错误本里的删除（`app.js` 1589）。 | `errDueList`（53）、`renderErrors`（1598）、`weekSummary` 里的错误增减。 |
| `pron` | `{ tests: [{ t, items }], drills: { [对比 id]: [{ t, mode, word, ok, heard? }] } }`。`tests` 是体检，`drills` 是听辨和跟读。 | `pronSaveTest`（`pron.js` 143）、`pronRecord`（180）。 | `pronStats`（185）、`renderPron`（2000）。 |
| `shadow` | `S.shadow[音频路径][句序号] = [{ t, score }]`，该句每次 Whisper 匹配分，旧的在前。 | `shRecord`（`pitch.js` 52），只在识别到字时记。 | `shHistory`、`shFileStats`、跟读列表上的「上次百分比」。 |
| `repairs` | 自我修正记录，最多 500 条：`{ t, src, original, better, said, fixed, tries }`。 | `repairEnd`（1046）。 | `evidence.js` 的自我修正次数和里程碑（72、99 行附近）。 |
| `chatTasks` | `{ t, scen, task, done }`，`done` 为 `yes` / `partly` / `no`。对话正文不进这里。 | `chatSummary`（`chat.js` 142）。 | 里程碑「完成一个任务」（`evidence.js` 107）。 |
| `prefs` | 见下表。默认值在第 75 行；`focus`、`chatFix`、`guided` 是用的时候才出现的。 | 设置页、跟读开关、对话场景条、引导卡。 | 几乎每个说话页面。 |

`prefs` 各键：

- `cur`：当前课号，从 1 起，对应 `LESSONS[cur - 1]`。`goLesson`（1103）写，`renderToday` 和顶栏读。
- `voice`、`ttsRate`：系统朗读声音和语速。`say`（120）读，设置页（2564）写。
- `autoSpeak`：AI 对话是否自动朗读。默认 true。
- `level`：`easy` / `normal`，对话用词难度（`chat.js` 82）。
- `rate`：跟读原声播放速度，0.75 / 0.85 / 1。
- `blind`：盲跟，跟读前藏原文。
- `focus`：缺省或 `true` 表示每句一个练习重点；设成 `false` 关掉。判断写成 `S.prefs.focus !== false`。
- `chatFix`：`end`（默认，不打断）或 `each`。
- `guided`：做过开始使用清单的日期。`guide.js` 读写。

不进 `S`、刷新即失的会话状态：`LP[课号]`（715：这一步停在哪、造的句子、开口说转写、点评、blob）、`CHAT` 的对话轮次、`RT` 的 4/3/2 轮次、`SO` 的自言自语、`WU` 的热身结果、`SHADOWS` 里已录但还没存档的跟读、`PR` 的发音页进行中的一轮。这些丢了不影响已 `save()` 或已 POST `/api/stt` 的部分。

### `/api/state` 怎么存、怎么备份

- 读：`api_state`（`app.py` 1265）。文件在就原样返回 `data/progress.json`，没有则 `{}`。
- 写：`api_state_save`（1272）。先算 `state_size`（1247）：`days lessons srs cards errs shadow` 的条数，加上 `pron.tests` 的条数。`repairs` 和 `chatTasks` 不计入。已有进度的 size ≥ 10，而这次不足原来一半，返回 409，不覆盖。文件读不出来时，改名为 `data/backups/progress-unreadable-<时间戳>.json`，不直接盖掉。
- 备份：`state_backup`（1252）。当天第一次成功保存前，把**上一份** `progress.json` 复制成 `data/backups/progress-YYYY-MM-DD.json`。同一天后续保存不再覆盖这份日备。只留最新 30 个按文件名排序的 `progress-数字*.json`。
- 写入是先写 `progress.tmp` 再替换，避免写到一半。

前端载入只认上面那 9 个键加 `prefs`（2579）。文件里若有别的顶层键，下次 `save()` 会丢掉，因为 POST 的是内存里的 `S`。

### 录音元数据

一次带 `kind` 的 `POST /api/stt`（1113）会调用 `save_recording`（584）。文件是 `data/recordings/<id>.webm`（或 m4a/ogg/wav）和同名 `.json`。列表接口只返回摘要，去掉 `words`（`rec_summary`，571）。

JSON 字段：

- `id`：`YYYYMMDD-HHMMSS-` 加 4 位十六进制。
- `t`：毫秒时间戳。`date`：当天日期。
- `kind`：`talk | baseline | r432 | solo | chat | shadow | chunk | review | pron`（`KINDS`，567）。
- `line`：`daily` 或 `academic`。
- `meta`：前端随这次录音附的小对象，见下。超过约 4000 字符或不是对象就存 `{}`。
- `audio`：音频文件名。`duration`：秒。
- `text`：转写。`words`：`[词, 开始秒, 结束秒, 概率]`，`word_list`（360）。
- `metrics`：`fluency`（454）的 `words fillers pauses span wpm fillers_per100 pauses_per100 mlr reliable garbled`。`kind === 'solo'` 时再并上 `stop_metrics`（538）：`stops stopped_s flow_s longest_s`。
- `stuck`：只对自由独白且不是胡话：`[{ at, secs, before, after }]`，最多 8 处（`stuck_points`，551）。

各 `kind` 的 `meta`（都在 `sttFull` 的调用点）：

- `shadow`：`{ src, ref }`，`src` 如「IELTSCast：话题」或「我的素材：标题」（519）。
- `talk`：`{ lesson, topic, prompt }`；热身多一个 `warmup: true`（803、1021）。
- `chunk`：`{ lesson, ref }`（941）。
- `review`：整句 `{ ref, mode: 'sentence' }`，语块 `{ ref }`，改错 `{ ref, mode: 'repair', lesson }`，错误本 `{ ref, err }`（1058、1486、1507、1636）。
- `r432`：`{ set, round, limit, topic }`，`line` 用这一轮选的线（2173）。
- `solo`：`{ mode, topic, photo }`。`photo` 只是有没有选图，照片本身不上传（2412）。
- `chat`：`{ scen }`，`line` 取场景上的线，没有则 `daily`（2151）。
- `baseline`：`{ bid, prompt }`，`bid` 是 `intro` 或 `research`（2436）。
- `pron`：体检 `{ test: true, round }`，跟读产出 `{ cid, word }`（1772、1959）。

`ref` 表单字段会传给接口，但故意不喂给 Whisper 当提示（1116 的注释）。它只出现在调用方自己放进 `meta` 的时候。

## 3. 和课程顺序绑死的地方

一课的形状由 `build_lessons()`（`app.py` 104–139）写死。每课是：

- `n`：1 起的序号
- `t`：从 IELTSCast 标题清洗出来的话题
- `p`：Part 1 / 2 / 3（从标题或 URL 猜）
- `w`：原音频是否带停顿
- `f`：这一集的音频相对路径
- `x`、`b`：按同一序号配上的 BBC 语块和音频；BBC 没下到就没有这两项

`GET /api/lessons`（1023）原样返回这个数组。前端 `boot`（2576）放进全局 `LESSONS`，`N` 是长度。`S.prefs.cur` 是这个数组的下标加 1，不是稳定 id。进程启动时还会 `api_transcribe_all()`（1462），把每课的 `f` 和 `b` 塞进字幕队列。

下面每一处都假设「当前课 = `LESSONS[S.prefs.cur - 1]` 这一集」。换成「一个单元 = 若干练习项，练习项可以没有音频」时，各自要改的是：

1. `build_lessons()`（104）和 `api_lessons()`（1023）。这是旧课表的唯一来源。新课表不要塞进这个函数：它读的是 IELTSCast 的 `manifest.csv`，按发布日期排序，再按序号配 BBC。新课程用自己的 JSON。`api_status`（1425）里的 `lessons` / `ielts_transcribed` 也是按 `l["f"]` 数的，设置页（2558）拿来画「雅思字幕进度」。新单元没有整集音频时，这两处应继续只统计旧资料，或者改成不出现在「今天」上。

2. `S.prefs.cur`（75、1103、2583）。`goLesson` 把它夹在 `1..N`，`boot` 在它越界时重置为 1。它同时被顶栏、今天页、对话、4/3/2 和自言自语当成「今天是哪一课」。新单元不要写这个字段。另用一个键（例如 `S.prefs.unit`）存新单元 id。否则新课表一短，旧下标会被重置成 1；新课表更长时，同一个数字会指向另一项内容。

3. `S.lessons[n]`（86、89、107）。完成标记 `sh` / `ph` / `sp`、跳过、`natural` 都按这个数字课号存。`lessonDone`（107）还要看 `LESSONS[n - 1].b`：没有 BBC 音频时，跟读加开口说就算这课完成。新单元的完成条件不同（一项一项练完，而不是这三步），应记在新键上。沿用 `S.lessons[n]` 会把旧课的勾和新区的勾混在一起。

4. `S.cards[n]`（890、915）。BBC 讲解按课号缓存。没有「今日语块 = 第 n 个 BBC 短语」这回事之后，这项不要再按单元号写。讲解若还需要，放进课程 JSON，或放进语块卡自己的字段。

5. `renderToday`（739–780）。没有 `N` 就直接报「没有读到课程」（742）。有课则画课号选择器、标题、标签「IELTSCast 话题」、可选的「今日语块」，再固定三步：跟读 `sh`、语块 `ph`、开口说 `sp`（763）。做完调用 `goLesson(n + 1)`。这里整段换成：读当前单元，按单元里的练习项列表渲染，一项可以是跟读、听辨、说句子或自由说，没有音频就不出播放器。三步导航和 `lessonDone` 的勾不要照搬。

6. `buildStep1`（855）。用 `L.f` 向 `/api/transcript` 要整集逐句字幕，句子必须带 `s` / `e` 秒，然后 `new Shadow(L.f, sentences)`。跟读满 5 句就把这课 `sh` 标完成。没有音频的练习项不能走这里。有音频的项可以继续用 `Shadow`，但完成条件改成「这一项的句子跟完」，不要写 `markLesson(n, 'sh')`。`L.w`（870）那句「这一集原音频带停顿」是雅思文件名的特征，新课删掉。

7. `buildStep2`（884）。没有 `L.b` 就跳过；有则播放 BBC 整集，按 `L.x` 的词在字幕里找例句再跟读，再让 AI 按「The English We Speak」写讲解，最后强迫用 `L.x` 造句，说满 4 个词标 `ph`。新单元里的语块练习不是「一集 BBC」。应改成：练习项自己带 `en` / `zh`，造句和入卡走现成的 `addChunk` 和 `aiText`，不读 `L.b`、`L.x`，不写 `S.cards[n]`。

8. `buildStep3`（949）和 `promptText`（708）。题目由 `L.t` 和 `L.p` 拼出来：Part 2 说 2 分钟，其余 1 分钟；提示词里写死今日语块 `L.x`。`speakRec`（1009）把课号和话题写进录音 `meta`。新单元的自由说项应自带题目、秒数和可选语块。没有语块时，提示词里那句 `Target chunk for today` 要拿掉，`renderReview`（1086）「用上了 L.x」也要改成这项自己的目标，或者不显示。

9. `goLesson`（1103）。改 `S.prefs.cur`，顺手改 `CHAT.lesson`，然后重画今天页。新课程的「下一项 / 下一单元」不要调用它。可以留着给旧课表，但新页面不要走。

10. `warmupCard` / `warmupSource`（784–821）。在 `S.lessons` 里找最近一次开口说（`sp`），用那一课的 `LESSONS[m - 1].t` 和语块做 1 分钟复述。新课程若没有「上一单元的话题演讲」，这项要么改成复述上一单元指定的句子，要么从新今天页拿掉。它现在是 `renderToday` 的一部分，换掉 `renderToday` 时不会自己出现。

11. `CHAT.lesson`（2024）和 `static/chat.js` 的 `SCEN.topic`（21、84）。话题场景的角色提示是 `LESSONS[n - 1].t`，没有空值保护，课号对不上会抛错。`startChatOn`（2025）和场景芯片（2062）把「今日话题」设成当前雅思课。`renderChat` 用 `topicN` 取标题（2059）。新今天页若不打开这个场景，可以先不动对话页；一旦新单元要「就这个内容聊」，应给 `SCEN.topic` 一个字符串话题，而不是课号下标。其他场景（点餐、组会等）不读 `LESSONS`。

12. `renderRetell`（2200、2207）和 `renderSolo`（2297）的「用今天的话题」，以及 `solo.js` `recentChunks`（58）把 `LESSONS[cur - 1].x` 当作最近语块。这三处在别的页，不挡新今天页。新课程上线后它们仍会指向雅思课。要改的话，改成读新单元的话题和语块；不改也能用，只是「今天」二字名不副实。

13. `renderHeader`（686）。副标题是「第 cur 课 · 共 N 课」。按节数倒计时应改成新课程的「第 k 节 / 共 M 节，还剩 M−k」。`guide.js` 的课程说明（54、83、146）写的是雅思文件夹和「第 1 课」，属于文案，不影响练习页。

14. 录音 `meta.lesson`（803、941、1021、1058）。存的是雅思课号。新练习继续传课号会和旧录音混在一个整数空间里。新录音的 `meta` 改传单元 id 和练习项 id。旧文件不用改。

`Shadow`、`/api/media`、`/api/transcript` 本身不认课号，只认音频路径加秒数。绑死的是调用方硬编码 `L.f` 和 `L.b`。

## 4. 可以原样复用的部件

这些都不读课表。新课程直接调用即可。脚本没有模块系统，后加载的 `course.js` 能看见这些全局名字。

- `Rec`（`app.js` 214）。输入：一个 owner 字符串。`start(owner)` 向麦克风要流并开始录；`stop()` 返回 Blob；`autoStop(max, quiet)` 在说过话再安静 `quiet` 秒（默认 1.5）或满 `max` 秒时停；`isOn(owner)` 问是不是这次在录。输出：音频 Blob。
- `stt` / `sttFull`（63、70）。输入：Blob、可选的参考句 `ref`、可选的归档 `{ kind, line, meta }`。输出：`{ text, words, onset, id?, metrics?, stuck?, duration? }`。带 `kind` 时写入 `data/recordings/` 并把 `RECS.dirty` 设上。`kind` 必须是后端 `KINDS`（`app.py` 567）里已有的九种，新种类要两边一起加，否则 400。
- `aiText`（53）。输入：提示词，或 `{ messages, json, temperature, think, cache, cacheOnly }`。输出：解析后的 JSON；`json: false` 时是字符串；只查缓存又没有时是 `undefined`。
- `aiAudio`（58）。输入：Blob 和提示词。输出：模型按提示词返回的 JSON。走的是百炼听音频那一路，和 Whisper 无关。
- `schedule`（156）。输入：一张语块卡和分数 `g`（0 忘了，1 模糊，2 想起来了，3 脱口而出）。输出：新的卡对象（`due`、`ivl`、`ease`、`reps` 已更新）。不写盘，调用方赋回 `S.srs[id]` 再 `save()`。
- `pitchSvg`（352）。输入：两条 `{ x: 0..1, y: 半音或 null }[]`。输出：对比用的 SVG 字符串。曲线数据用 `pitchOfSegment(path, s, e)` 和 `pitchOfBlob(blob)`（`pitch.js` 11、20）取，再用 `pitchContour`（25）换算。
- `timedRec`（285）。输入：owner、秒数、重画函数。输出：限时录音的 Blob；没录到则 `null`。到点自动停。
- `POST /api/stt`（1113）。输入：表单里的音频，外加 `ref`、`kind`、`line`、`meta`。输出和 `sttFull` 相同。无 `kind` 时只转写，不存档。短于约 0.3 秒或几乎无语音时 `{ text: "", words: [] }`。
- `POST /api/pitch`（1144）和 `GET /api/pitch/media`（1155）。输入：一段音频，或资料库相对路径加起止秒。输出：`{ hop, f0 }`，`f0` 是每 10 ms 的基频赫兹，无声为 `null`。
- `GET /api/recordings`（1163）。输入：可选 `kinds`（逗号分隔）和 `line`。输出：`{ recordings: [...] }`，按时间倒序，每条没有 `words`。单条全文和音频是 `GET /api/recordings/{id}` 与 `.../audio`。

同样与课表无关、新课会直接用到的还有：

- `align(refText, heardText, heardWords)`（328）→ `{ toks, hit, weak, score }`；`diffView`（344）把它画成红绿词。
- `addChunk(en, zh, src, clip)`（142）→ 卡 id 或已有卡的 id。`dueList()`（155）→ 到期的 `[id, card][]`。
- `chunkUsed` / `chunkJudge` / `chunkGrade`（`review.js` 21、32、40）。输入语块卡和转写，输出用没用上、句子通不通、该给几分。
- `errIngest(list, src)`（`errors.js` 37）和 `errPromptPart()`（28）。前者把 AI 返回的错误并进 `S.errs`，后者是拼进点评提示词的那一段。`gapIngest`（`gaps.js` 25）把卡壳说法收进语块本。
- `wordify`（`words.js` 41）和 `openWordCard`（`app.js` 1250）。点词查词典不依赖当前课。
- `say(text)`（120）用系统语音朗读。`metricsView(m, base)`（270）把语速、填充词、连贯段画出来。
- `micButton(owner, onBlob)`（721）是一个按钮，交出 Blob。注意它结束时调用 `rerenderOwner`（730）：owner 不是 `pron` / `chat` / `rev` / `err` 开头就会重画今天页。新练习的 owner 要用新前缀，并在 `rerenderOwner` 里加一行，或者不用这个按钮、改用 `Rec`。
- `POST /api/ai/text`（1188）和 `POST /api/ai/audio`（1217）是上面两个前端函数的后端。`GET /api/dict?w=`（1017）是点词词典。

`class Shadow`（424）在「有一句句带时间戳的音频」时可以原样用：输入路径、句子数组 `{ text, s, e }`、可选标签。没有音频的练习项用不上它。不要为了新课改它的完成回调，那个回调现在由 `buildStep1` 传入。

## 5. 新课程层的接入点

目标：新增 `static/course.js` 和一份课程 JSON，「今天」跑新课；「我的素材」「语块本」「错误本」不改行为。这三页分别是 `renderMine`（1123）、`renderChunks`（1457）、`renderErrors`（1598），数据是 `MY`、`S.srs`、`S.errs`。它们不读 `renderToday` 的三步。只要新代码不改这三个函数、不改 `S.srs` / `S.errs` 的字段形状、不在 `setTab`（690）里拆掉 `mine` / `chunks` / `errors`，它们会照常工作。

建议的最少改动是四处，旧的三步函数先留着不删：

1. `static/index.html` 在 `app.js` 之前加 `<script src="course.js"></script>`。课程 JSON 放在 `static/` 下，由 `course.js` 自己 `fetch`。不必新写后端接口，也别改 `build_lessons()`。`course.js` 提供两个全局：`COURSE`（单元数组）和 `renderCourseToday(root)`。

2. `boot`（2574）。现在课程接口失败会直接 return，今天页不再画。改成：雅思课表失败只记下错误；只要 `COURSE` 载入了，就继续 `renderHeader` 和 `setTab`。不要用 `LESSONS.length` 去夹新单元的下标。`S.prefs.cur` 继续只表示旧课位置。

3. `renderToday`（739）开头加分支：新课程已载入时调用 `renderCourseToday(root)` 并 return。后面的课号选择器、三步和 `buildStep1/2/3` 保持不动，作为旧路径。`setTab('today')` 不用改，它已经调用 `renderToday`。

4. `renderHeader`（686）的副标题。有新课程时显示「第 k 节 · 共 M 节」，k 来自新进度键。没有则保持现在的雅思课号。

`renderCourseToday` 里把一节画成练习项列表，每项调用第 4 节的部件：有字幕的音频用 `Shadow`，限时说用 `timedRec` + `sttFull`，造句用 `aiText` + `addChunk`，到期复习仍可调用现成的 `closingCard()`（834），它只看 `dueList` 和 `errDueList`。完成状态写到新键，例如 `S.course[unitId].done`，并在 `boot` 载入 `S` 的那一行（2579）把 `course` 加进白名单，否则刷新后丢。

先不要改的：`goLesson`、`CHAT.lesson`、`buildStep*`、`/api/lessons`。新今天页不调用 `goLesson` 和 `startChatOn`。对话页的「今日话题」会仍指向雅思课，这是已知的遗留，不是这三页的回归。等新课要接对话时，再改 `chat.js` 第 21 行，让话题场景接受一个字符串，而不是 `LESSONS[n - 1]`。

`rerenderOwner` 要加一条新前缀，否则新练习的 `micButton` 会掉回 `renderToday`，把进行中的一节整页重画。这是第 5 处，只在新练习用 `micButton` 时才需要。用 `Rec` 自己重画就可以先不加。

## 6. 风险

### 缠在一起、容易碰坏的部分

`static/app.js` 到 `boot` 结束是 2588 行，没有模块，全是全局函数。最紧的是今天页这一段（739–1103）：`renderToday`、`warmupCard`、`buildStep1`、`buildStep2`、`buildStep3`、`speakRec`、`repairCard`、`goLesson` 共用 `LP[课号]`、`lessonRec`、`LESSONS[n - 1]` 和 `SHADOWS`。改三步中任何一步的完成条件，都会动到 `lessonDone`（107）、顶栏、热身找「上次开口说」、进步页的「完成了几课」。

第二紧的是 `class Shadow`（424–654）。今天第 1 步、第 2 步的 BBC 例句、「我的素材」三处共用同一个类。它内部又调用 `align`、`sttFull`、`pitchOfSegment`、`shadowFocus`、`analyzeSentences`、`wordify`、`shRecord`。改跟读交互会同时碰到课程和素材页。

第三是 `S.srs` 一种存储四种卡：普通语块、单词挖空、句型模板、名词说法。`renderChunks`（1457）和 `review.js` 的 `isSentenceCard` 靠有没有 `cloze` / `tpl` / `nf` 来分支。给新课程加第五种卡，要同时改入库、复习界面和 `schedule` 的调用处，否则会按「看中文说整句」或「说原句」判错。

第四是录音种类两边各写一份：前端 `sttFull` 的 `kind`，后端 `KINDS`（567）。漏改一边，新录音直接 400，或者指标进不了曲线（曲线再由 `inCurve` 269 和 `CURVE_KINDS` 566 滤一遍）。

第五是 `save()` 提交整份 `S`。服务端只在 `state_size` 掉到一半以下时拒绝（1286），而且 `repairs`、`chatTasks` 不计入这个大小。一个把 `S.srs` 弄丢一截的 bug，只要没到一半，就会写进 `progress.json`。当天第一份备份能找回，同一天里的后续损坏找不回。

`S.prefs.cur` 和 `S.lessons` 的键是课表下标。`build_lessons` 按日期排序，资料夹里的 `manifest.csv` 一变，旧勾会贴到另一集上。新课程更不能复用这套键。

### 换课程后的用户数据

继续有意义、应原样保留：

- `S.srs`：语块、单词卡、句型卡、名词卡，以及复习间隔。复习页不需要旧课表。`clip` 仍指向旧音频路径；资料夹还在，`clipBtn`（211）就能放原声，资料夹一换就 404，那时朗读会退回系统语音（`playChunkOriginal`，207）。
- `S.errs`、`S.pron`、`S.repairs`、`S.chatTasks`。错误本和发音页不读课号。
- `S.days`：哪天开口练过。习惯点仍然成立。
- `data/recordings/` 里的音频、转写和指标。基准录音（`meta.bid`）、自言自语、4/3/2、对话、发音，换课表后曲线照样能画。开口说和跟读录音里的 `meta.lesson` 只是旧课号，内容本身还有用，不要按这个数字并进新单元。
- `S.shadow`：按旧音频路径记的跟读分数。那些文件还在就还有意义，和新单元无关。
- `S.prefs` 里的声音、语速、盲跟、对话难度、`chatFix`。这些跟课表无关。

只对旧课有意义，不要迁移成新单元进度：

- `S.lessons` 的 `sh` / `ph` / `sp` / `skip` / `at` / `natural`。键是雅思序号。映射到新单元会把「跟读满 5 句」记成某一节已完成。
- `S.cards` 的 BBC 讲解，同样按序号。
- `S.prefs.cur`。`boot` 2583 行在 `cur > N` 时把它改回 1。新课表的 `N` 若变了，用户下次打开会被带到第 1 项。所以新进度不要放在 `cur`。
- `S.prefs.guided` 只是引导卡看过没有，可留。

`data/transcripts/` 和 `data/ai_cache/` 是按旧文件路径和提示词缓存的，不用迁。`data/backups/` 的日备是整份 `progress.json`，换课前那一份就是回滚点。

这次只读了仓库根目录的 Mac 版。`windows/` 是整份独立副本，同样的绑定点在那边各有一份，不在本报告里。
