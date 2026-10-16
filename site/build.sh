#!/bin/sh
# Copies the files the website shares with the extension into site/public.
# Run it after you change extension/connect.js, relay.js, prompts.js, logos.js,
# the icons, docs/img, or store/promo. Commit what it writes.
# `sh site/build.sh --check` fails if site/public is out of date.
set -eu
cd "$(dirname "$0")/.."
OUT=site/public/assets
CHECK=${1:-}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/img" "$TMP/icons" "$TMP/promo"
cp extension/connect.js extension/prompts.js "$TMP/"
cp extension/icons/icon32.png extension/icons/icon48.png extension/icons/icon128.png "$TMP/icons/"
cp docs/img/*.png "$TMP/img/"
cp store/promo/tile-440x280.png store/promo/marquee-1400x560.png "$TMP/promo/"

# One SVG sprite from the same brand marks the extension draws in its menu.
node -e '
require("./extension/logos.js");
const L = globalThis.STGB_LOGOS;
const out = ["<svg xmlns=\"http://www.w3.org/2000/svg\">"];
for (const id of Object.keys(L)) {
  out.push("<symbol id=\"" + id + "\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"" + L[id] + "\"/></symbol>");
}
out.push("<symbol id=\"send\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M2.5 3.5l19 8.5-19 8.5 2.6-8.5L2.5 3.5zm4.2 9.25l-1.5 4.9L17.3 12 5.2 6.35l1.5 4.9H13v1.5H6.7z\"/></symbol>");
out.push("</svg>");
require("fs").writeFileSync(process.argv[1], out.join("\n") + "\n");
' "$TMP/logos.svg"

if [ "$CHECK" = "--check" ]; then
  for f in $(cd "$TMP" && find . -type f); do
    cmp -s "$TMP/$f" "$OUT/$f" || { echo "Out of date: $OUT/${f#./}. Run sh site/build.sh"; exit 1; }
  done
  echo "site/public is up to date."
  exit 0
fi

mkdir -p "$OUT"
cp -R "$TMP/." "$OUT/"
echo "Copied shared files into $OUT."
