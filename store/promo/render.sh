#!/usr/bin/env bash
# Render the store promo tiles from the HTML in this folder.
set -euo pipefail
cd "$(dirname "$0")"
chrome="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium)"

render() {
  local html="$1" width="$2" height="$3" out="$4"
  local shot profile
  shot="$(mktemp --suffix=.png)"
  profile="$(mktemp -d)"
  # Chrome writes the screenshot and then waits on DBus in this environment.
  timeout 25 "$chrome" \
    --headless=new \
    --no-sandbox \
    --disable-dev-shm-usage \
    --disable-gpu \
    --hide-scrollbars \
    --user-data-dir="$profile" \
    --force-device-scale-factor=1 \
    --window-size="${width},${height}" \
    --default-background-color=FF0F1419 \
    --virtual-time-budget=2000 \
    --screenshot="$shot" \
    "file://$(pwd)/$html" || true
  rm -rf "$profile"
  if [[ ! -s "$shot" ]]; then
    echo "screenshot failed for $html" >&2
    exit 1
  fi
  python3 - "$shot" "$out" "$width" "$height" <<'PY'
import sys
from PIL import Image
src, dest, width, height = sys.argv[1:]
width, height = int(width), int(height)
im = Image.open(src).convert("RGB")
if im.size != (width, height):
    im = im.crop((0, 0, min(im.width, width), min(im.height, height)))
    if im.size != (width, height):
        canvas = Image.new("RGB", (width, height), (15, 20, 25))
        canvas.paste(im, (0, 0))
        im = canvas
im.save(dest, "PNG")
print(f"{dest} {im.size[0]}x{im.size[1]} {im.mode}")
PY
  rm -f "$shot"
}

render tile.html 440 280 tile-440x280.png
render marquee.html 1400 560 marquee-1400x560.png
