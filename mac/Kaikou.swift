// 每天开口 · Mac 外壳 App
// 启动时在后台运行项目里的 `.venv/bin/python app.py`（如果它还没在跑），用 WKWebView 显示界面，退出时关掉自己启动的服务。
// 项目目录在构建时写进 Info.plist 的 KaikouProjectDir。构建：mac/build.sh
import Cocoa
import WebKit

let port = 8765
let base = URL(string: "http://127.0.0.1:\(port)/")!

// Page errors and media capabilities are appended to server.log as "[app …] page …" lines.
let pageProbe = """
(() => {
  const send = (kind, msg) => { try { webkit.messageHandlers.kaikou.postMessage(kind + ': ' + String(msg).slice(0, 800)); } catch {} };
  addEventListener('error', e => send('error', e.message + ' @' + e.filename + ':' + e.lineno));
  addEventListener('unhandledrejection', e => send('rejection', e.reason && (e.reason.stack || e.reason.message || e.reason)));
  const md = navigator.mediaDevices, gum = md && md.getUserMedia && md.getUserMedia.bind(md);
  if (gum) md.getUserMedia = c => gum(c).catch(e => { send('mic', 'failed ' + e.name + ' ' + e.message); throw e; });
  const err = console.error.bind(console);
  console.error = (...a) => { send('console', a.join(' ')); err(...a); };
  addEventListener('load', () => send('probe', JSON.stringify({
    href: location.href, mediaDevices: !!navigator.mediaDevices, getUserMedia: !!navigator.mediaDevices?.getUserMedia,
    MediaRecorder: typeof MediaRecorder, webm: window.MediaRecorder?.isTypeSupported?.('audio/webm;codecs=opus'),
    mp4: window.MediaRecorder?.isTypeSupported?.('audio/mp4'), speech: 'speechSynthesis' in window, secure: isSecureContext })));
})();
"""

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
  var window: NSWindow!
  var web: WKWebView!
  var server: Process?
  var quitting = false

  let projectDir: URL = {
    let p = Bundle.main.object(forInfoDictionaryKey: "KaikouProjectDir") as? String ?? "~/projects/kaikou"
    return URL(fileURLWithPath: (p as NSString).expandingTildeInPath)
  }()

  // ------------------------------------------------------------ window
  func applicationDidFinishLaunching(_ note: Notification) {
    buildMenu()
    let cfg = WKWebViewConfiguration()
    cfg.mediaTypesRequiringUserActionForPlayback = []  // the app plays lesson audio and TTS from code
    cfg.userContentController.addUserScript(WKUserScript(source: pageProbe, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    cfg.userContentController.add(self, name: "kaikou")
    web = WKWebView(frame: .zero, configuration: cfg)
    if #available(macOS 13.3, *) { web.isInspectable = true }  // Safari › 开发 menu can attach
    web.uiDelegate = self
    web.navigationDelegate = self
    web.setValue(false, forKey: "drawsBackground")  // no white flash before the page paints

    window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1240, height: 840),
                      styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
    window.title = "每天开口"
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden  // the rail already shows the name
    window.backgroundColor = NSColor(name: nil) { ap in  // same as --bg in style.css
      ap.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        ? NSColor(srgbRed: 0x12 / 255, green: 0x12 / 255, blue: 0x11 / 255, alpha: 1)
        : NSColor(srgbRed: 0xF6 / 255, green: 0xF5 / 255, blue: 0xF1 / 255, alpha: 1)
    }
    window.minSize = NSSize(width: 720, height: 560)
    window.contentView = web
    window.center()
    window.setFrameAutosaveName("KaikouMain")
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)

    showMessage("正在启动…", detail: "第一次打开要加载本机 Whisper，可能要十几秒。")
    startServerIfNeeded()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

  func applicationWillTerminate(_ note: Notification) {
    quitting = true
    guard let p = server, p.isRunning else { return }
    // background subtitle jobs run as children of the server
    let k = Process()
    k.executableURL = URL(fileURLWithPath: "/usr/bin/pkill")
    k.arguments = ["-TERM", "-P", String(p.processIdentifier)]
    try? k.run()
    k.waitUntilExit()
    p.terminate()
    let deadline = Date().addingTimeInterval(3)
    while p.isRunning && Date() < deadline { usleep(50_000) }
    if p.isRunning { kill(p.processIdentifier, SIGKILL) }
  }

  func showMessage(_ title: String, detail: String, error: Bool = false) {
    let esc = { (s: String) in s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;") }
    let html = """
    <!doctype html><meta charset="utf-8"><style>
    :root { color-scheme: light dark; --bg: #f6f5f1; --ink: #1c1b18; --muted: #7a776f; --accent: #df4a2f; }
    @media (prefers-color-scheme: dark) { :root { --bg: #121211; --ink: #eceae4; --muted: #8e8b83; --accent: #f2603f; } }
    html, body { height: 100%; margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 -apple-system, "PingFang SC", sans-serif; }
    body { display: grid; place-content: center; text-align: center; gap: 10px; padding: 24px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0; }
    p { margin: 0; color: var(--muted); max-width: 46ch; overflow-wrap: anywhere; }
    i { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); justify-self: center; animation: p 1s infinite; }
    i.err { animation: none; }
    @keyframes p { 50% { opacity: .25; } }
    </style><i class="\(error ? "err" : "")"></i><h1>\(esc(title))</h1><p>\(esc(detail))</p>
    """
    web.loadHTMLString(html, baseURL: nil)
  }

  // ------------------------------------------------------------ backend
  func ping(_ done: @escaping (Bool) -> Void) {
    var req = URLRequest(url: base.appendingPathComponent("api/status"))
    req.timeoutInterval = 1.5
    URLSession.shared.dataTask(with: req) { _, resp, _ in
      done((resp as? HTTPURLResponse)?.statusCode == 200)
    }.resume()
  }

  func startServerIfNeeded() {
    ping { up in
      DispatchQueue.main.async {
        if up { self.loadApp(); return }  // started from start.command or another copy: just use it
        self.launchServer()
      }
    }
  }

  func launchServer() {
    let py = projectDir.appendingPathComponent(".venv/bin/python")
    guard FileManager.default.isExecutableFile(atPath: py.path) else {
      showMessage("找不到项目", detail: "没有找到 \(py.path)。项目文件夹换了位置的话，重新运行 mac/build.sh 打包。", error: true)
      return
    }
    let logURL = projectDir.appendingPathComponent("server.log")
    if !FileManager.default.fileExists(atPath: logURL.path) { FileManager.default.createFile(atPath: logURL.path, contents: nil) }
    let log = try? FileHandle(forWritingTo: logURL)
    log?.seekToEndOfFile()

    let p = Process()
    p.executableURL = py
    p.arguments = ["app.py"]
    p.currentDirectoryURL = projectDir
    p.standardOutput = log ?? FileHandle.nullDevice
    p.standardError = log ?? FileHandle.nullDevice
    p.terminationHandler = { proc in
      DispatchQueue.main.async {
        guard !self.quitting else { return }
        self.server = nil
        self.showMessage("后台服务停了", detail: "退出代码 \(proc.terminationStatus)。详细信息在项目文件夹的 server.log 里。按 ⌘R 重试。", error: true)
      }
    }
    do { try p.run() } catch {
      showMessage("启动失败", detail: error.localizedDescription, error: true)
      return
    }
    server = p
    waitForServer(until: Date().addingTimeInterval(90))
  }

  func waitForServer(until deadline: Date) {
    ping { up in
      DispatchQueue.main.async {
        if up { self.loadApp() }
        else if Date() > deadline { self.showMessage("启动超时", detail: "90 秒内服务没有响应。详细信息在 server.log 里。按 ⌘R 重试。", error: true) }
        else if self.server != nil { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.waitForServer(until: deadline) } }
      }
    }
  }

  func loadApp() { web.load(URLRequest(url: URL(string: "#today", relativeTo: base)!)) }

  @objc func reloadApp(_ sender: Any?) {
    if web.url?.host == "127.0.0.1" { web.reload() } else { startServerIfNeeded() }
  }

  // ------------------------------------------------------------ web view delegates
  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
    appLog("page " + String(describing: message.body))
  }

  /// Appends a line to server.log so page problems inside the app window can be read later.
  func appLog(_ line: String) {
    let url = projectDir.appendingPathComponent("server.log")
    guard let h = try? FileHandle(forWritingTo: url) else { return }
    h.seekToEndOfFile()
    h.write(("[app " + ISO8601DateFormatter().string(from: Date()) + "] " + line + "\n").data(using: .utf8)!)
    try? h.close()
  }

  func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
               type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
    decisionHandler(origin.host == "127.0.0.1" ? .grant : .deny)
  }

  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    if let u = action.request.url, ["http", "https"].contains(u.scheme ?? ""), u.host != "127.0.0.1" {
      NSWorkspace.shared.open(u)  // outside links go to the default browser
      decisionHandler(.cancel)
      return
    }
    decisionHandler(.allow)
  }

  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction,
               windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let u = action.request.url { NSWorkspace.shared.open(u) }
    return nil
  }

  func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
               completionHandler: @escaping () -> Void) {
    let a = NSAlert()
    a.messageText = message
    a.beginSheetModal(for: window) { _ in completionHandler() }
  }

  func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
               completionHandler: @escaping (Bool) -> Void) {
    let a = NSAlert()
    a.messageText = message
    a.addButton(withTitle: "好")
    a.addButton(withTitle: "取消")
    a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn) }
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

  // ------------------------------------------------------------ menu
  @objc func zoomIn(_ sender: Any?) { web.pageZoom = min(2, web.pageZoom + 0.1) }
  @objc func zoomOut(_ sender: Any?) { web.pageZoom = max(0.6, web.pageZoom - 0.1) }
  @objc func zoomReset(_ sender: Any?) { web.pageZoom = 1 }
  @objc func revealProject(_ sender: Any?) { NSWorkspace.shared.activateFileViewerSelecting([projectDir.appendingPathComponent("data")]) }

  func buildMenu() {
    let bar = NSMenu()
    func menu(_ title: String, _ items: [NSMenuItem]) -> NSMenu {
      let m = NSMenu(title: title)
      items.forEach(m.addItem)
      let holder = NSMenuItem()
      holder.submenu = m
      bar.addItem(holder)
      return m
    }
    func item(_ t: String, _ sel: Selector?, _ key: String = "", _ mods: NSEvent.ModifierFlags = .command, target: AnyObject? = nil) -> NSMenuItem {
      let i = NSMenuItem(title: t, action: sel, keyEquivalent: key)
      i.keyEquivalentModifierMask = mods
      i.target = target
      return i
    }
    _ = menu("每天开口", [
      item("关于每天开口", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
      .separator(),
      item("隐藏每天开口", #selector(NSApplication.hide(_:)), "h"),
      item("隐藏其他", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
      .separator(),
      item("退出每天开口", #selector(NSApplication.terminate(_:)), "q"),
    ])
    // without an Edit menu, ⌘C / ⌘V / ⌘A do nothing inside the web view
    _ = menu("编辑", [
      item("撤销", Selector(("undo:")), "z"),
      item("重做", Selector(("redo:")), "z", [.command, .shift]),
      .separator(),
      item("剪切", #selector(NSText.cut(_:)), "x"),
      item("拷贝", #selector(NSText.copy(_:)), "c"),
      item("粘贴", #selector(NSText.paste(_:)), "v"),
      item("全选", #selector(NSText.selectAll(_:)), "a"),
    ])
    _ = menu("显示", [
      item("重新载入", #selector(reloadApp(_:)), "r", target: self),
      .separator(),
      item("放大", #selector(zoomIn(_:)), "=", target: self),
      item("缩小", #selector(zoomOut(_:)), "-", target: self),
      item("实际大小", #selector(zoomReset(_:)), "0", target: self),
      .separator(),
      item("在访达中显示数据文件夹", #selector(revealProject(_:)), "", target: self),
      .separator(),
      item("进入全屏幕", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
    ])
    let win = menu("窗口", [
      item("最小化", #selector(NSWindow.performMiniaturize(_:)), "m"),
      item("缩放", #selector(NSWindow.performZoom(_:))),
    ])
    NSApp.mainMenu = bar
    NSApp.windowsMenu = win
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
