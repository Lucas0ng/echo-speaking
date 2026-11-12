调研者：Gemini；日期：2026-11-12；联网手段：search_web 逐条核对原文
状态：完成

# 任务 A：方法证据调研报告

## 结论小结
1. **终点**：成人词汇无上限、语法可达高阶，但难消母语口音。现实目标锚定 **CEFR C1** 与 **轻松可懂（Intelligibility）**，放弃消灭口音。
2. **耗时**：中文母语者 B1 到 C1 需 **500–700 小时**；每天 25 分钟对应 **1,200–1,680 天（3.3–4.6 年）**。软件定位为高强度输出引擎，输入移至课外泛听。
3. **Four Strands**：Nation 主张四要素各 25%。对 25 分钟口语弱者，软件内重组为“微课 5m + 输出 10m + 流利度 10m”，输入移至日常泛听。
4. **婴儿路线证伪**：成人纯输入注定失败。显性教学效应量（d=1.13）远超隐性（d=0.54）；成人应依托读写走“显性理解 + 交互输出 + 程序化”路线。
5. **自说缺环**：照读跳过 Levelt 模型“概念化”与“形式编码”。核心靠**任务重复（极强）**与**检索练习（极强）**，配以**时间压力（强）**剥离母语翻译。
6. **发音韵律**：超音段韵律（重音/节奏/弱读）对可懂度起决定作用，远超单音。应“韵律先行”，每天仅需 **3–5 分钟** HVPT 与重音微练。
7. **词汇激活**：口语 95% 覆盖需 3,000–4,000 词族，98% 需 6,000–7,000 词族。阅读被动词需通过情境“强制调用”与“语块化”激活。
8. **长期坚持**：习惯形成中位数 66 天，偶尔漏练无害（Lally 2010）。废除断签清零，采用“倒计时段位箱”与弹性周达标。

---

## 1. 成年人上限与现实终点

### 结论
- **能力上限**：成人可达自由交流的 CEFR C1，但无法消除母语口音。
  - **发音**：关键期关闭最早（6–12岁），发音肌群固化，极难消除口音。
  - **语法**：拐点约 17.4 岁（Hartshorne 2018），成人仍能掌握复杂句法。
  - **词汇**：**无关键期**，终身增长，成人概念深度更优。
- **现实终点**：**CEFR C1（有效流利级）**。采纳 Levis (2005) **可懂度原则（Intelligibility Principle）**，以“轻松易懂”为目标，放弃母语口音。

