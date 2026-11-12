# 同类语言学习软件调研

**先给结论**

1. 没有一款同时做到“每天强制开口、反馈可信、路线长期”：AI 口语强在开口、弱在课程；体系课强在路线、弱在迁移；输入强在量、弱在输出；记忆强在留存、弱在语境；真人强在反馈、弱在成本。
2. 最值得照搬的是 Pimsleur 的“提示→停顿→开口→标准答案”[1][2]；它把 25 分钟几乎全变成主动回忆，也最适合本机 Whisper。
3. Speak 的“学句→换情境→自由对话→单元末 can-do 实测”是最完整的 AI 口语三段式[6][7]；Dreaming 的“小时数 + can-do 等级”是最诚实的长期进度[9][11]。
4. 最该避开：用 streak/XP/打卡/AI 分数冒充“会说”[14][20][24]，以及无课程、无复现的无限闲聊。
5. 25 分钟建议：3 分钟旧句回忆 + 7 分钟整句替换 + 10 分钟无脚本对话 + 5 分钟转写纠错入库；开口 ≥60%。

> 标“原文”是页面明确写出，标“推断”是我的判断；表中开口占比为粗略估算，“搬/避”为推断。

## 重点拆解

**Pimsleur**[1][2][3]｜原文：每课 30 分钟、每天 1 课、每级 30 课、300–500 词，不鼓励记笔记/看文本；核心是 Graduated Interval Recall（逐步拉长间隔重现，具体秒数官方未公布）+ Principle of Anticipation（先问→停顿等答→再给标准答案）。进度：课程位置、streak、Voice Coach 分、证书。抱怨：不解释语法、有用户称第 5 课后变快、离线丢课。推断：这是最该抄的骨架；但成人要补一句最小解释。

**Glossika**[4][5]｜原文：整句为单位大量重复，native 音频，听→跟读→录音；SRS 每天挑“即将忘记”的句子；有 full-practice 与 listening-only。新版被批：句子不再前后搭建（B2 先于 A1）、强制触屏、不能跑步/开车听、无清晰 A1–C1。推断：抄“整句+间隔复现+录音”，句库用你的错误/场景，保留纯音频。

**Speak**[6][7][8]｜原文：Learn（真实短语）→ Practice（换情境重复到自动）→ Apply（与 Speak Tutor 自由对话，可重来）；每单元末实测课，用开放角色扮演评 can-do，形成 Speak 等级（受 CEFR/GSE 影响但更细）。抱怨：订阅/计费、对话短、反馈浅、故事不合口味。推断：Apply 做成 10 分钟无脚本对话，实测课做成每周 5 分钟 can-do 任务。

**Dreaming Spanish**[9][10][11][12][13]｜原文：7 级，0/50/150/300/600/1000/1500 小时，配 can-do；小时是输入估计，理解领先产出 1–2 级，建议 level 6 再开口；近亲减半、无关加倍；每天 30 分钟（无关语言 1 小时）。进度页：自动计时、每日目标、站外小时手动补录、按级别看 can-do 与推荐视频。抱怨：字幕回拖后消失、刷时长、300–600 小时平台期。推断：抄“单一累计+下一级 can-do”，单位换成“有效开口分钟”，并显示“本周新错误”。

**国内产品**[21][22][23][24][25][26]｜流利说：分级测试→6 级（CEFR/托业/雅思映射）→AI 课+真人 1v1；抱怨测试像卖课、功能删减、返学费激励难持续。Hi Echo：目标→每日任务→对话纠音/语法→三维报告；抱怨卡顿、168 元/月。豆包：语音通话+字幕+纠错，零课程零进度；抱怨记忆断层/幻觉。Call Annie 已停运。推断：抄“目标→每日任务”，避“测试卖课”和“假精确分数”。

表中“排课/分级”未写测试的，表示官网/商店页未说明有测试，不等于没有；写“无”的才是从零/自选路径。

## 总表

