#!/bin/zsh
# 打包「回声」Mac App 和安装用的 dmg：在项目根目录运行 mac/build.sh
# 产物：dist/回声.app、dist/回声.dmg。App 只是外壳，运行时用的是这个项目文件夹里的代码、.venv 和 data/。
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
OUT=$ROOT/dist
APP=$OUT/回声.app
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "› 编译"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O -target arm64-apple-macos12.0 -o "$APP/Contents/MacOS/Kaikou" mac/Kaikou.swift
sed -e "s|__PROJECT_DIR__|$ROOT|" -e "s|__BUILD__|$(date +%Y%m%d%H%M)|" mac/Info.plist > "$APP/Contents/Info.plist"
plutil -lint "$APP/Contents/Info.plist" >/dev/null

echo "› 图标"
ICONSET=$WORK/AppIcon.iconset
mkdir -p "$ICONSET"
swift mac/icon.swift "$WORK/icon.png"
for s in 16 32 128 256 512; do
  sips -z $s $s "$WORK/icon.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$WORK/icon.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

echo "› 签名（本机 ad-hoc）"
codesign --force --sign - "$APP"

echo "› dmg"
mkdir -p "$WORK/dmg"
cp -R "$APP" "$WORK/dmg/"
ln -s /Applications "$WORK/dmg/Applications"
rm -f "$OUT/回声.dmg"
hdiutil create -quiet -volname "回声" -srcfolder "$WORK/dmg" -format UDZO "$OUT/回声.dmg"

echo "完成：$OUT/回声.dmg"