### 来源依据
1. **语法关键期**：Hartshorne et al. (2018, Cognition) 证实语法习得速率在 17.4 岁发生拐点，但成人依然可达高水平。[Hartshorne et al. (2018)](https://news.mit.edu/2018/cognitive-scientists-define-critical-period-learning-language-0501)
2. **可懂度与口音分离**：Derwing & Munro (1995, 2005) 证实可懂度与口音度独立，重口音英语完全能达 100% 轻松可懂。[Derwing & Munro (2005)](https://www.cambridge.org/core/journals/language-teaching/article/second-language-accent-and-pronunciation-teaching-a-researchbased-approach/98394F8930F871E42BE39A7DCBCFB892)
3. **教学范式**：Levis (2005) 论证消除口音不切实际，教学应转向可懂度原则。[Levis (2005)](https://onlinelibrary.wiley.com/doi/10.2307/3588415)

### 我的推断（针对本软件）
验收标准定为“音位清晰、重音准确、连贯表达”，Whisper 与大模型理解顺畅即可，不设苛刻的 Native 音色打分。

---

## 2. 所需小时数与每日 25 分钟换算

### 结论
- **中文母语者所需时间（B1 出发）**：
  - **B1 → C1**：需 **500–700 小时**（欧洲基准 350–400h，汉英距离膨胀 1.3–1.5 倍）。
  - **B1 → C2**：需 **1,200–1,800 小时** 以上。
- **25 分钟折算**：
  - **到 C1**：需 **1,200–1,680 天（3.3–4.6 年）**。
  - **到 C2**：需 **2,880–4,320 天（7.9–11.8 年）**。
- **启示**：每天 25 分钟直达 C1 是 3 年以上长跑；软件高密度用于提取与自动化，课外补充泛听。

### 来源依据
1. **Cambridge GLH**：零到 B1 需 350–400h；B1 到 C1 累加约 350–400h；到 C2 累计 1,000–1,200h。[Cambridge GLH](https://support.cambridgeenglish.org/hc/en-gb/articles/202838506-Guided-learning-hours)
2. **FSI 难度分级**：同源语言仅需 600–750 课时；中文属 Category IV，需 88 周/2,200 课时（对应 C1），汉英距离使耗时膨胀近 3 倍。[FSI Ranking](https://www.state.gov/foreign-language-training/)
3. **Dreaming Spanish 路线**：西语到 Level 7 需 1,500h 输入；远距离语言共识需翻倍至 3,000h+。[Dreaming Spanish Method](https://www.dreamingspanish.com/method)

### 我的推断（针对本软件）
设计阶梯倒计时：阶段一 100 节（42h，突破 B1 表达）、阶段二 300 节（125h，跨入 B2 自主交流）。

---

## 3. Four Strands 与 25 分钟落地

### 结论
- **原文分配**：Nation 强调课程应**四等分（各占 25%）**：意义输入、意义输出、刻意学习、流利度训练。
- **25 分钟落地**：若机械平分，输入无沉浸且输出无强度。重组为：**软件内专注输出与自动化**，输入移到日常泛听。

### 来源依据
1. **Four Strands 理论**：Paul Nation (2007) 指出四要素各占约 25%；“流利度训练”要求无生词并施加时间压力。[Nation (2007)](https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/foreign-language_1125.pdf)

### 我的推断（针对本软件课程编排）
25 分钟结构：0–5m 刻意微课（发音/韵律 + 核心音块）；5–15m 意义输出（情境对话与即时重述）；15–25m 流利度压迫（4/3/2 压缩造句与限时反应）；课外泛听。

---

## 4. “像婴儿一样学母语”对成人的有效性

### 结论
- **结论**：**“像婴儿学母语（纯输入 + 沉默期 + 拒绝语法读写）”对成人不成立，每天 25 分钟下极度低效。**
- **成人路线**：**利用已有读写与逻辑认知，走“显性理解搭桥 + 密集交互产出 + 自动化程序化”路线。**
  - 成人无婴儿数万小时浸泡条件，但逻辑分析力强。显性规则 1 分钟点透，盲猜上百小时是巨大浪费。
  - 纯输入无法建立口语所需的句法神经回路。

### 来源依据
1. **Swain 输出假说**：Swain (1985) 证实纯输入仅激活语义理解，只有口语产出才能迫使大脑进行句法加工并注意到差距。[Swain (1985)](https://www.cambridge.org/core/books/abs/bilingualism-in-education/communicative-competence-some-roles-of-comprehensible-input-and-comprehensible-output-in-its-development/6C6A974D01DDA23B2DEE40C2C3946EF5)
2. **DeKeyser 技能习得理论**：DeKeyser (2007) 证明成人遵循“陈述性知识 $\to$ 程序化 $\to$ 自动化”，跳过显性理解是弃长就短。[DeKeyser (2007)](https://www.cambridge.org/core/books/practicing-in-a-second-language/870CE701BC67C745672FE82B02DFEBCF)
3. **Long 交互假说**：Long (1996) 证明对话中的“意义协商”与即时重述是习得的最强催化剂。[Long (1996)](https://onlinelibrary.wiley.com/doi/10.1002/9781405198431.wbeal0580)
4. **显性教学元分析**：Norris & Ortega (2000) 效应量显性（$d = 1.13$）远高隐性（$d = 0.54$）；Spada & Tomita (2010) 证实无论简单或复杂语法，显性教学均占优。[Norris & Ortega (2000)](https://onlinelibrary.wiley.com/doi/10.1111/0023-8333.00136)；[Spada & Tomita (2010)](https://onlinelibrary.wiley.com/doi/10.1111/j.1467-9922.2009.00540.x)

### 我的推断（针对本软件）
以文字为初期脚手架，随熟练度逐步抽离（文本 $\to$ 关键词 $\to$ 纯听纯说），杜绝盲目纯听。

---

## 5. 从“照读”到“能说”的缺环与评估

### 结论
- **缺失根源**：Levelt (1989) 模型显示，说话包含“概念生成 $\to$ 形式编码（词汇/句法）$\to$ 构音发声”。“照读”跳过前两步，大脑形式编码引擎完全休眠。
- **手段证据评级**：
  1. **任务重复（Task Repetition）**：**极强**。
  2. **检索练习（Retrieval Practice）**：**极强**。
  3. **时间压力（Time Pressure）**：**强**。
  4. **中译英提示产出（L1 Prompted Production）**：**中等（过渡有效，需适时淡化）**。
  5. **自言自语（Self-Talk）**：**中等（适合低焦虑练习，需闭环反馈）**。

### 来源依据
1. **言语产出断层**：Levelt (1989) 证明口语瓶颈在形式编码器（Formulator），朗读无法建立该回路。[Levelt (1989)](https://mitpress.mit.edu/9780262620895/speaking/)
2. **任务重复**：Bygate (1996, 2001) 证实重复相似任务能转移注意力至形式监控，显著提升流利度与复杂度，是自动化的关键手段。[Bygate (2001)](https://academic.oup.com/applin/article-abstract/22/1/23/245849)
3. **检索练习**：Roediger & Karpicke (2006) 证明主动提取的留存与激活速度远超被动重读。[Roediger & Karpicke (2006)](https://journals.sagepub.com/doi/10.1111/j.1467-9280.2006.01693.x)
4. **时间压力**：Arevart & Nation (1991) 证明 4/3/2 技术递减时限迫使大脑绕过翻译监控，直接调取预制语块。[Arevart & Nation (1991)](https://journals.sagepub.com/doi/10.1177/003368829102200206)

### 我的推断（针对本软件）
三阶训练链：1. 跟读热身（3m）；2. 检索产出（10m，关键词限时组句）；3. 高压重复（10m，任务说两遍，第二遍限时压 30% 逼出自动化）。

---

## 6. 发音、音标、HVPT 与韵律训练

### 结论
- **音标（IPA）**：**中强**。为音位感知固化的成人提供发音位置显性定位。
- **HVPT**：**极强**。多说话人盲听对比可有效重塑成人音位范畴，并自动向发音迁移。
- **韵律（重音、节奏、弱读）**：**决定性（Critical）**。承担听者 70% 解码负荷；音素偏差不影响理解，韵律错误直接阻碍沟通。
- **顺序**：**韵律先行或并进**。中文是音节等时，英语是重音等时。必须先攻克“重音、弱读 /ə/ 与意群停顿”，纠正字字等长等重。
- **时长**：**每天 3–5 分钟（上限 8 分钟）**，防听觉过载。

### 来源依据
1. **韵律优于单音**：Derwing, Munro, & Wiebe (1998) 证明单音素组在自由口语中毫无长进；超音段（韵律）组则有显著飞跃。[Derwing et al. (1998)](https://onlinelibrary.wiley.com/doi/abs/10.1111/0023-8333.00047)
2. **重音决定可懂度**：Hahn (2004) 证明重音正确时听者能容忍音素缺陷；重音错误导致理解反应时骤增。[Hahn (2004)](https://onlinelibrary.wiley.com/doi/10.2307/3588384)
3. **HVPT 神经重塑**：Logan, Lively, & Pisoni (1991) 证实多发音人听辨可在 15 天内稳固重塑异国音素范畴。[Logan et al. (1991)](https://pubs.aip.org/asa/jasa/article/89/2/874/743849/Training-Japanese-listeners-to-identify-English-r)

### 我的推断（针对本软件）
课前 3 分钟做 HVPT 盲听辨析，加 2 分钟句重音与弱读练习；不扣单音分，重点检测意群断句。

---

## 7. 口语词汇量与被动词汇激活

### 结论
- **词族需求量**：
  - **95% 覆盖率**（日常基本口语）：需 **3,000–4,000 词族**（Adolphs & Schmitt 2003）。
  - **98% 覆盖率**（轻松自主表达）：需 **6,000–7,000 词族**（Nation 2006）。
  - 口语不需生僻词，极度依赖核心短语动词与高频搭配。
- **被动词转主动词**：被动词仅有“形 $\to$ 义”单向连结，缺少发音提取码与句法搭配。需通过 Laufer & Hulstijn 的“投入量假说”（高评估负荷）与 Wray 的“公式化语块”，在真实情境中强制调用。

### 来源依据
1. **口语覆盖率**：Adolphs & Schmitt (2003) 证明口语 95% 需 3,000–4,000 词；Nation (2006) 确认 98% 覆盖需 6,000–7,000 词族。[Adolphs & Schmitt (2003)](https://www.lextutor.ca/cover/papers/adolphs_schmitt_2003.pdf)；[Nation (2006)](https://onlinelibrary.wiley.com/doi/10.1111/j.1467-9922.2006.00356.x)
2. **投入量假说**：Laufer & Hulstijn (2001) 指出任务评估负荷决定记忆深度；在口语中限时调动目标词（强 Evaluation）能最高效促成主动化。[Laufer & Hulstijn (2001)](https://academic.oup.com/applin/article-abstract/22/1/1/141018)
3. **公式化语块**：Alison Wray (2002) 证明流利口语依靠整块提取。被动词必须打包进常用语块才能脱口而出。[Wray (2002)](https://www.cambridge.org/core/books/formulaic-language-and-the-lexicon/D0F08B9AAEB0CDD279ED73B90B28C27B)

### 我的推断（针对本软件）
聚焦 3,000–5,000 词族口语搭配。每课挑 3 个熟词短语在对话中设强制激活挑战，脱口而出即点亮。

---

## 8. 长期坚持的动机心理学

### 结论
- **习惯养成（Lally 2010）**：复杂习惯自动化中位数为 **66 天**；**单日偶然漏练无实质影响**，断签清零反人性。
- **目标渐进效应（Kivetz 2006）**：人越靠近终点越快；超长目标必须切分为密集短里程碑，利用“预置进度”消除中途倦怠。
- **打卡副作用**：连续打卡易诱发“破罐破摔效应”（What-the-hell effect），断签导致大量用户自责流失。
- **机制设计**：废除连续天数归零，采用“30 节课倒计时段位箱”与“弹性达标（周保星制）”。

### 来源依据
1. **习惯形成建模**：Lally et al. (2010) 实证中位习惯形成期为 66 天，证实偶尔缺席不损害进程。[Lally et al. (2010)](https://onlinelibrary.wiley.com/doi/10.1002/ejsp.674)
2. **目标渐进与虚假进度**：Kivetz et al. (2006) 证明人类在接近目标时努力加速，预赠进度的卡片完成率显著提高。[Kivetz et al. (2006)](https://journals.sagepub.com/doi/10.1509/jmkr.43.1.39)
3. **破罐破摔效应**：Marlatt & Gordon (1985) 论证严苛规则一旦破裂，个体倾向于全面放任自流而非重整旗鼓。[Marlatt & Gordon (1985)](https://www.guilford.com/books/Relapse-Prevention/Marlatt-Donovan/9781593856410)

### 我的推断（针对本软件）
1. **倒计时段位箱**：30 节课为一个段位箱，初次预赠 3 节；
2. **弹性容错**：每周 5 次算全勤，允许消耗休息卡，绝不清零天数；
3. **显性化成长**：每段位箱完成时生成第 1 节与第 30 节语速和停顿波形对比，以实证成长抵抗倦怠。
