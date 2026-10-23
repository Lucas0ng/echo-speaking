# 回声 · Echo（本地版）

**Mac App（推荐）**：打开 `dist/回声.dmg`，把「回声」拖进「应用程序」，以后从启动台或 Dock 打开。App 会自己在后台启动服务，退出 App 时一起关掉；第一次录音时系统会问麦克风权限。App 只是窗口外壳，用的还是这个文件夹里的代码、`.venv` 和 `data/`，所以这个文件夹不要挪走（挪了就在新位置运行一次 `mac/build.sh` 重新打包）。改了 `mac/` 里的代码也用 `mac/build.sh` 重新打包；改网页代码不用重新打包，⌘R 刷新即可。

**浏览器版**：双击 `start.command` 启动，浏览器打开 http://127.0.0.1:8765 。用完关掉终端窗口。

- 课程音频读自 `~/Downloads/正版雅思听力资源`（在 config.json 的 media_dir 里改）。
- 逐句字幕和录音转写用本机 Whisper（mlx-community/whisper-large-v3-turbo），不联网。字幕缓存在 data/transcripts/。
- API key 在软件「设置」页填写，保存在本文件夹的 config.json（只有你能读）。
- 练习进度和语块本保存在 data/progress.json；每次开口的录音、转写和语速等指标存在 data/recordings/。备份整个 data 文件夹即可。
- 点词查词用离线词典 ECDICT（MIT 许可）：`data/dict/ecdict.csv` 从 https://github.com/skywind3000/ECDICT 下载，运行 `.venv/bin/python tools/build_dict.py` 生成 `data/dict/ecdict.sqlite`。
- 推荐用 Chrome 打开；第一次录音时允许麦克风。
