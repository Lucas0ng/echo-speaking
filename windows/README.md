# 回声 · Echo（Windows 版）

这个文件夹是回声的 Windows 版，功能和 Mac 版一样（介绍见[上一层的 README](../README.md)）。区别只在两处：语音转文字用本机 faster-whisper（Mac 版用 MLX），启动用 `.bat` 脚本。

## 最省事的装法

复制本仓库的网址 https://github.com/Lucas0ng/echo-speaking 发给豆包，打开「工作模式」，告诉它"帮我在本地部署 windows 文件夹里的回声"。想自己动手，照下面的步骤。

## 需要什么

- Windows 10/11 64 位，Chrome 或 Edge 浏览器。
- 有 NVIDIA 显卡、显存约 4GB 以上时用显卡识别（float16），一句话不到一秒；没有的话自动改用 CPU 和小一点的模型，慢一些但能用。
- 约 6GB 磁盘：Whisper 模型约 1.6GB，CUDA 运行库约 1GB，课程音频约 1GB，词典约 150MB，再加 Python 环境。
- **DeepSeek API key（必需）**：句型讲解、点评和 AI 对话都靠它。在 [platform.deepseek.com](https://platform.deepseek.com) 注册、充值几块钱、创建 key。每天练 15 分钟大约 ¥0.1–0.3。也可以改用智谱 GLM。
- **阿里云百炼 API key（可选）**：「AI 听发音」用。不填，其他功能照常用。

## 安装

1. 在仓库页点 **Code › Download ZIP** 解压（或 `git clone`），进入里面的 `windows` 文件夹。
2. 双击 **`start.bat`**。第一次会装好 uv 和 Python 3.12 环境（几分钟，只需一次；官方源慢会自动换清华镜像），然后浏览器打开 http://127.0.0.1:8765 。
3. 双击 **`下载课程.bat`**：下载课程音频（约 1GB，可以中途关掉，下次接着下）和离线词典。下完后关掉 start.bat 的窗口，再双击它重新打开。

   在中国大陆，BBC 的播客源一般要开代理才能下。没下到也能用：每课只是少了「今日语块」这一步。
4. 照「今天」页顶部的「开始使用」清单做：填 API key、允许麦克风、录一段基准录音。

第一次转写时会自动下载 Whisper 模型；连不上 Hugging Face 时自动改用 hf-mirror.com 镜像。

## 出问题时

- **设置页**的「本地 Whisper 字幕」一栏写着当前用的是显卡（`cuda`）还是 CPU，以及模型名。显卡用不上时会自动改用 CPU，并在同一行写明原因。
- 双击 **`自检.bat`**：检查显卡、CUDA 运行库，再转写 30 秒课程音频计时，结果写在 `selfcheck.log`（不含 API key），可以把它发给开发者。

## 数据

进度、录音和转写存在这个文件夹里的 `data/`，API key 存在 `config.json`，都不会被提交。语音转文字在本机完成，只有用到 AI 功能时相关文字才会发给你自己配置的 AI 服务。
