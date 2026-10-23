#!/usr/bin/env bash
# Render the store promo images from the HTML in this folder (macOS).
# Window is taller than the target because headless Chrome loses some viewport height; PIL crops to size.
# Override the browser with CHROME=/path/to/chrome.
set -euo pipefail
cd "$(dirname "$0")"

CFT="/private/tmp/claude-501/-Users-jamespendry/05e9f9c5-c41e-46fa-8ea4-8d6077a9b617/scratchpad/cft/chrome/mac_arm-155.0.8059.84/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
chrome="${CHROME:-}"
if [[ -z "$chrome" ]]; then
  if [[ -x "$CFT" ]]; then chrome="$CFT"
  else chrome="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)"
  fi
fi
[[ -n "$chrome" ]] || { echo "no Chrome found; set CHROME" >&2; exit 1; }

work="$(mktemp -d "${TMPDIR:-/tmp}/promo.XXXXXX")"
trap 'rm -rf "$work"' EXIT

render() {
  local html="$1" width="$2" height="$3" out="$4"
  local shot="$work/${out%.png}.png" profile="$work/profile-${out%.png}"
  mkdir -p "$profile"
  "$chrome" \
    --headless=new \
    --no-sandbox \
    --disable-gpu \
    --hide-scrollbars \
    --user-data-dir="$profile" \
    --force-device-scale-factor=1 \
    --window-size="${width},$((height + 120))" \
    --default-background-color=FFFFFFFF \
    --virtual-time-budget=2000 \
    --screenshot="$shot" \
    "file://$(pwd)/$html" >/dev/null 2>&1 &
  local pid=$! n=0
  while kill -0 "$pid" 2>/dev/null && (( n < 60 )); do sleep 0.5; n=$((n+1)); done
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  [[ -s "$shot" ]] || { echo "screenshot failed for $html" >&2; exit 1; }
  python3 - "$shot" "$out" "$width" "$height" <<'PY'
import sys
from PIL import Image
src, dest, width, height = sys.argv[1:]
width, height = int(width), int(height)
im = Image.open(src).convert("RGB")
if im.size != (width, height):
    canvas = Image.new("RGB", (width, height), (255, 255, 255))
    canvas.paste(im.crop((0, 0, min(im.width, width), min(im.height, height))), (0, 0))
    im = canvas
im.save(dest, "PNG")
chk = Image.open(dest)
assert chk.size == (width, height) and chk.mode == "RGB", (chk.size, chk.mode)
print(f"{dest} {chk.size[0]}x{chk.size[1]} {chk.mode}")
PY
}

render tile.html 440 280 tile-440x280.png
render marquee.html 1400 560 marquee-1400x560.png
