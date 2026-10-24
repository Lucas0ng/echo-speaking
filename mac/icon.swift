// 生成 1024×1024 的 App 图标 PNG：swift mac/icon.swift out.png
// 陶土橙圆角方块 + 米白声源圆点 + 两道回声弧（近的实、远的淡）。网页 favicon 是同一张图：static/icon.svg。
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
rgb(0xD9, 0x77, 0x57).setFill()
shape.fill()
NSGraphicsContext.restoreGraphicsState()
NSGradient(starting: rgb(0xE0, 0x86, 0x66), ending: rgb(0xCC, 0x68, 0x48))!.draw(in: shape, angle: -90)

// source dot + two echo arcs; drawn on the 96-unit grid of static/icon.svg (y flipped), scaled to the body
let u = body.width / 88
let P = { (x: CGFloat, y: CGFloat) in NSPoint(x: body.minX + (x - 4) * u, y: body.maxY - (y - 4) * u) }
let cream = rgb(0xFA, 0xF9, 0xF5)
cream.setFill()
let c = P(36, 48), r = 9 * u
NSBezierPath(ovalIn: NSRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)).fill()
// same arcs as the SVG: centre x, radius, half-angle (endpoints at x 52 / 64), opening to the right
for (cx, radius, half, alpha) in [(CGFloat(39.35), CGFloat(22), CGFloat(54.9), CGFloat(1)), (CGFloat(42.1), CGFloat(34), CGFloat(49.9), CGFloat(0.45))] {
  let arc = NSBezierPath()
  arc.appendArc(withCenter: P(cx, 48), radius: radius * u, startAngle: -half, endAngle: half)
  arc.lineWidth = 6 * u
  arc.lineCapStyle = .round
  cream.withAlphaComponent(alpha).setStroke()
  arc.stroke()
}

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
