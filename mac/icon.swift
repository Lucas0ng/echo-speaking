// 生成 1024×1024 的 App 图标 PNG：swift mac/icon.swift out.png
// 朱红圆角方块（与界面强调色一致）+ 白色「开」字 + 一颗录音指示灯。
import AppKit

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon.png"
let S: CGFloat = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(S), pixelsHigh: Int(S), bitsPerSample: 8, samplesPerPixel: 4,
                           hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let rgb = { (r: Int, g: Int, b: Int) in NSColor(srgbRed: CGFloat(r) / 255, green: CGFloat(g) / 255, blue: CGFloat(b) / 255, alpha: 1) }

// macOS icon grid: 824 pt body centred in the 1024 canvas
let body = NSRect(x: 100, y: 100, width: 824, height: 824)
let shape = NSBezierPath(roundedRect: body, xRadius: 186, yRadius: 186)
let shadow = NSShadow()
shadow.shadowColor = NSColor.black.withAlphaComponent(0.28)
shadow.shadowBlurRadius = 28
shadow.shadowOffset = NSSize(width: 0, height: -12)
NSGraphicsContext.saveGraphicsState()
shadow.set()
rgb(0xDF, 0x4A, 0x2F).setFill()
shape.fill()
NSGraphicsContext.restoreGraphicsState()
NSGradient(starting: rgb(0xEE, 0x62, 0x44), ending: rgb(0xCC, 0x3B, 0x22))!.draw(in: shape, angle: -90)

// glyph
let font = NSFont(name: "PingFangSC-Semibold", size: 470) ?? NSFont.systemFont(ofSize: 470, weight: .semibold)
let glyph = NSAttributedString(string: "开", attributes: [.font: font, .foregroundColor: NSColor.white])
let g = glyph.size()
glyph.draw(at: NSPoint(x: (S - g.width) / 2, y: (S - g.height) / 2 - 18))

// on-air light
let dot = NSRect(x: 724, y: 724, width: 92, height: 92)
NSColor.white.withAlphaComponent(0.22).setFill()
NSBezierPath(ovalIn: dot.insetBy(dx: -22, dy: -22)).fill()
NSColor.white.setFill()
NSBezierPath(ovalIn: dot).fill()

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
