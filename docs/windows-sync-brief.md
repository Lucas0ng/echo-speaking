# 任务单：把 Windows 版同步到 Mac 版的新课程

写给在 Windows 电脑上工作的 DeepSeek。写于 2026-11-15（台北时间），Mac 版当时在 main 的 `b41fa64`。

## 一句话

`windows/` 是回声 Windows 版的整份独立副本，停在 2026-10-26 的 `9c708c2`。之后 Mac 版做了一次大改版（新课程 Rebirth），Windows 版一行都没跟上。你的任务是把这些改动搬进 `windows/`，同时保留 Windows 自己的部分（faster-whisper 识别、`.bat` 启动、CUDA 退回 CPU），然后在这台 Windows 电脑上实际测一遍。

## 先读什么

1. 仓库根目录的 `README.md`：「新课程：从 3000 节倒数」一节讲了要同步过来的功能。
2. `docs/windows-plan.md`：Windows 版当初怎么做的，尤其是 §1（哪些是 Mac 专属）、§3（识别后端）、§9（记录）。
3. `docs/rebirth/HANDOFF-from-fable.md` 的「踩过的坑」：同步时最容易漏的几处都在那里。

## 范围

**要做的：**

- 把 Mac 版在 `9c708c2..b41fa64` 之间对 `app.py` 和 `static/` 的改动搬进 `windows/app.py` 和 `windows/static/`。
- 更新 `windows/README.md`，写明新课程和新的可选服务。
- 在 Windows 上把下面「怎么验证」逐条测完。测试中发现的 Windows 专属问题可以顺手修，每个问题单独提交。

**不要做的：**

- 不改 `windows/` 以外的任何文件。唯一的例外是在 `docs/windows-plan.md` §9 末尾追加记录。
- 不改课程内容（`course.json`、`placement.json`），原样复制。
- 不搬 `mac/`（Mac 窗口外壳）和 `tools/check_vocab.py`、`tools/gen_units.py`、`tools/wordlists/`。这些是 Mac 端生产课程用的，Windows 版用不到。
- 不顺手重构、改名、调格式。和这次同步无关的地方一律不动，方便对方审查。

## 怎么搬

先让 git 自动套补丁，再手工处理套不上的部分：

```bash
git checkout -b windows-sync
git diff 9c708c2 b41fa64 -- app.py static > mac.diff
git apply --directory=windows --reject mac.diff
```

- 新文件（`course.js`、`course.json`、`placement.js`、`placement.json`）会直接建在 `windows/static/` 里。
- 套不上的部分写在对应的 `.rej` 文件里，逐个手工合并，合并完删掉 `.rej` 和 `mac.diff`。
- 套完之后，用 `git diff 9c708c2 b41fa64 --stat -- app.py static` 对照一遍，确认每个文件的改动都过来了。

### 会冲突的地方，以及怎么取舍

在 Mac 上演练过这条命令：`index.html`、`style.css` 和四个新文件能直接套上；`app.py` 有 4 处、`static/app.js` 有 3 处套不上，要手工合并。

**最要紧的一处**：`static/app.js` 的 `boot` 里，从 `/api/state` 载入进度的字段名单要加上 `'rb'`，名单后面还要等 `COURSE_READY` 和 `PLACEMENT_READY` 载入完。这处在被拒的补丁里。漏了的话页面照样能打开，但新课程的进度下次保存就丢，而且不会报错。

| 位置 | Mac 版改了什么 | Windows 版应当 |
| --- | --- | --- |
| `app.py` 的识别入口 | Mac 的 `whisper_run()` 多了参数 `max_tokens`：短录音限制输出长度，交给 mlx 的 `sample_len`。新增 `looped()`：识别结果像在打转（同一串字符反复出现）时按没听清处理。`api_stt` 里按录音长短算出 `cap` 传进去。 | Windows 的识别都走 `stt()` → `_stt_once()`。给 `stt()` 加同样的 `max_tokens` 参数，faster-whisper 传 `max_new_tokens`（先在已装版本的 `WhisperModel.transcribe` 签名里确认参数名），mlx 分支传 `sample_len`。CUDA 失败退回 CPU 的逻辑原样保留。`looped()` 照搬。 |
| `app.py` 新增的接口 | `/api/tts`、`/api/tts/voices`（阿里云百炼语音合成，缓存在 `data/tts/`）；`cloud_asr()`（DeepSeek 语音识别，短句走云端，失败退回本机）；`api_stt` 多了参数 `cloud`；录音种类 `KINDS` 加了 `course`。 | 照搬。缓存文件路径只用 `pathlib`，不拼反斜杠。 |
| `app.py` 的 `DEFAULTS` | 加了语音合成和云端识别的配置项。 | 和 Windows 自己的 `whisper_model_faster` 等键并存，两边都留。 |
| `static/app.js` 的设置页 | 新增两个开关：「语音识别」（本机 / DeepSeek）和「百炼语音合成」（开关、选嗓音、试听）。 | 放在 Windows 设置页里「本地 Whisper 字幕」那一栏的后面，Windows 自己显示 cuda 还是 CPU 的那一行保留。 |
| `static/app.js` 的 `api()` | 连不上服务时：在 Mac App 窗口里（`window.webkit?.messageHandlers?.kaikou` 存在）说"正在自动重启"，否则提示看终端窗口。 | 保留 Windows 现有的 `IS_MAC ? … : '…确认 start.bat 的窗口还开着…'`。Mac App 那个分支可以并进来放在最前面，不影响 Windows。 |
| `static/index.html`、`static/style.css` | 导航加了「雅思跟读」，多加载两个脚本；末尾加了新课程样式。 | 演练时能直接套上。套完看一眼：Windows 的标题图标和 `pageHelp` 按钮还在。 |

