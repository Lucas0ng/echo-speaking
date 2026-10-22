# 每天开口（本地版）

双击 `start.command` 启动，浏览器打开 http://127.0.0.1:8765 。用完关掉终端窗口。

- 课程音频读自 `~/Downloads/正版雅思听力资源`（在 config.json 的 media_dir 里改）。
- 逐句字幕和录音转写用本机 Whisper（mlx-community/whisper-large-v3-turbo），不联网。字幕缓存在 data/transcripts/。
- API key 在软件「设置」页填写，保存在本文件夹的 config.json（只有你能读）。
- 练习进度和语块本保存在 data/progress.json；每次开口的录音、转写和语速等指标存在 data/recordings/。备份整个 data 文件夹即可。
- 推荐用 Chrome 打开；第一次录音时允许麦克风。
