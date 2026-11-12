# 自制英语口语软件：可接入的教材、课程与开放数据

调查时间 2026-11。链接均为我实际访问过的官网/权威页；Forvo 对脚本稳定 403，已在表内标注，其余站点浏览器可开，连续脚本请求可能触发限流。标「仅链接」＝版权不允许打包，只能外链或嵌入官方播放器。许可速查：CC BY＝署名即可；BY-SA＝署名 + 同协议；NC＝禁商用；ND＝禁改作；公共领域＝无限制。

## 结论

- **能合法搬进软件**：VOA Learning English（公共领域）、LibriVox（公共领域）、Mozilla Common Voice（CC0）、NGSL / NGSL-S（CC BY-SA 4.0）、CMUdict（商用无限制）、ECDICT（MIT）、Tatoeba 文本（CC BY 2.0 FR）。
- **只能链接**：BBC、TED（CC BY-NC-ND，明确禁止 app 使用）、ESLPod、Elllo、Forvo、YouGlish、所有商业教材、Oxford 3000/5000。
- **推荐组合**：CEFR Companion Volume 做关卡，NGSL-S 做词表，Sounds American 做发音课，VOA 做音频源；中英句库用 Tatoeba 文本。

## 1. 发音与音标

| 名称 | 作者/机构 | 网址 | 内容与阶段 | 版权 |
|---|---|---|---|---|
| Rachel's English | Rachel Smith | [rachelsenglish.com](https://rachelsenglish.com/) | 1000+ 免费视频、音标表、连读弱读；A1–C1 | © 仅链接/嵌入 |
| Sounds American | Sounds American | [soundsamerican.net](https://soundsamerican.net/) | 一音一页：15 元音 + 26 辅音 + 7 个 r 化元音，美音；A1–B2 | © 仅链接 |
| The Sounds of English | BBC Learning English | [bbc.co.uk/…/pronunciation](https://www.bbc.co.uk/learningenglish/english/features/pronunciation) | 44 集 + 导论，英式 44 音位；A1–B1 | © 仅链接 |
| Tim's Pronunciation Workshop | BBC Learning English | [ep-30 汇总](https://www.bbc.co.uk/learningenglish/english/features/pronunciation/tims-pronunciation-workshop-ep-30) | 30 集：同化、省音、连读、schwa；B1–B2 | © 仅链接 |
| 赖世雄美语音标 | 赖世雄／外文出版社 2014，183 页 | [Google Books](https://www.google.com/books/edition/_/GTwhswEACAAJ) | 书 + 音频，零基础 | © 仅链接 |
| Sounds of Speech | University of Iowa | [soundsofspeech.uiowa.edu](https://soundsofspeech.uiowa.edu/) | IPA 口型/动画，入门 | 仅链接（未见开放许可） |
| YouGlish / Forvo | YouGlish / Forvo | [youglish.com](https://youglish.com/)・[forvo.com](https://forvo.com/) | 真人视频例句／用户录音；全阶段 | 仅链接；Forvo 网页对脚本 403、API 付费 |

经典教材（均 ©，只能购买/链接）：Ann Cook《[American Accent Training](https://openlibrary.org/search?q=american+accent+training)》、Cambridge《[English Pronunciation in Use](https://openlibrary.org/search?q=english+pronunciation+in+use)》（初/中/高 3 册）、Ann Baker《[Ship or Sheep](https://openlibrary.org/search?q=ship+or+sheep)》（中级）、Lisa Mojsin《[Mastering the American Accent](https://openlibrary.org/search?q=mastering+the+american+accent)》。

**44 音顺序课（英式，BBC）**：短元音 7 `/ɪ e æ ʌ ʊ ɒ ə/` → `shortvowel1–7`；长元音 5 `/iː ɑː ɔː uː ɜː/` → `longvowel1–5`；双元音 8 `/eɪ aɪ ɔɪ aʊ əʊ ɪə eə ʊə/` → `diphthongs1–8`；清辅音 8 `/p t k f θ s ʃ tʃ/` → `vlessconst1–8`；浊辅音 8 `/b d g v ð z ʒ dʒ/` → `voicedconst1–8`；其他 8 `/m n ŋ h l r w j/` → `otherconst1–8`。模板：`https://www.bbc.co.uk/learningenglish/english/features/pronunciation/{slug}`。BBC 页面只标 programme 序号、不写音标；上面这组音值是按经典 44 音位表对应，点开视频可核对。

**44 音是英式口径**：美式通常算 15 个元音 + 24 个辅音；Sounds American 另列闪音 T、喉塞 T 和 7 个 r 化元音，索引共 48 条。

**美式替代（推荐）**：`soundsamerican.net/article/` 下一音一页，如 `/vowel_sound_ae_as_in_cat`、`/consonant_sound_voiceless_th_as_in_think`、`/rcolored_vowel_sound_ur_as_in_first`，标题即音标，可直接按 IPA 表顺序刷。重音节奏用 Rachel's 的 Intonation / Word Stress 分类，加 Tim 的 ep-6（schwa）、ep-3（叠音）、ep-17（爆破音）。

**数据**：

- **CMUdict**：135,166 条，ARPAbet 带重音；[github.com/cmusphinx/cmudict](https://github.com/cmusphinx/cmudict)。许可原文：任何研究或商业用途完全不受限，只需致谢——可打包。
- **最小对立对**：未找到开放授权的现成完整词表；可行做法是用 CMUdict 自动生成「等长、仅一个音位不同」的词对（我的推断）。Ship or Sheep 的单元词表仅可链接。
- **中国学习者常见问题**：`/r l ŋ θ ð ʃ tʃ h v w/`、词尾辅音删除、辅音簇；见 [Zenodo 2025 论文（CC BY 4.0）](https://zenodo.org/records/15524829)。词尾 `/l/`、`/n/` 删除会显著降低可懂度：[Zhang & Levis 2020](https://www.iastatedigitalpress.com/psllt/article/15433/galley/13492/download/)。

## 2. 词表

| 名称 | 规模 | 许可 | 地址 | 口语适配 |
|---|---|---|---|---|
| NGSL | 2,809 词，覆盖通用英语 92%+ | CC BY-SA 4.0 | [newgeneralservicelist.com](https://www.newgeneralservicelist.com/new-general-service-list) | 通用底座 |
| **NGSL-S** | 721 词，覆盖口语 90% | CC BY-SA 4.0 | [ngsl-spoken](https://www.newgeneralservicelist.com/ngsl-spoken) | **最适合口语优先** |
| NAWL | 960 词，学术文本 92% | 免费，站点未标 CC 版本 | [newacademicwordlist.org](https://www.newacademicwordlist.org/) | 学术 |
| Oxford 3000/5000 | 3000 + 2000，A1–C1 | © OUP，PDF 可免费下 | [oxfordlearnersdictionaries.com](https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000) | 分级好，不能打包 |
| GSL | 约 2000 词（West 1953） | 无明确现代许可 | — | 过时 |
| AWL | 570 词族 | © 惠灵顿维多利亚大学，免费 | [wgtn.ac.nz](https://www.wgtn.ac.nz/lals/resources/academicwordlist) | 学术 |
| COCA（含口语子库） | 免费前 5000；全量付费 | 限制商用 | [wordfrequency.info](https://www.wordfrequency.info/free.asp) | 词频参考 |
| EVP | CEFR 分级词表 | © Cambridge | [englishprofile.org](https://englishprofile.org/) | 在线查，不能批量下 |
| ECDICT | 数十万条 | MIT | [GitHub](https://github.com/skywind3000/ECDICT) | 已有 `bnc`、`frq`、`collins`、`oxford`、`tag` 字段 |

**结论**：口语排序用 NGSL-S 起步（721 词即覆盖九成口语），再用 NGSL 扩到 2,809；ECDICT 只做查词/标注，不用于排序；Oxford 3000/5000 只可链接。

## 3. 分级 can-do

| 来源 | 内容 | 获取 | 能否当关卡 |
|---|---|---|---|
| **CEFR Companion Volume 2020** | 278 页，口语互动、口语产出的多张量表，A1–C2 | [免费 PDF](https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4) | **可以**；© 欧洲委员会，成段复制需许可，建议改写成自己的中文 can-do |
| GSE | 10–90 分，五套 learning objectives，与 CEFR 对齐 | [Pearson 免费 PDF](https://www.pearson.com/content/dam/one-dot-com/one-dot-com/english/SupportingDocs/gse-learning-objectives/Adult-Professional-English-new.pdf) | 可参考；© Pearson，不能搬 |
| English Profile / EVP | 按 CEFR 分级的词义、语法 | [englishprofile.org](https://englishprofile.org/) | 免费在线查，不可批量下；仅链接 |
| ACTFL 2024 | 听说读写四项，Novice–Distinguished 五档 | [官方页](https://www.actfl.org/educator-resources/actfl-proficiency-guidelines) | 仅非营利教学、须全文复制，商用禁止 |

**结论**：CEFR CV 最适合做关卡清单。可直接拿 B1/B2 的 *Overall oral interaction* 做毕业标准（B2 原文：能较流利自然地互动，不使对方紧张，能说明经历意义并清楚论证观点），再向下拆成 25 分钟任务。

## 4. 成体系教材

| 教材 | 编排思路 | 级别/学时 | 适合 |
|---|---|---|---|
| [新概念英语](https://en.wikipedia.org/wiki/New_Concept_English)（L.G. Alexander, Longman） | 语法/句型螺旋，4 册，课文带词汇与练习 | 无官方学时；按课数估 300–400h（推断） | 自学语法底子 |
| [English File](https://openlibrary.org/search?q=english+file+fourth+edition)（OUP；美式版 American English File 结构相同） | 话题 + 功能，每单元 A/B/C 三课，含 Sound Bank 发音 | 7 级 A1–C1（含 Intermediate Plus），约 80–120h/级（出版社常标，未逐页核实） | 最像口语课 |
| [Interchange](https://openlibrary.org/search?q=interchange+fifth+edition)（Cambridge） | 功能/话题，每单元两个 Cycle，听说读写循环 | 4 级，约 50–60h/级（同上） | 25 分钟/天最合适 |
| [Headway](https://openlibrary.org/search?q=headway+fifth+edition)（OUP） | 话题 + 语法，6 级 | 约 100h/级 | 综合 |
| [Side by Side](https://openlibrary.org/search?q=side+by+side+plus)（Pearson） | 语法结构 + 生活技能，4 级 | 约 40–60h/级 | 零基础 |
| [English Grammar in Use](https://en.wikipedia.org/wiki/English_Grammar_in_Use)（Murphy） | 按语法点排列的参考+练习，3 级 | 非课程，无学时 | 不能当大纲 |
| [Pimsleur](https://www.pimsleur.com/) | 音频先行、间隔回忆、30 分钟/课 | 30 课/级，5 级约 80h（以法语课为例） | 通勤磨嘴 |

注：OUP/Cambridge 官网对脚本返回 202/403，故书目链接改用 Wikipedia/Open Library；除 Pimsleur 外，学时均为出版社常标或按课数估算，未逐页核实，新概念为推断。

**结论**：搬 English File 的「话题→功能→语法→发音」单元结构最适合口语课；若每天只有 25 分钟，用 Interchange 的 4 级更紧凑。

## 5. 可下载音频

| 来源 | 能否搬 | 许可 | 说明 |
|---|---|---|---|
| **VOA Learning English** | **可搬** | 公共领域（美国政府作品）；AP/Reuters/AFP 素材除外 | 官方原文允许教育及商业转载，须注明 learningenglish.voanews.com；[课程页](https://learningenglish.voanews.com/a/lets-learn-english-less-one/3111026.html)含 MP3 + 文字稿 |
| BBC Learning English | 仅链接 | © BBC | 除发音外还有 [6 Minute English](https://www.bbc.co.uk/learningenglish/english/features/6-minute-english) 等分级栏目 |
| ESLPod | 仅链接 | © Center for Educational Development；仅流式 | 不能下载转发 |
| LibriVox | 可搬 | 公共领域 | 文学朗读，不是口语 |
| Tatoeba | 文本可搬，音频逐条 | 文本 CC BY 2.0 FR；音频多为 CC BY-NC-ND 3.0 | 见第 6 节 |
| Mozilla Common Voice | 可搬 | CC0 | 语音片段 + 文本，适合做识别/跟读素材 |
| Elllo | 仅链接 | © Todd Beuckens | 分级听力，A1–C1 |
| TED | 仅链接 | CC BY-NC-ND 4.0 | 政策明确禁止「in an app of any kind」 |

## 6. 中英句库

**Tatoeba**（2026-11-07 导出）：中英链接 **78,317 对**；有英文译句的中文 **66,359 条**；有中文译句的英文 **72,957 条**；其中英文侧带音频 **41,919 对**。文本默认 CC BY 2.0 FR，可商用需署名。音频许可很集中：40,280 条为 CC BY-NC-ND 3.0，370 条 CC BY 4.0、356 条 CC BY-SA 4.0、380 条 CC BY-NC 4.0，其余为空——**文本能用，音频基本不能用于商业产品**。

质量：以短句、日常口语为主，适合「看中文说英文」；但繁简混杂、翻译腔、一英多中、部分句子不自然（抽样见「你好香」这类），需去重、按长度/CEFR 过滤并人工抽检。

其他：OPUS（[opus.nlpl.eu](https://opus.nlpl.eu/)）聚合 Tatoeba、TED2020、OpenSubtitles、UN 等；TED2020 为 NC-ND，OpenSubtitles 版权不清，商用不建议。Tatoeba 是「数量够 + 许可清楚 + 口语化」的最实用现成选择。

## 7. 建议：只选四样

1. **大纲：CEFR Companion Volume 的口语互动/产出量表**。免费、A1–C2 完整、天然是 can-do；把 B1/B2 描述改写成中文关卡，每关 25 分钟：5 分钟发音 + 10 分钟跟读/影子 + 10 分钟情景对话。
2. **词表：NGSL-S（721 词）**。90% 口语覆盖，CC BY-SA 4.0 可商用（须署名、衍生列表同协议），规模刚好够 25 分钟/天的节奏；学完再用 NGSL 扩到 2,809。
3. **发音：Sounds American**。美音、一音一页、按 IPA 顺序可排成 48 条发音课（覆盖 44 音位）；重音节奏用 Rachel's，连读弱读用 Tim's Workshop 补。若接受英音，直接换 BBC 的 44 集。
4. **音频：VOA Learning English**。美国政府作品、公共领域、MP3 与文字稿齐全，可合法打包并注明来源；这是最省事、也最没有版权风险的成体系课程音频。

理由：四样都能合法落地、覆盖 0→B2，且与「本机 Whisper 识别 → 大模型点评 → 情景对话」的闭环直接咬合；商业教材和 BBC/TED 只做外链，不碰版权红线。