| 产品 | 核心动作（开口占比） | 排课/分级 | 进度呈现 | 常见抱怨/流失 | 值得搬 | 要避开 |
|---|---|---|---|---|---|---|
| Speak[6][8] | 学句→换情境→自由对话（60%） | can-do 技能级；单元末实测 | 等级/技能清单 | 订阅、反馈浅、对话短 | 三段式+实测 | 只做聊天 |
| ELSA[14] | 跟读评分→AI 角色扮演（50%） | 按水平定制 | 发音分/仪表盘 | 识别差、计费乱 | 音素级纠音 | 用分数代替交流 |
| Praktika[15] | 与 AI avatar 对话+纠错（60%） | 个人计划，未标 CEFR | 口语指标/streak | 重复、订阅问题 | 低压力角色 | 无目标闲聊 |
| Loora[16] | 自由对话+即时纠错（80%） | 无课程 | 课后总结 | 问题重复、退订争议 | 纯口语密度 | 无课程 |
| BoldVoice[17] | 跟读+AI 纠音（50%） | 诊断→每日 10 分钟 | 发音分/曲线 | AirPods bug、偏发音 | 音素诊断 | 把口音当口语 |
| Duolingo[18][19][20][51] | 路径练习；Max 角色扮演/视频通话（20–40%） | CEFR section/unit；测试未说明 | streak/XP/等级 | 游戏化、通话短、无发音分[51] | 通话后转写 | streak 当进度 |
| 流利说[21][22] | 跟读/配音/AI 课+真人语伴（40%） | 测试→6 级（CEFR） | 等级/报告/打卡 | 测试像卖课、功能删减 | 分级→每日任务 | 打卡绑架 |
| Hi Echo[23] | 24h 语音对话/角色扮演（70%） | 目标→每日任务 | 任务/日历/报告 | 卡顿、168 元/月 | 目标拆任务 | 三维分数假精确 |
| 豆包[24][25] | 语音通话（60%） | 无固定课程 | 无固定进度 | 记忆断层、幻觉 | 零门槛陪聊 | 当课程用 |
| Call Annie[26] | avatar 视频通话（70%） | 无课程 | 无进度 | 已停运 | 视频陪伴感 | 依赖单一产品 |
| Pimsleur[1][3] | 听→提示→停顿→开口→答案（50%） | 30 分/课，30 课/级；无测试，从 1 级开始 | 课程/得分/证书 | 不解释语法、太快、离线 bug | 预期+间隔回忆 | 不解释语法 |
| Glossika[4][5] | 整句听→复述→录音（50%） | 水平句库+SRS | 每日复习句 | 新版乱序、强制触屏 | 整句 SRS | 打乱难度 |
| Rosetta[27][28] | 看图选词/跟读（30%） | 线性级别，无测试说明 | 单元完成/分数 | 无语法解释、识别差 | 意义先行 | 几乎不解释 |
| Babbel[29][30] | 短课+复习（30%） | 按母语定制；测试未说明 | 周活动/复习 | 语法偏重、识别不稳 | 周活动追踪 | 只点选不开口 |
| Busuu[31] | 短课+社区改错（25%） | Study Plan；测试未说明 | 里程碑/证书 | 语法付费、纠错靠社区 | 真人改错 | 依赖社区 |
| Michel Thomas[32][33] | 听老师+两学生→暂停造句（50%） | 全音频，基础→进阶 | 仅课号 | 无进度/不能书签 | 无压力造句 | 无复习系统 |
| Assimil[34][35] | 听读→重复→练习（40%） | 1–49 课输入，50 起激活 | 课号 | app 难用 | 被动→主动两阶段 | 缺自由输出 |
| Dreaming[9][11][12] | 看可理解视频（0%） | 7 级 0–1500 小时；按 can-do 自选 | 总时/等级/can-do/每日目标 | 字幕 bug、刷时长、口语晚 | 小时+can-do | 只数输入 |
| LingQ[36] | 读/听真实内容，标生词（0%） | 自选内容 | 已知词/学习时长 | 免费仅 20 词、内容杂 | 已知词计数 | 只囤词 |
| Refold[37][38][39][52] | 沉浸输入→后期输出（0→30%） | 0–7 阶段，自评，无固定时间表 | 阶段/小时 | 门槛高、口语晚 | 阶段路线图 | 盲目堆 1000h |
| Language Reactor[40] | 双语字幕看剧+查词（0%） | 无课程 | 无课程进度 | 翻译错、只输入 | 双语字幕 | 当课程 |
| Anki[41][42] | 看卡→回忆→评分（0%） | 牌组+SRS | 到期数/留存率 | UI 改版、操作变累 | FSRS+错题卡 | 为背而背 |
| 不背[43] | 例句/词根→回忆→拼写（0%） | 词书+艾宾浩斯 | 打卡/词数 | 词根解释浅、奖励弱 | 原声例句 | 只背不用 |
| 扇贝[44] | 背词→测→打卡（0%） | 词书+词汇量测试 | 打卡日历/同桌 | 依赖同桌/打卡、考试导向 | 词汇测试跳词 | 打卡代替能力 |
| 墨墨[45] | 看词→回忆→评分（0%） | 词书+记忆模型 | 遗忘曲线/持久度 | 例句仅 3 条 | 记忆曲线可视化 | 只认不写 |
| italki[46] | 1 对 1 视频课（70%） | 老师按 A1–C2 定制 | 老师反馈/笔记 | 老师参差、app 难用 | 真人反馈 | 无统一大纲 |
| Cambly[47][48] | 即时 1 对 1 对话/课程（80%） | 课程库按水平/主题 | 反馈/课程完成 | 掉线、课时作废 | 低门槛陪练 | 无长期路线 |
| Preply[49][50] | 1 对 1 课+测试（70%） | 分级测试→老师定制 | 测试/老师反馈 | 最少课时包、计费 | 分级测试 | 绑长期包 |

