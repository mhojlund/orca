#!/bin/bash
# Generate app icons from Icon Composer .icon project
# Produces: resources/build/icon.icns (macOS), resources/build/icon.png (fallback), resources/icon.png (tray)
# Usage: generate.sh [flavor] — a flavor (e.g. rs) compiles icon-<flavor>.icon into icon-<flavor>.* instead.
set -euo pipefail

FLAVOR="${1:-}"
ICON_NAME="icon${FLAVOR:+-$FLAVOR}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
ICON_SOURCE="$SCRIPT_DIR/$ICON_NAME.icon"
BUILD_DIR="$PROJECT_DIR/resources/build"
RESOURCES_DIR="$PROJECT_DIR/resources"
TMP_DIR=$(mktemp -d)

trap 'rm -rf "$TMP_DIR"' EXIT

MAGICK_BIN=$(command -v magick || true)
if [ -z "$MAGICK_BIN" ]; then
  echo "Error: ImageMagick is required to trim the small macOS icon slots." >&2
  echo "Install with: brew install imagemagick" >&2
  exit 1
fi

echo "Compiling icon from $ICON_SOURCE..."

# Generate .icns using actool (requires Xcode)
xcrun actool \
  --compile "$TMP_DIR" \
  --platform macosx \
  --minimum-deployment-target 10.12 \
  --app-icon "$ICON_NAME" \
  --output-partial-info-plist "$TMP_DIR/partial.plist" \
  "$ICON_SOURCE" >/dev/null

if [ ! -f "$TMP_DIR/$ICON_NAME.icns" ]; then
  echo "Error: actool failed to produce icon.icns" >&2
  exit 1
fi

cp "$TMP_DIR/$ICON_NAME.icns" "$BUILD_DIR/$ICON_NAME.icns"

# macOS list views use the small .icns slots directly. Icon Composer keeps the
# safe-area inset there, so trim only those slots while preserving larger icons.
ICONSET_DIR="$TMP_DIR/icon.iconset"
iconutil -c iconset "$BUILD_DIR/$ICON_NAME.icns" -o "$ICONSET_DIR"
for icon_file in \
  icon_16x16.png \
  icon_16x16@2x.png \
  icon_32x32.png \
  icon_32x32@2x.png; do
  case "$icon_file" in
    icon_16x16.png) icon_size=16 ;;
    icon_16x16@2x.png | icon_32x32.png) icon_size=32 ;;
    icon_32x32@2x.png) icon_size=64 ;;
  esac
  "$MAGICK_BIN" "$ICONSET_DIR/$icon_file" \
    -trim +repage \
    -resize "${icon_size}x${icon_size}" \
    -background none \
    -gravity center \
    -extent "${icon_size}x${icon_size}" \
    "$ICONSET_DIR/$icon_file"
done
iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/$ICON_NAME.icns"
echo "  -> resources/build/$ICON_NAME.icns"

# Extract PNG fallbacks from the unmodified compiled icon; small-slot trimming is
# only for the macOS .icns list representations.
sips -s format png --resampleWidth 1024 "$TMP_DIR/$ICON_NAME.icns" --out "$BUILD_DIR/$ICON_NAME.png" >/dev/null 2>&1
echo "  -> resources/build/$ICON_NAME.png (1024x1024)"

sips -s format png --resampleWidth 256 "$TMP_DIR/$ICON_NAME.icns" --out "$RESOURCES_DIR/$ICON_NAME.png" >/dev/null 2>&1
echo "  -> resources/$ICON_NAME.png (256x256)"

# #5357: Windows scales the safe-area-inset 1024px render into undersized taskbar/Open-with icons.
# Use the repo’s pngjs trim script to remove the inset, re-square with 2% margin and emit multi-size ICO,
# keeping committed output reproducible without ImageMagick.
node "$PROJECT_DIR/config/scripts/desktop-distribution/windows/trim-windows-icon-source.mjs" \
  "$BUILD_DIR/$ICON_NAME.png" "$BUILD_DIR/$ICON_NAME.ico"
echo "  -> resources/build/$ICON_NAME.ico (trimmed, filled multi-size ICO)"

echo "Done! Icons generated in resources/build/ and resources/"