`guide.js` 在 Mac 这边没改过，Windows 版之前修的「重复声明 `KEY`」继续保留。

## 怎么验证

在这台 Windows 电脑上，用你自己的 Python 环境实际跑，不要只看代码。每一条写明通过还是没通过；没通过的，写清现象和原因。

1. 双击 `start.bat` 能起来，浏览器（Chrome 或 Edge）按 F12 看控制台，没有红色报错。
2. 「今天」页显示新课程：倒计时、离里程碑几节、「开始第 N 节」。「雅思跟读」页还是旧课程，能打开。
3. 定位测试能做完一级，结果页有表格。测之前先把 `windows/data/progress.json` 复制一份，测完复制回去，别影响真实使用。
4. 刷新页面后进度还在：上完一段或做完定位测试后按 F5，倒计时、做到哪一节不变（检查 `'rb'` 那处有没有合并好）。
5. 上一节完整的课：回忆、声音、新句、用、快五段都能录音、出识别结果、往下走；「用」段的 AI 角色扮演能来回几轮，「用上今天的句型」计数会涨。
6. 点句子里的词能出词典卡；「拆句」能出结果；拆句失败时按钮变成「重新拆句」，再点会重新请求。
7. **短录音不打转**：在声音段只说一个词，识别要在几秒内返回，不能卡一分钟或返回一长串重复字符。这条是 faster-whisper 上 `max_new_tokens` 和 `looped()` 是否生效的直接证据，务必测。
8. 朗读：百炼语音合成没开时用系统声音，要确认选到的是英语声音（Windows 自带的有 Microsoft David、Zira 等），不能用中文声音读英文。开了百炼（需要 key）能正常合成，第二次读同一句不再联网。
9. 设置里打开 DeepSeek 语音识别后，短句识别明显变快；对话段「卡住了」出现「用中文说」。
10. 显卡和 CPU 两条路都还能用：设置页「本地 Whisper 字幕」一栏写明当前是 `cuda` 还是 CPU。如果方便，在 `config.json` 里强制用 CPU 再测一遍第 5 条。
11. 第 10 节和第 20 节是综合课（`kind: "mix"`）。不用真的上到那里；在控制台把 `S.rb.unit` 临时改到对应下标，看「用」段显示的是「用上本块的不同句型：n / 3」就行。改完要改回来，并且不要保存。

## 交回什么

- 在分支 `windows-sync` 上提交。每一步一个提交，提交信息用英文写清做了什么。只推送这个分支，或者把整个仓库打包成 zip。**不要合并或推送到 main**，由 Mac 端审查后再合入。
- 在 `docs/windows-plan.md` §9 末尾追加一条记录，写这几样：
  - 日期
  - 同步到 Mac 的哪个提交
  - 哪些冲突是怎么取舍的
  - 上面 11 条验证的结果
  - 这台电脑的显卡、驱动版本、实际用的 device 和模型
  - 还没解决的问题
- 最后给用户几句中文回报：做了什么、哪几条验证没过、需要 Mac 端看的地方。

## 注意

- 仓库是公开的。提交里不写真实姓名、电脑用户名、本机路径，也不提交 `config.json` 和 `data/`（它们本来就在 `.gitignore` 里）。
- `.bat` 文件用 CRLF 换行，中文提示用 UTF-8 加 `chcp 65001`，以实测为准。
- 拿不准的取舍，按"和 Mac 版行为一致"来定，并写进记录，不要自己发明新行为。
