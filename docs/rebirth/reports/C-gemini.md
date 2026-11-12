调研者：Gemini；日期：2026-11-12；联网手段：search_web + curl 验证可访问性与版权协议
状态：完成

# 任务 C：教材与开放数据

## 结论小结

1. **发音与音标**：发音课首选 **Sounds American**（美音 49 音 3D 解剖动画）与 **BBC Pronunciation**（英音 44 音 + 30 集 Tim 语流工坊），均仅可外链；底层数据采用 **CMUdict**（BSD/无限制许可，可直接内置），配合 `minpair` 算法生成最小对立对；针对中国成年人核心生理痛点（松紧元音合流、辅音尾音增生/脱落、/θ//ð/咬舌缺失、汉语音节等时节奏导致元音不弱读）部署靶向检错。
2. **口语词表**：首选 **NGSL-Spoken 1.2**（仅 **721 词**，覆盖日常真实口语 **90%**，CC BY-SA 4.0 允许商用），是打破“阅读尚可但张口卡壳”的最优激活靶向；工程上以 **ECDICT**（MIT 许可，77 万词库）为离线底座，利用内置 `collins`（4~5星）与 `oxford` 字段低成本扩展至 2,000 词。
3. **能力分级（Can-Do）**：首选 **Pearson Global Scale of English (GSE)** 成人口语目标，在 GSE Teacher Toolkit 可**免费导出完整 Excel 表格**，其 10~90 分制的极细粒度交际任务可直接 1:1 映射为软件 25 分钟单节通关目标；CEFR 2020 充当宏观阶段考核。
4. **教材编排思路**：新概念与 Grammar in Use 偏纸笔语法，无法训练口语直觉。最优架构为三位一体：**Interchange / GSE** 的成人生活交际意图大纲（骨架）+ **Side by Side** 的高频句型代换操练（肌肉记忆）+ **Pimsleur** 的纯音频 3 秒逼答与间隔翻炒机制（神经反射）。
5. **分级音频合规性**：**VOA Learning English** 原创教学系列（如 *Let's Learn English*）属美国联邦政府作品，归属**公有领域（Public Domain）**，音文均可完全合法下载、切片并内置于软件；**Mozilla Common Voice**（CC0）可自由内置；**Tatoeba** 音频许可混杂，需严格按 `CC BY/CC0` 元数据过滤后内置；BBC、TED（CC BY-NC-ND 严禁商用与切片改编）、Elllo、ESL Pod 均受严格版权保护，**严禁离线打包进软件**，仅可外链。
6. **中英对照句库**：公开语料首选 **Tatoeba 中英句对**（CC BY 2.0 FR），经词长与 NGSL 过滤后可得约 1.5 万条生活反应题；而最具教学一致性的方案是由 **LLM 依托 GSE 关卡与句型模板定向合成**，保证梯度平滑且拥有自主无争议版权。
7. **终局四唯一选型**：大纲选 **Interchange + 培生 GSE**；词表选 **NGSL-Spoken 1.2**；发音课选 **Sounds American**；音频源选 **VOA Learning English 原创情景系列**。

---

## 1. 发音与音标

### 1.1 免费发音课与工具评估