**真实感排序（推断）**：可复核的 can-do 任务/录音 > 累计有效开口小时 > 独立分级测试/CEFR > 到期复习量 > streak/XP/打卡。用户评论里，Duolingo 十年用户自述仍未流利[20]，ELSA 被指识别不灵、分数不可信[14]，扇贝靠同桌和打卡维持[44]——这三类最像假进度。流失主因不是内容少，而是反馈不可信、重复、每次要重新决定学什么、看不到迁移。

## 最值得借鉴的 5 个设计

1. **Pimsleur 预期循环**：提示→静默→开口→标准答案；25 分钟约 20–30 个句块，开口密度最高。关键是不提前显示答案、不让人默读。
2. **Speak 三段式 + can-do 实测**：学句→换情境→自由对话；每周一次开放角色扮演，按 3–5 条 can-do 判过不过关，而不是按课时。
3. **Dreaming 小时+等级**：单一累计量 + 下一级具体 can-do；但计“有效开口分钟”，并在进度页写明“输入小时≠会说”。
4. **Glossika 整句 SRS**：以整句为最小单位，好句/错句入库，隔天、隔周复现；用你的原句，不用随机句库。
5. **对话后转写闭环**（Duolingo Max transcript + Anki SRS）：每次对话自动转写，挑 1–2 个错误重说、入库，下次对话强制复现。

## 来源与边界

**AI 口语**：[1] https://www.pimsleur.com/the-pimsleur-method/ ；[2] https://www.pimsleur.com/pimsleur-faq/ ；[3] https://apps.apple.com/us/app/id1405735469?see-all=reviews ；[4] https://ai.glossika.com/ ；[5] https://apps.apple.com/us/app/id6667095609?see-all=reviews ；[6] https://www.speak.com/ ；[7] https://help.speak.com/zh-TW/articles/13203124-speak-%E7%AD%89%E7%B4%9A ；[8] https://apps.apple.com/us/app/id1286609883?see-all=reviews ；[14] https://apps.apple.com/us/app/id1083804886?see-all=reviews ；[15] https://apps.apple.com/us/app/id1624701477?see-all=reviews ；[16] https://apps.apple.com/us/app/id1552708303?see-all=reviews ；[17] https://apps.apple.com/us/app/id1567841142?see-all=reviews ；[18] https://blog.duolingo.com/duolingo-max/ ；[19] https://blog.duolingo.com/how-are-duolingo-courses-evolving/ ；[20] https://apps.apple.com/us/app/id570060128?see-all=reviews ；[51] https://practiceme.app/vs/duolingo-max

