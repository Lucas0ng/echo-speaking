# Windows 版方案（草稿）

> **状态：方案草稿，未开工。** 2026-10-25 定稿前别动代码；开工前先把「待定决策」里的问题问清楚。
> 读者是接手的 AI 会话：先读本文件，再读 `app.py` 里下面点名的函数。行号会漂移，以函数名为准（写本文时基于 main `2a77ea3`）。

## 0. 一句话

Mac 版只有「语音识别」和「启动 / 打包」两层绑死在 Apple 芯片上；把识别抽成可切换的后端（Mac → mlx-whisper，Windows → faster-whisper），再补 Windows 启动脚本，就能出 Windows 源码版。前端一行不改。

## 1. 现状：哪些是 Mac 专属

| 位置 | Mac 专属的点 | Windows 怎么办 |
|---|---|---|
| `app.py` `whisper_run()`（约 250 行） | `mlx_whisper.transcribe`，支持 `word_timestamps` 和 `initial_prompt`（`FILLER_PROMPT` 靠它让 Whisper 写出 um/uh） | 换后端，见 §3 |
| `app.py` `whisper_text()`（约 345 行） | 同上，无词级时间戳 | 同上 |
| `app.py` `transcribe_file_inproc()`（约 628 行） | 同上，子进程里整段转写课程音频 | 同上 |
| `app.py` `DEFAULTS["whisper_model"]` | 值是 mlx 格式仓库 `mlx-community/whisper-large-v3-turbo` | 需按后端区分模型名，见 §3 |
| `app.py` `use_hf_mirror_if_needed()` | 不是 Mac 专属，已会在连不上 HF 时切 hf-mirror.com；但它用 `CFG["whisper_model"]` 判断缓存，要跟着改 | 改成检查当前后端实际用的模型 |
| `requirements.txt` | `mlx-whisper==0.4.3` | 用环境标记分平台，见 §4 |
| `start.command` | zsh、`lsof`、`open`、要求 arm64 | 新增 `start.bat`，见 §4 |
| `下载课程.command` | zsh、`curl` | 新增 `下载课程.bat`；`tools/download_lessons.py` 本身跨平台 |
| `mac/`（Swift 外壳）、`dist/回声.app` | 只服务 Mac | Windows 第一期不做对应物 |

**已经跨平台、不用改的：** `static/` 全部前端（浏览器录音在 `127.0.0.1` 上允许）；FastAPI / uvicorn / `av` 解码 / numpy；`pathlib` 路径；「在文件夹中显示」（`app.py` 里已有 `sys.platform == "win32"` 分支）；Anki 导出写 `~/Downloads`。

## 2. 目标与范围

- **第一期（本方案）：** Windows 10/11 x64 源码版。用户自己装 Python（或由脚本用 uv 自动装），双击 `start.bat` 能用完整功能，和 Mac 版行为一致。
- **第二期（看反响）：** 带 Python 和依赖的一键安装包（PyInstaller 或 Inno Setup）。本文不展开。
- **不做：** Linux 适配（顺带能跑就跑，不保证）；Windows 原生窗口外壳。

## 3. 识别后端

### 3.1 结构

在 `app.py` 里新增一个统一入口，三处调用都改走它：

```python
def stt(audio: np.ndarray, words: bool = False, prompt: str | None = None) -> dict:
    """返回 mlx-whisper 同款结构：{"text", "segments": [{"text", "start", "end", "words": [{"word", "start", "end", "probability"}]}]}"""
```

- `STT_BACKEND = "mlx"`（darwin + arm64）或 `"faster"`（其他平台）；`config.json` 里可用 `stt_backend` 覆盖（方便在 Mac 上测 faster 后端）。
- faster-whisper 返回的是 `Segment` / `Word` 对象的生成器，在 `stt()` 里转成上面的 dict。**下游 `to_sentences()`、`word_list()`、流利度指标、跟读打分一律不改。**
- 保持现有参数语义：`language="en"`、`condition_on_previous_text=False`、`initial_prompt=prompt`、`word_timestamps=words`。
- 模型对象在 faster 后端里要缓存（`WhisperModel` 加载一次），继续用 `MODEL_LOCK` 串行化。

### 3.2 模型与设备

| 机器 | device / compute_type | 模型 |
|---|---|---|
| 有 NVIDIA 显卡（≥ 4GB 显存） | `cuda` / `float16` | large-v3-turbo 的 CTranslate2 版 |
| 无 N 卡 | `cpu` / `int8` | 小一点的多语模型（候选 `small`），设置里可改 |

- 配置键从单个 `whisper_model` 拆成按后端取值（例如 `whisper_model_mlx` / `whisper_model_faster`，旧的 `whisper_model` 继续当 mlx 用，兼容已有 `config.json`）。
- large-v3-turbo 的 CT2 仓库名开工时现查（候选 `mobiuslabsgmbh/faster-whisper-large-v3-turbo`、`deepdml/faster-whisper-large-v3-turbo-ct2`），确认 hf-mirror.com 上能下。
- CUDA 不可用时（缺 DLL、驱动太旧）**自动退回 CPU**，并在 `/api/status` 里说明原因，页面能看到，不要静默。

### 3.3 Windows 上的 CUDA 运行库（最大风险）