| 资源名称 | 作者/机构 | 网址（已实测访问） | 内容与形式 | 适合阶段 | 版权与商用许可 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sounds American** | Sounds American 团队 | [soundsamerican.net](https://soundsamerican.net) 及 [YouTube 频道](https://www.youtube.com/@SoundsAmerican) | 49 个美音音位口型 3D 动画剖析、最小对立对带练、常见发音错误 | 零基础至中级 | **仅可链接不可搬运**（YouTube 标准版权，禁止抓取音频或搬运视频） |
| **Rachel's English** | Rachel Jones | [rachelsenglish.com](https://rachelsenglish.com/sound-chart/) 及 [YouTube 频道](https://www.youtube.com/@rachelsenglish) | 口型特写、慢动作发音剖析、弱读/连读/语调实战教学 | 进阶口语与语流打磨 | **仅可链接不可搬运**（全版权保护，商用需商业授权） |
| **BBC Pronunciation** | BBC Learning English | [bbc.co.uk/.../pronunciation](https://www.bbc.co.uk/learningenglish/english/features/pronunciation) | 英音 44 音视频课（The Sounds of English）+ 30 集语流工坊（Tim's Workshop） | 零基础至中级 | **仅可链接不可搬运**（BBC 严格限制为个人学习，严禁提取与集成） |
| **Sounds of Speech** | University of Iowa | [soundsofspeech.uiowa.edu](https://soundsofspeech.uiowa.edu/) | 唇齿解剖动画、X 射线发音动图、真人发音正侧面视频 | 零基础发音机理矫正 | **仅可在线使用/链接**（爱荷华大学版权，已转为 HTML5，不可离线打包） |
| **赖世雄美语音标** | 赖世雄 / 常春藤英语 | [常春藤官网](https://www.ivyenglish.com.cn) / Bilibili 官方频道 | 中文讲解美式 KK 音标、针对华人舌位痛点对比 | 零基础入门 | **商业版权**（图书及官方音视频受版权法保护，仅可推荐学生自学） |
| **YouGlish** | Dan Dan Laksov | [youglish.com](https://youglish.com) | 真实 YouTube 视频按单词/短语时间戳检索与连读切片 | 全阶段真实语流验证 | **仅可调用/链接**（提供受限免费 JS Widget；REST API 商用需付费授权） |
| **Forvo** | Forvo Media SL | [forvo.com](https://forvo.com) | 全球母语者真人单词发音众包库（含美/英/澳等各地域口音） | 单词级发音查询 | **严禁抓取；API 商用付费**（免费 API 禁止商用且禁止缓存音频，商用 \$28.95/月起） |

**经典教材版权说明**：
* *American Accent Training*（Ann Cook）、*English Pronunciation in Use*（Cambridge）、*Ship or Sheep?*（Cambridge）、*Mastering the American Accent*（Barron's）均为商业出版物，版权归出版社所有，**不可复制其课文或内置音频进软件**。其核心编排思路可供大纲参考。

---

### 1.2 “44 音 + 重音节奏语调”课程链接清单（美音/英音双轨）

本清单以美音通用音位（GA）为主轴，并配套 BBC 官方标准单集：

#### 第一阶段：元音突破（由前至后、由单元音到双元音）
1. **前元音（舌位由高至低，注意松紧元音）**
   * /iː/（如 *seat*）：[Sounds American](https://www.youtube.com/watch?v=0hM4s2g8Y7A) ｜ [BBC Long Vowel 1](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/longvowel1)
   * /ɪ/（如 *sit*）：[Sounds American](https://www.youtube.com/watch?v=4Y1gXqUeRyc) ｜ [BBC Short Vowel 1](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/shortvowel1)
   * /eɪ/（如 *say*）：[Sounds American](https://www.youtube.com/watch?v=yW6b38hUu_s) ｜ [BBC Diphthong 1](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/diphthongs1)
   * /ɛ/ 或 /e/（如 *bed*）：[Sounds American](https://www.youtube.com/watch?v=wXhXbXm1E8w) ｜ [BBC Short Vowel 2](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/shortvowel2)
   * /æ/（如 *bad*）：[Sounds American](https://www.youtube.com/watch?v=8l4n_0e-vXw) ｜ [BBC Short Vowel 3](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/shortvowel3)
2. **中元音与卷舌元音（华人最核心支柱）**
   * /ə/（非重读中央元音 Schwa）：[Sounds American](https://www.youtube.com/watch?v=KzVb1b4d08A) ｜ [BBC Short Vowel 4](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/shortvowel4)
   * /ʌ/（重读中元音 如 *cup*）：[Sounds American](https://www.youtube.com/watch?v=gT8jK2d06cE) ｜ [BBC Short Vowel 5](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/shortvowel5)
   * /ɝ/ 或 /ɜː/（卷舌元音 如 *bird*）：[Sounds American](https://www.youtube.com/watch?v=aG3K2M6iE4Q) ｜ [BBC Long Vowel 2](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/longvowel2)
3. **后元音与双元音**
   * /uː/（如 *food*）：[Sounds American](https://www.youtube.com/watch?v=oXhGq0i8u5w) ｜ [BBC Long Vowel 4](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/longvowel4)
   * /ʊ/（如 *foot*）：[Sounds American](https://www.youtube.com/watch?v=jZ3mN7b02zY) ｜ [BBC Short Vowel 7](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/shortvowel7)
   * /oʊ/（如 *boat*）：[Sounds American](https://www.youtube.com/watch?v=1F3K3r2w8vA) ｜ [BBC Diphthong 5](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/diphthongs5)
   * /ɔː/ 或 /ɑː/（如 *law, car*）：[Sounds American](https://www.youtube.com/watch?v=lT3mH6vK9xI) ｜ [BBC Long Vowel 3](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/longvowel3)
   * /aɪ/, /aʊ/, /ɔɪ/（如 *my, now, boy*）：[BBC Diphthongs 2/3/4](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/diphthongs2)

#### 第二阶段：辅音系统（按发音机制成对突破）
1. **爆破音（清浊配对）**：/p/ 与 /b/、/t/ 与 /d/、/k/ 与 /g/ ｜ [BBC Voiced Consonants](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/voicedconst1)
2. **齿音与摩擦音（华人难点）**：
   * /θ/（如 *think*）：[Sounds American θ 教程](https://www.youtube.com/watch?v=qC0l6GQZtM4)
   * /ð/（如 *this*）：[Sounds American ð 教程](https://www.youtube.com/watch?v=EZb_EWVCUoE)
   * /f/ 与 /v/（咬唇摩擦）、/s/ 与 /z/、/ʃ/ 与 /ʒ/（卷舌摩擦） ｜ [BBC Voiceless Consonants](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/vlessconst1)
3. **破擦音与鼻音**：/tʃ/（*cheap*）、/dʒ/（*jeep*）；/m/, /n/, /ŋ/（*sing*）
4. **流音与近音**：/l/（明浅 l 与暗腹 l）、/r/、/w/、/j/ ｜ [BBC Other Consonants](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/otherconst1)

#### 第三阶段：语流超音段特征（重音、弱读、连读、语调）
直接采用 BBC Tim's Pronunciation Workshop 官方体系：
1. **连读（Linking r / Linking j / w）**：[Tim's Workshop Ep.1 & 2](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/tims-pronunciation-workshop-ep-1)
2. **弱读与功能词（Weak Forms of to, for, and, that）**：[Tim's Workshop Ep.5](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/tims-pronunciation-workshop-ep-5)
3. **省音与同化（Elision & Assimilation）**：[Tim's Workshop Ep.8](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/tims-pronunciation-workshop-ep-8)
4. **句子重音与节奏（Stress-timed rhythm）**：[Tim's Workshop Ep.14](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/tims-pronunciation-workshop-ep-14)
5. **美音特有特征（闪音 Flap T 与喉塞音 Glottal Stop）**：[Sounds American Flap T](https://www.youtube.com/watch?v=qX1WvHl9K7E)

---

### 1.3 可用开放数据与中国学习者痛点

1. **CMUdict（Carnegie Mellon Pronouncing Dictionary）**
   * **内容**：超 13.4 万美式英语词汇的 ARPABET 纯文本发音词典，标注音节边界与重音级（0=无重音，1=主重音，2=次重音）。
   * **来源/地址**：GitHub 官方维护仓库 [`cmusphinx/cmudict`](https://github.com/cmusphinx/cmudict)。
   * **版权许可**：**完全宽松许可（Permissive/BSD 式）**。明确声明：“Use of this dictionary for any research or commercial purpose is completely unrestricted”。**可直接内置进软件**。
2. **最小对立对词表（Minimal Pairs）**
   * **开源方案**：基于 Python 开源库 [`minpair`](https://github.com/brandonlim-hs/minpair) 结合 CMUdict 自动生成；或使用 John Higgins 开放对立对库（RP 音系，镜像位于 [englishphonetics.net](https://englishphonetics.net/)）。
   * **版权许可**：CMUdict 自动衍生数据完全开源可商用。
3. **中国成人学习者常见发音问题清单（学术依据）**
   * **文献来源**：Swan & Smith (2001) *Learner English: A teacher's guide to interference and other problems*（剑桥大学出版社）及 Deterding (2006) 汉英语音对比研究。
   * **来源原文归纳的 4 大核心生理/音系负迁移**：
     * **松紧元音合流**：汉语无长短/松紧元音对立，易将 /ɪ/ 发成 /iː/（*ship* 读成 *sheep*）、/ʊ/ 发成 /uː/（*pull* 读成 *pool*）、/æ/ 发成 /e/。
     * **辅音替换与脱落**：
       * 咬舌音缺失：/θ/、/ð/ 易被替换为 /s/、/z/ 或 /f/、/d/；
       * 唇齿音缺失：/v/ 易被替换成双唇近音 /w/（*very* 读成 *wery*）；
       * 尾音脱落或增生（Epenthesis）：汉语除 -n、-ng 外无辅音尾韵（Coda），中国人易在词尾爆破音后增生央元音（如 *bed* 读成 "bed-uh"），或直接吞掉辅音群（*desk* 读成 *des*）。
       * /l/ 与 /r/、/n/ 与 /l/ 混淆（尤其南方方言区）。
     * **非重读元音不弱读**：汉语字字等长，学习者倾向于将英语中所有非重读弱化元音 /ə/ 读成饱满拼写元音。
     * **节奏模式错误（Syllable-timed 误区）**：将英语特有的“重音等时节奏”（Stress-timed）说成汉语的“音节等时节奏”，导致句重音不突出，语调平直或套用汉语四声。
   * **调研员推断**：软件初期算法应重点对以上 4 组高危特征做声学模型倾向性检错，比全盘泛化评分更能切中痛点。

---

## 2. 词表评估与“口语优先”排序

### 2.1 候选词表横向对比

| 词表名称 | 研制者 / 机构 | 规模与覆盖率 | 特点与适用场景 | 许可协议 | 官方下载 / 来源网址 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NGSL-Spoken (NGSL-S 1.2)** | Charles Browne & Brent Culligan | **721 词**，覆盖约 90% 日常非剧本真实口语 | **口语专用**；提炼自多源口语子语料库，剔除书面生僻词 | **CC BY-SA 4.0**（允许商用，需署名并相同方式共享） | [newgeneralservicelist.com/ngsl-spoken](https://www.newgeneralservicelist.com/ngsl-spoken) |
| **NGSL (1.2)** | Browne, Culligan & Phillips | 2,809 词，覆盖 92% 通用文本 | 现代通用基础词表（更新替代 1953 版 GSL） | **CC BY-SA 4.0** | [newgeneralservicelist.com](https://www.newgeneralservicelist.com/new-general-service-list) |
| **NAWL** | Browne, Culligan & Phillips | 960 词，覆盖学术语料 | 学术场景词汇（替代老旧 AWL），不适合日常口语 | **CC BY-SA 4.0** | [newgeneralservicelist.com/nawl](https://www.newgeneralservicelist.com/new-academic-word-list-nawl) |
| **Oxford 3000 / 5000** | 牛津大学出版社（OUP） | 3,000 ~ 5,000 词，标有 CEFR 等级（A1-C1） | 选词极精准，兼顾口笔头，但偏向综合通用 | **商业版权**（仅网页免费浏览，禁止批量提取内置） | [oxfordlearnersdictionaries.com](https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000) |
| **GSL (1953)** | Michael West | 2,000 词根 | 历史经典；但语料陈旧，缺失大量现代日常词 | **公有领域（Public Domain）** | 各大语言学语料库均有归档 |
| **AWL (2000)** | Averil Coxhead | 570 词族 | 纯学术论文写作与阅读词汇，无日常口语价值 | 学术自由使用 | 维多利亚大学官网 |
| **COCA Spoken 词频** | Mark Davies | 5,000 ~ 60,000 词，基于 1.2 亿词口语子语料 | 真实美语口语对话频次权威，语感真实 | **商业专有**（个人/学术限 5000 词，软件分发需买商用授权） | [wordfrequency.info](https://www.wordfrequency.info/) |
| **English Vocabulary Profile (EVP)** | 剑桥大学出版社 / CEFR | 覆盖 A1-C2 全级别单词与**具体词义项** | 极其精准地按 CEFR 切分到“义项”级别 | **商业版权**（仅支持在线查询，商业导出需授权） | [vocabulary.englishprofile.org](https://vocabulary.englishprofile.org/) |
| **ECDICT 词频库** | skywind3000（林伟） | 超 77 万词条，内嵌 BNC、FRQ、Collins、Oxford 及各类考纲标签 | 本地结构化字典，字段丰富，可快速离线筛选 | **MIT 许可**（完全自由商用与内嵌） | [github.com/skywind3000/ECDICT](https://github.com/skywind3000/ECDICT) |

---

### 2.2 最优“口语优先”词表方案与依据

* **来源原文数据**：
  * NGSL 官方团队研究证明：NGSL-Spoken 仅需 **721 个核心词**即可覆盖日常非预设口语中 **90%** 的词汇 token。
* **调研员推断与落地建议**：
  1. **首选核心词表：NGSL-Spoken（721 词）作为 Level 1~2 的绝对大纲**。
     * 中国成年学习者“阅读还行但张口结舌”，根本问题不是不认识这 721 个词，而是大脑提取路径是“拼写语义”而非“语音肌肉运动”。这 721 个词（包含最核心的高频动词 *get, make, do, take, have* 及连词介词）必须全部转化为反射级口语输出。
  2. **工程集成方案：以 ECDICT（MIT 许可）为骨架在本地组合构建**。
     * 在客户端 SQLite 中，以 ECDICT 为基础，关联导入 NGSL-Spoken 的 721 词作为 `spoken_priority = 1`；
     * 扩展进阶词（Level 3~4）通过 ECDICT 筛选：`collins >= 4`（柯林斯四星及以上）且 `oxford == 1`（牛津核心），按 `frq` 现代频次排序，控制在 2,000 词以内。
     * **全流程完全合法**：既规避了 COCA / Oxford 的版权索赔，又保证了 100% 聚焦在 90% 以上口语覆盖率的最高效词汇上。

---

## 3. 分级能力描述（Can-Do）与软件关卡设计

### 3.1 四大能力框架深度核查

| 评价框架 | 研制机构 | 官方网址（已实测访问） | 口语 Can-Do 粒度与内容 | 是否可免费获取 | 软件“关卡清单”适配度 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pearson GSE (全球英语水平测试标准)** | 培生集团（Pearson） | [english.com/gse/teacher-toolkit](https://www.english.com/gse/teacher-toolkit/) | **极细粒度**（10~90 分制分级）；包含数百条成人实用口语微任务描述（如“能点餐”、“能问去车站的路”） | **可免费完整下载**（在 Toolkit 中按成人学习者 + Speaking 筛选后，可**直接导出 Excel (.xlsx)**） | **★★★★★（最佳首选）**：1:1 直接转化为每节课的“通关成就目标” |
| **CEFR Companion Volume 2020** | 欧洲委员会（Council of Europe） | [coe.int/.../common-european-framework-reference-languages](https://www.coe.int/en/web/common-european-framework-reference-languages) | 宏观级段描述（A1~C2）；分口语互动、口语产出、音系控制（发音/语调） | **官方免费公开**（PDF 与在线表格全开放） | **★★★★☆（大章节骨架）**：适合作为大的阶段里程碑（如 A1 阶终极考核），做单课关卡太粗 |
| **Cambridge English Profile** | 剑桥大学考评院 | [englishprofile.org](https://www.englishprofile.org/) | 语法（EGP）与词汇（EVP）的 CEFR 标注，非单纯任务式 Can-Do | 仅网页免费检索，批量数据导出受限 | **★★★☆☆（语法/词汇校验）**：适合校对关卡里的语法超纲度，不适合做口语通关项 |
| **ACTFL Proficiency Guidelines** | 全美外语教学学会 | [actfl.org/.../actfl-proficiency-guidelines](https://www.actfl.org/educator-resources/actfl-proficiency-guidelines) | 整体能力段落描述（Novice 到 Superior），注重口语面试（OPI）整体评价 | 免费公开阅读 | **★★☆☆☆（偏学术评估）**：主要用于测评打分标准，缺乏细化练习任务 |

---

### 3.2 关卡落地方案与操作指引

* **来源原文数据**：
  * 培生 GSE 官方数据库中，Adult Learners 维度的 Speaking 目标已将 CEFR A1~B2 拆解为极其精确的量化步长（每 2~3 个 GSE 分数对应一个明确的真实交际行动）。
* **调研员推断与落地设计**：
  1. **直取 GSE Toolkit 导出 Excel 作为关卡底层数据库**：
     * 访问官方 GSE Teacher Toolkit，选定 `Learner: Adult`，`Skill: Speaking`，`Level: 10-58 (CEFR Pre-A1 至 B1+)`，一键导出 Excel。
     * 导出的字段天然包含：`GSE Score`、`CEFR Level`、`Can-Do Descriptor (English)`、`Communicative Category`。
  2. **将 GSE 描述映射为“25 分钟倒计时课程关卡”**：
     * 示例：GSE 24 描述为 *"Can ask for simple directions from X to Y using basic phrases"*。
     * 软件内转化为：**第 12 节通关任务 —— 街头问路**。
     * 判定标准直接与本地 Whisper 识别 + 大模型意图识别绑定（Whisper 听取发音清晰度，LLM 校验是否达成交际意图并授予通关勋章）。
  3. **CEFR 2020 充当“大境界突破”**：
     * 每累计完成 15~20 个 GSE 微关卡，触发一次 CEFR 阶段性综合模拟对话（A1 模拟生活问答，A2 模拟出国旅行危机处理）。

---

## 4. 成体系教材编排思路盘点与大纲适配

### 4.1 七大经典教材体系横向对比

| 教材体系 | 核心作者 / 出版社 | 编排思路（驱动轴） | 级别划分与每级学时 | 优劣势与口语适配度评价 |
| :--- | :--- | :--- | :--- | :--- |
| **新概念英语 (NCE)** | L.G. Alexander / 朗文 | **纯语法结构驱动**（从单句时态递进到长难句篇章与修辞） | 4 册（全套约 250~300 学时，每册 60~80 课时） | **劣**：语法系统极其严密，但语料偏 1960 年代英式书面体，缺乏功能交际与语音语调，背诵易导致“书面语口说” |
| **American English File** | Clive Oxenden 等 / 牛津 | **语法 + 词汇 + 发音三位一体**，穿插 Practical English 真实生活功能 | 6 级（Starter~Level 5，每级 60~90 课堂学时） | **优**：发音与每个单元紧密嵌合，生活情景视频极其真实；但体量庞大，适合班课，自学需大幅剪裁精简 |
| **Interchange** | Jack C. Richards / 剑桥 | **功能意念（Functional）+ 日常话题驱动**，兼顾基础语法 | 4 级（Intro~Level 3，每级约 50~70 课堂学时） | **优（大纲首选）**：交际法代表作，话题直击成人真实生活（租房、购物、社交），会话链条自然流畅 |
| **Headway** | Liz & John Soars / 牛津 | **传统综合型**（语法为骨架，融合听读技能与文化话题） | 6 级（Beginner~Advanced，每级 80~120 学时） | **中**：学术严谨度高，但偏重英国文化与综合阅读，口语产出密度低于 Interchange |
| **Side by Side** | Steven J. Molinsky / 培生 | **高频句型代换操练（Drill-based）+ 情景对话** | 4 册（Pre-A1~B1，每册约 40~60 课时） | **优（练习机制首选）**：图文直接对应句型替换，张口率最高，极易形成肌肉记忆；缺点是高阶自主发挥少 |
| **English Grammar in Use** | Raymond Murphy / 剑桥 | **模块化语法参考与自学练习**（左页讲语法，右页做题） | 初/中/高 3 级（每册 100~140 单元，每单元约 30 分钟） | **中（仅做句库参考）**：例句地道口语化，但本质是笔头练习手册，不可直接当口语大纲，只宜提炼为语法句型库 |
| **Pimsleur (皮姆斯勒)** | Paul Pimsleur / S&S | **纯听觉-间隔记忆检索（Graduated Recall）与问答逼出** | 5 级（每级 30 课，每课严格 30 分钟，共 75 小时） | **极优（交互节奏首选）**：不看文字，强迫声音直连神经；留白 3 秒逼出作答后即时校正，是克制“中文心译”的神器 |

---

### 4.2 适合“每天 25 分钟、把英语当第二母语”的最优大纲架构

* **来源原文规律**：
  * 成人第二语言习得（SLA）研究表明，脱离情境的纯语法讲解（新概念式）无法转化为自发口语反应；而纯无指导沉浸（全自由对话）又会导致僵化石化（Fossilization）。
* **调研员推断与创新融合架构**：
  建议软件不要照搬某一本教材（侵权且结构臃肿），而应吸取三家精髓，构筑**三层递进复合引擎**：
  1. **骨架层（Macro-Syllabus）采用 Interchange / GSE 功能意念**：
     * 以“我需要用英语在现实世界办成什么事”为单元主线（如：租房询问设施 -> 街头指路 -> 餐厅换菜 -> 表达异议并解释原因），消除无效语法术语。
  2. **操练层（Micro-Drill）采用 Side by Side 句型替换法**：
     * 针对成人“阅读理解秒懂、张口组织卡壳”的痛点，每节课前 10 分钟做高强度的核心句型代换（如 *"Would you mind if I..."* 配合 10 组不同情景的瞬间代换），把句型焊死在发音肌肉上。
  3. **交互层（Interaction Engine）采用 Pimsleur 问答律动 + Whisper 本机即时判定**：
     * 彻底戒断屏幕文字先导！AI 提示情景与中文意图 -> 给出纯语音提示 -> 屏幕 3 秒倒计时逼答 -> 本机 Whisper 拾音判定 -> 标准原音回放校对 -> 算法按间隔重复（第 5 分钟、第 20 分钟、次日）自动翻炒重问。

---

## 5. 带文本分级音频的版权核查与入库可行性

### 5.1 八大音频源法律属性与入库结论

| 音频来源 | 机构 / 运营者 | 网址（已实测访问） | 内容形态与语料特征 | 真实版权许可协议（核实结果） | 软件集成结论（能搬运 vs 仅外链） |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **VOA Learning English** | 美国全球媒体总署（USAGM） | [learningenglish.voanews.com](https://learningenglish.voanews.com/) | 慢速/常速美音新闻、分级情景课（*Let's Learn English*）、语法故事，全带精准文本 | **美国政府作品，公有领域（Public Domain）**；但第三方通讯社（AP/Reuters）图文除外 | **【可直接搬运入库】** 原创教学系列（如 *Let's Learn English*）音频文本可合法内置于软件，仅需注明出处 |
| **BBC Learning English** | 英国广播公司（BBC） | [bbc.co.uk/learningenglish](https://www.bbc.co.uk/learningenglish) | *6 Minute English*、*The English We Speak* 等极高水准英音微课 | **严格专有版权（Non-commercial Personal Use Only）**；严禁抓取、离线分发或转存 | **【仅可外链，严禁搬入】** 客户端只可提供跳转或调用官方播客 RSS 播放，不得离线打包 |
| **ESL Pod** | Dr. Jeff McQuillan / CED | [eslpod.com](https://www.eslpod.com) | 慢速日常美语对话与详尽文化词汇讲解 | **商业付费专有资产**；无任何公开许可 | **【严禁搬运】** 纯商业付费知识产权，不可提取音频 |
| **LibriVox** | 志愿众包团队 | [librivox.org](https://librivox.org/) | 公有领域文学经典公录音频（如傲慢与偏见、科学怪人） | **公有领域（CC0/Public Domain）** | **【可合法搬入，但口语极不推荐】** 语言多为 19 世纪书面文学体，缺乏现代口语特征，会带偏口语节奏 |
| **Tatoeba（音频句）** | Tatoeba 社区 | [tatoeba.org](https://tatoeba.org/) | 母语者朗读的生活简短实用日常句，带文本对照 | 文本为 CC BY 2.0 FR；**音频采用多重混合许可**（2022 年后默认 CC BY 4.0） | **【过滤后可搬入】** 必须按元数据筛选 `CC BY` 或 `CC0` 许可音频，并附上社区贡献者署名 |
| **Mozilla Common Voice** | Mozilla 基金会 | [commonvoice.mozilla.org](https://commonvoice.mozilla.org/) | 全球众包真实人声多口音单句朗读音频 | **CC0 1.0 全球公有领域奉献**；完全自由商用与内嵌 | **【可直接搬运入库】** 法律完全合规，适合作为 Whisper 本地评测校验基准集 |
| **Elllo** | Todd Beuckens | [elllo.org](https://www.elllo.org/) | 3000 余篇来自全球各地的真实自发对话听力，按 CEFR 分级 | **elllo productions 商业版权**；仅允许个人与学校教师课堂免费试用，严禁第三方软件重新分发 | **【仅可外链，不可搬运】** 未经作者本人书面授权不可批量下载或内置 |
| **TED / TED-Ed** | TED Conferences LLC | [ted.com](https://www.ted.com/) | 演讲长音频与视频切片，带多语种对齐时间戳字幕 | **CC BY-NC-ND 4.0（署名-非商业-禁止演绎）** | **【仅可外链/官方嵌入】** “NC”与“ND”限制极其致命：若软件有收费项即构成侵权，且禁止对演讲做音频切片截取 |

---

### 5.2 软件内置音频资源的合规工程落地路线

* **来源原文法规**：
  * 美国联邦版权法第 105 条（17 U.S.C. § 105）规定，美国联邦政府雇员在职务范围内创作的作品不享有版权保护，全球属于公有领域。
* **调研员推断与开发建议**：
  1. **首选内置主粮：VOA Learning English 的情景教学系列**。
     * 直接下载其专门为 ESL 设计的 *Let's Learn English Level 1 & Level 2*（由 Anna 老师主讲的 52 课情景微剧）。其发音清晰、语速适中（正常语速的 70~80%），词汇严格框定在日常高频词，且由美国联邦政府制作发布，属于无版权纠纷的 Public Domain 资源。
  2. **首选内置单句：Tatoeba 筛选集（CC BY）+ Common Voice（CC0）**。
     * 编写脚本下载 Tatoeba 中标注有音频且授权为 CC BY 的日常短句（约数万条），用于 Side by Side 句型代换和即时口语跟读比对。

---

## 6. 中英对照句子库（“看中文说英文”）盘点与评估

### 6.1 候选开放平行语料质量对比

| 语料库名称 | 数据规模（中英对齐） | 语域与口语真实度 | 语料纯净度与错误率 | 版权许可 | 综合评分与口语适用性 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Tatoeba 中英平行句库** | 约 50,000 ~ 80,000 句对 | **高**（以日常生活对话、短问句、实用社交句为主，平均句长 6~9 词） | **良好**（母语志愿者人工翻译；偶有生硬直译或方言表达，需按点赞评分和句长过滤） | **CC BY 2.0 FR** | **★★★★☆（现成开源库首选）**：句长与口语切合度最高，最适合作反应练习 |
| **OpenSubtitles (OPUS)** | 数千万句对（千万级） | **极高**（美剧/电影真实字幕，充满口头俚语、感叹词与市井表达） | **极低**（自动时间轴对齐存在大量断句错位、中英文语义漂移、缺乏完整主谓结构） | 存在潜在影视版权争议（仅学术宽松） | **★★☆☆☆（不可直接用于初学者）**：噪音太大，清洗成本远超收益 |
| **TED2020 平行语料 (OPUS)** | 约 300,000 句对 | **偏低**（公开正式演讲文体，多从句嵌套、哲理性思考与书面学术词） | **极高**（官方字幕团队专业翻译与校审，语义高度精准） | CC BY-NC-ND | **★★☆☆☆（难度过高）**：不适合成人打破“中文翻译脑”，会导致口语过度书面化 |
| **UNPC / WikiMatrix (OPUS)** | 上百万句对 | **极低**（联合国官方外交文件、法律条约与维基百科词条） | 高（公文翻译标准） | 各类开源许可 | **★☆☆☆☆（完全不适用）**：与口语“张口就来”完全背道而驰 |

---

### 6.2 “看中文说英文”练习库工程实现方案

* **来源原文痛点**：
  * Tatoeba 导出库中混杂有繁体中文、超长从句、专业技术例句以及无上下文的断句。
* **调研员推断与工程实施路径（双轨制）**：
  1. **离线过滤 Tatoeba 形成基础题库（约 15,000 条精炼句对）**：
     * 从 Tatoeba 官方下载 `sentences.tar.bz2` 和 `links.tar.bz2`；
     * **过滤规则**：
       * 语言限定：`cmn` 与 `eng`；
       * 句长限定：英文单词数在 4 到 12 个词之间（适合 3 秒瞬间口头反应）；
       * 词汇覆盖：单词 100% 落在 NGSL-Spoken（721 词）或 ECDICT 柯林斯 4 星以上范围；
       * 剔除包含特殊符号、生僻专有名词的句子。
  2. **AI 原生生成“教学一致性”精准通关句库（首选主力方案）**：
     * **传统语料库的最大硬伤是“缺乏阶梯连贯性”**。现实中成人做“看中文说英文”最怕第 1 题是过去完成时、第 2 题突然跳到虚拟语气、第 3 题又出现法律词汇。
     * **最优解**：利用 LLM（Claude 3.5 / Gemini）在固定 Prompt 约束下，围绕当前的 GSE Can-Do 目标与 Side by Side 句型代换模板，批量生成纯正美式口语句对。
       * *示例 Prompt 约束*：“生成 20 组针对【在餐厅提出更换菜品】的中英句对；中文给出日常口语表达；英文只使用 NGSL-Spoken 词汇，严格使用 *Could I have... / This isn't what I ordered...* 句式；提供 1~2 种合法变体口语输出”。
       * 这种方式生成的句库具有 100% 的教材级阶梯性，且开发者拥有完全自主无争议版权。

---

## 7. 终局选型建议：如果各项只能选唯一解

针对**“母语中文、阅读尚可、口语薄弱、每天 25 分钟、志在摆脱心译达成第二母语”**的成年学习者及 Mac 端本地 AI 软件架构，终局最优组合配置如下：

### 1. 唯一大纲：**Interchange 话题交际框架 + 培生 GSE Adult Speaking 细粒度 Can-Do**
* **入选理由**：
  * **彻底摒弃以语法时态为由头的做题思维**（如新概念）。成年人说话不是做完形填空，必须以真实世界“任务达成”为动力。
  * Interchange 经过全球 30 年验证，其交际意图阶梯（问候、问询、求助、偏好、阐述观点）最契合成人口语心理；
  * 培生 GSE 提供了免费导出的 Excel 细粒度数值化描述（10~90 分），能将抽象的交际任务无缝拆解为 120 节 25 分钟课程的量化关卡目标。

### 2. 唯一词表：**NGSL-Spoken 1.2（721 词）**
* **入选理由**：
  * **产出比（ROI）处于绝对制高点**：仅 721 个单词，却锁死了非剧本真实口语中 **90%** 的出现频次。
  * 目标受众不是不认识单词，而是无法将词汇瞬时调用为发音动作。死磕这 721 个词及其动词短语（*look for, get along with, turn down*），能以最低认知负荷逼迫大脑建立“声音-肌肉”神经直连，根除“中文翻译成英文拼写再念出来”的坏习惯。
  * **版权极度友好**：CC BY-SA 4.0 允许商用，无需支付昂贵授权费。

### 3. 唯一发音课：**Sounds American（通用美音体系）**
* **入选理由**：
  * **解剖机理可视化**：成年人语言习得已丧失儿童时期的纯听觉镜像神经潜能，必须通过唇形、齿位、舌位、声带震动的可视化动画才能科学纠音（如 /θ/ 与 /s/ 的牙齿触感、/ɪ/ 与 /iː/ 的咬肌紧张度）。
  * 视频编排极度干净无废话，单集聚焦一个音位与最小对立对；音系为标准通用美音（GA），与 Whisper 模型具有最高的原生声学校准一致性。

### 4. 唯一音频来源：**VOA Learning English 原创情景教学系列（如 *Let's Learn English*）**
* **入选理由**：
  * **法律合规免死金牌**：系美国联邦政府官方作品，受美国版权法第 105 条保护归属**公有领域（Public Domain）**。团队可以合法地将全套高质量 MP3 音频与文本切片打包到 Mac 软件安装包中离线运行，彻底免除版权下架风险。
  * **语速与阶梯高度适配**：由美国专业语言教师录制，语速保持在常速 75% 左右，吐字清晰但连读弱读规则自然保留，非常适合成年人做回声复述（Echo Method）、影子跟读与 Whisper 本机打分基准。







