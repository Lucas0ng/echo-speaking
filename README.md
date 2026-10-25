# 回声 · Echo

一个逼你开口的英语口语练习软件，每天约 15 分钟，跑在你自己的 Mac 上。

市面上的口语 App 大多在点选、认词、刷题。回声反过来：**每一步都要你说出来，每次开口都自动录音存档，进步只看录音和真实指标**（语速、填充词、连贯语段长度），不做打卡天数、"流利度 74%" 这类数字。

## 能做什么

- **逐句跟读**：IELTS 口语范例逐句跟读，每句一个练习重点（连读、重音或语调），语调曲线和原声对比。
- **今日语块**：从 BBC *The English We Speak* 学一个地道说法，马上用它说一句你自己的话。
- **开口说**：不看稿就本课话题说 1–2 分钟。点评前先按提示自己改对一处、说出来，再看「你说的 vs 母语者会怎么说」。不给分数。
- **4/3/2 复述、自言自语**：同一段内容限时 4、3、2 分钟连说三遍；60 秒不停说、看图描述、睡前复述今天。
- **语块本、错误本**：开口式间隔复习（看中文说整句，Whisper 判对错）；个人错误同时最多盯 5 条，48 小时复检，说对就毕业。
- **发音**：发音体检找出你分不清的音，生成专属的最小对立对，先听辨再跟读。
- **AI 对话**：聊课程话题，或演练点餐、问路等日常场景；对话中不打断，结束后统一反馈。
- **进步**：所有录音和指标曲线；同一道题的基准录音，第 1 次和现在并排听。
- **我的素材**：导入你自己的英语音频（播客、课本录音、视频都行），本机生成逐句字幕后，和每天的课一样逐句跟读。
- 点词查词（离线词典）、语块导出到 Anki。

## 需要什么

- **Apple 芯片的 Mac**（M1 及以后），macOS 12 以上。语音转文字用本机 Whisper（MLX），不联网。
- 约 5GB 磁盘：Whisper 模型约 1.6GB，课程音频约 1GB，词典约 150MB，再加 Python 环境。
- Chrome 浏览器（也可以自己打包成 Mac App，见下文）。
- **DeepSeek API key（必需）**：句型讲解、点评和 AI 对话都靠它。在 [platform.deepseek.com](https://platform.deepseek.com) 注册、充值几块钱、创建 key。按量付费，每天练 15 分钟大约 ¥0.1–0.3。也可以改用智谱 GLM。
- **阿里云百炼 API key（可选）**：「AI 听发音」用 Qwen-Omni 听你的录音点评发音。不填，其他功能照常用。

## 安装

1. 下载代码：

   ```bash
   git clone https://github.com/Lucas0ng/echo-speaking.git
   ```

   也可以在本页点 **Code › Download ZIP** 后解压。用 ZIP 的话，第一次要**右键点 `start.command` › 打开**（macOS 会先拦一下网上下载的脚本）。

2. 双击 **`start.command`**。第一次会装好 uv 和 Python 依赖（几分钟，只需一次），然后浏览器自动打开 http://127.0.0.1:8765 。
3. 双击 **`下载课程.command`**：从官方播客源下载课程音频（约 1GB，可以中途关掉，下次接着下）和离线词典。下完后关掉 start.command 的窗口，再双击它重新打开。

   在中国大陆，BBC 的播客源一般要开代理才能下。BBC 没下到也能用：每课只是少了「今日语块」这一步，跟读和开口说照常。一节课都没下到的话，可以先在「我的素材」里用自己的音频练。
4. 照「今天」页顶部的「开始使用」清单做：填 API key、允许麦克风、录一段基准录音。

第一次转写时会自动下载 Whisper 模型；连不上 Hugging Face 时自动改用 hf-mirror.com 镜像。课程的逐句字幕会在你不练习的时候后台逐集生成。

### 打包成 Mac App（可选）

装好 Xcode 命令行工具（`xcode-select --install`）后，在项目文件夹运行 `mac/build.sh`，得到 `dist/回声.dmg`，把「回声」拖进「应用程序」。App 只是窗口外壳，用的还是这个文件夹里的代码和数据，所以打包后不要挪动这个文件夹。

## 用自己的音频

打开「我的素材」页，点「导入音频…」选文件；或者点「在访达中打开文件夹」，把文件拖进去再点「刷新」。文件夹在课程音频文件夹里，叫 `我的素材`。

支持 mp3、m4a、aac、wav、flac、ogg、opus、webm、mp4、mov。本机 Whisper 会在后台给每个文件生成逐句字幕，长音频要几分钟。字幕好了，就能逐句跟读、看句型、点词查词。素材不算进课程编号和进度。

## 数据和隐私

- 进度、录音和转写都存在项目里的 `data/` 文件夹，备份它即可；API key 存在 `config.json`。这两样都在 `.gitignore` 里，不会被提交。
- 语音转文字在本机完成。只有用到 AI 功能时，相关文字（「AI 听发音」时是那段录音）才会发给你自己配置的 AI 服务。

## 课程音频

音频来自 [IELTSCast](https://ieltscast.libsyn.com/)（Ryan Higgins）和 [BBC Learning English](https://www.bbc.co.uk/learningenglish/) 的官方公开播客源，由 `tools/download_lessons.py` 从官方地址下载到你自己的电脑，仅供个人学习，版权归原发布方。本仓库不包含、也不分发任何音频。

## 方法依据

- [需求与设计原则](docs/speaking-app-brief.md)
- [方法调研与功能清单](docs/speaking-app-research.md)
- [9 个方法的完成情况](docs/method-checklist.md)

## 致谢

- [ECDICT](https://github.com/skywind3000/ECDICT)（MIT）：离线英汉词典
- [Whisper](https://github.com/openai/whisper) 和 [mlx-whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper)：本机语音识别
- IELTSCast、BBC Learning English：课程音频

## 许可证

代码以 [MIT](LICENSE) 许可发布。