- faster-whisper ≥ 1.1 需 CUDA 12 的 cuBLAS + cuDNN 9。候选做法：`pip install nvidia-cublas-cu12 nvidia-cudnn-cu12`，启动时用 `os.add_dll_directory()` 把这两个包里的 `bin` 目录加进去。
- 这条只能在真 Windows 上验证；验证不过就换方案（下载独立 DLL 包放进项目目录）。

## 4. 依赖与启动

- `requirements.txt` 用环境标记，仍是一个文件：
  ```
  mlx-whisper==0.4.3; sys_platform == "darwin"
  faster-whisper==<开工时定>; sys_platform != "darwin"
  nvidia-cublas-cu12; sys_platform == "win32"
  nvidia-cudnn-cu12; sys_platform == "win32"
  ```
  （CUDA 包约 1GB，没 N 卡的人也会装上；要不要拆成可选，开工时再定。）
- `start.bat`：照 `start.command` 的流程——
  1. 端口 8765 已占用 → 直接打开浏览器退出；
  2. 没有 `.venv` → 装 uv（PowerShell 安装脚本）→ `uv venv --python 3.12` → 装依赖，官方源失败换清华镜像；
  3. `set PYTHONUTF8=1`，`chcp 65001`，避免中文路径 / 中文输出乱码；
  4. 延迟 2 秒打开 `http://127.0.0.1:8765`，前台跑 `.venv\Scripts\python app.py`。
- `下载课程.bat`：跑 `tools/download_lessons.py`；ECDICT 词典下载用 PowerShell `Invoke-WebRequest` 或改成 Python 下载（更省事，可以顺手把 `.command` 里的 curl 也换掉）。
- `.bat` 文件要用 CRLF 换行；中文提示语注意编码（UTF-8 + `chcp 65001`），实测为准。

## 5. 验证

### 5.1 先在 Mac 上（不用 Windows）

- `config.json` 设 `stt_backend: faster`、CPU，跑通全部功能。
- 对比测试：同一组录音（课程句子 + 自己说话录音各几段）分别过 mlx 和 faster 后端，比较词数、词级时间戳、语速 / 填充词 / 连贯语段三项指标。差异要在可接受范围（开工时定阈值），并记在本文 §8。

### 5.2 Windows 自检脚本

`tools/selfcheck.py`，`start.bat` 第一次装完后自动跑，也能单独双击（`自检.bat`）。输出 `selfcheck.log`，内容：
- 系统版本、Python 版本、项目 git 提交号；
- `nvidia-smi` 结果（显卡型号、驱动版本、显存）；
- CUDA DLL 能否加载、实际用的 device / compute_type、模型名；
- 模型下载用的源（官方 / 镜像）和耗时；
- 识别一段内置示例音频的耗时和结果文本；
- 课程音频目录、`data/` 是否可写。

**不能写进日志：** `config.json` 里的 API key、用户名以外的个人路径信息尽量缩写成 `~`。

### 5.3 Windows 手测清单（在测试机上逐条打勾）

1. 全新解压 → 双击 `start.bat` → 浏览器自动打开，首页正常。
2. `/api/status` 显示 cuda、模型就绪。
3. 走完一节课：跟读打分、语调曲线、语块造句、复述。
4. 「我的素材」导入一段 mp3 → 自动转写出逐句字幕。
5. 自由说话录音 → 三项流利度指标有值且合理。
6. AI 对话（填 API key）、卡片复习、发音体检、导出 Anki。
7. 关掉窗口再开：进度、录音都在。
8. 中文路径：项目放在含中文的目录下也能跑。

## 6. 测试环境与协作方式

- 测试机：开发者的 Windows 电脑，RTX 2070 Super（8GB）。那台电脑装不了 Claude，可以装 DeepSeek。
- 代码只在 Mac 上的 Code 会话里改（遵守「同一时间只有一个会话改代码」）。Windows 上：
  - 用 GitHub zip 或 U 盘拿代码；
  - 安装环境的小问题可以问 DeepSeek，但**不在 Windows 上改代码**；
  - 把 `selfcheck.log` 和手测结果（文字或截图）带回 Mac 会话，由 Claude 修。

## 7. 开工步骤（每步完成提交一次）

1. `stt()` 统一入口 + mlx 后端，三处调用改走它；Mac 上行为不变（回归：跑一节课）。
2. faster 后端 + 配置键拆分 + `/api/status` 显示后端与设备；Mac 上用 CPU 跑通 + §5.1 对比。
3. `requirements.txt` 环境标记；`start.bat`、`下载课程.bat`。
4. `tools/selfcheck.py` + `自检.bat`。
5. README 加 Windows 安装说明（公开文件，署名 Lucas）。
6. Windows 实测 → 修 → 再测，直到 §5.3 全过；结果记入 §8。
7. 发布渠道按「待定决策」执行。

可交给 DeepSeek Harness 的部分：`.bat` 脚本、`selfcheck.py` 的信息收集部分、README 文字。`stt()` 适配层和 CUDA 加载由 Claude 写。

## 8. 待定决策（开工前问用户）

1. 来要 Windows 版的人大多会不会自己装 Python？如果不会，第一期可能直接做安装包。
2. 之后加新功能是否每次两个平台都测，还是 Mac 先发、Windows 跟进？
3. 发布渠道：GitHub Release / 网盘 / 都放？
4. CUDA 依赖约 1GB：所有 Windows 用户都装，还是没 N 卡的跳过？

## 9. 记录

（开工后在这里记：实测数据、对比结果、踩到的坑、决定。）