**国内与输入**：[21] https://m.liulishuo.com/vip.html ；[22] https://apps.apple.com/cn/app/id597364850?see-all=reviews ；[23] https://apps.apple.com/cn/app/id6454838455?see-all=reviews ；[24] https://news.hubeidaily.net/mobile/c_3633361.html ；[25] https://apps.apple.com/cn/app/id6459478672?see-all=reviews ；[26] https://9to5mac.com/2026/05/19/apple-strikes-talent-and-ip-deal-with-virtual-avatar-startup-animato/ ；[9] https://www.dreaming.com/method ；[10] https://www.dreaming.com/faq ；[11] https://d3usdtf030spqd.cloudfront.net/Language_Learning_Roadmap_by_Dreaming_Spanish.pdf ；[12] https://apps.apple.com/us/app/id6453332575?see-all=reviews ；[13] https://www.trackinglanguages.xyz/blog/export-hours-to-dreaming-spanish ；[36] https://apps.apple.com/us/app/id379385811?see-all=reviews ；[37] https://refold.la/roadmap ；[38] https://refold.la/roadmap/phase-4 ；[39] https://community.wanikani.com/t/refold-program/63979 ；[52] https://forum.campfirium.com/t/topic/413 ；[40] https://chromewebstore.google.com/detail/language-reactor/hoombieeljmmljlkjmnheibnpciblicm/reviews

**体系与记忆**：[27] https://resources.rosettastone.com/CDN/us/pdfs/Dynamic-Immersion-for-Business-Snapshot.pdf ；[28] https://apps.apple.com/us/app/id435588892?see-all=reviews ；[29] https://www.babbel.com/about-us ；[30] https://apps.apple.com/us/app/id829587759?see-all=reviews ；[31] https://apps.apple.com/us/app/id379968583?see-all=reviews ；[32] https://michelthomas.com/landing-page/mt-method/ ；[33] https://apps.apple.com/us/app/id1429578528?see-all=reviews ；[34] https://www.assimil.com/en/articles/5-the-assimil-method ；[35] https://apps.apple.com/us/app/id1438616898?see-all=reviews ；[41] https://apps.ankiweb.net/ ；[42] https://apps.apple.com/us/app/id373493387?see-all=reviews ；[43] https://apps.apple.com/cn/app/id698570469?see-all=reviews ；[44] https://apps.apple.com/cn/app/id698013609?see-all=reviews ；[45] https://apps.apple.com/cn/app/id888483369?see-all=reviews

**真人类**：[46] https://apps.apple.com/us/app/id1140000003?see-all=reviews ；[47] https://www.cambly.com/english/courses ；[48] https://apps.apple.com/us/app/id564024107?see-all=reviews ；[49] http://help.preply.com/en/articles/6655082-what-does-my-level-test-result-mean ；[50] https://apps.apple.com/us/app/id1352790442?see-all=reviews

**边界**：Reddit/知乎/小红书直接抓取被反爬拦截，用户评价主要用 App Store、Chrome Web Store 与论坛；打不开的页面未引用。Busuu/Rosetta/Babbel 的具体分级测试官网未说明；Hi Echo 官网为 JS 渲染，改用 App Store 官方描述。Duolingo Max 的“通话短、无发音评分”来自第三方评测，带竞品立场，仅作参考。Refold 缺独立用户评测，用 WaniKani 讨论与 Campfirium 的 Refold Q&A 补位；Call Annie 已停运，未查到可用用户评论。
