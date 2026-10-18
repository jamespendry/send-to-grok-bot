#!/usr/bin/env bash
# Assemble the sendtogrokbot.com static site. The published root is dist/site.
set -euo pipefail
cd "$(dirname "$0")/.."
out="dist/site"
rm -rf "$out"
mkdir -p "$out/assets/icons" "$out/assets/promo"
cp -R docs/. "$out/"
bash scripts/package.sh >/dev/null
cp "$(ls -t dist/send-to-grok-bot-*.zip | head -1)" "$out/send-to-grok-bot.zip"
cp extension/connect.js "$out/connect.js"
cp extension/prompts.js "$out/prompts.js"
cp extension/icons/icon32.png extension/icons/icon48.png extension/icons/icon128.png "$out/assets/icons/"
cp store/promo/tile-440x280.png store/promo/marquee-1400x560.png "$out/assets/promo/"

# One SVG sprite from the brand marks the extension draws in its menu, plus its send arrow.
node -e '
require("./extension/logos.js");
const L = globalThis.STGB_LOGOS;
const send = "M2.5 3.5l19 8.5-19 8.5 2.6-8.5L2.5 3.5zm4.2 9.25l-1.5 4.9L17.3 12 5.2 6.35l1.5 4.9H13v1.5H6.7z";
const out = ["<svg xmlns=\"http://www.w3.org/2000/svg\">"];
for (const [id, d] of Object.entries({...L, send})) {
  out.push("<symbol id=\"" + id + "\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"" + d + "\"/></symbol>");
}
out.push("</svg>");
require("fs").writeFileSync(process.argv[1], out.join("\n") + "\n");
' "$out/assets/logos.svg"

for f in send-to-grok-bot.zip connect.html connect.js prompts.js _redirects _headers setup/index.html assets/site.css assets/site.js assets/logos.svg logo.svg logo.png; do
  test -f "$out/$f" || { echo "missing $out/$f"; exit 1; }
done
grep -q 'id="paste"' "$out/connect.html" && grep -q 'id="msg"' "$out/connect.html" \
  || { echo "connect.html lost an id that extension/site-connect.js needs"; exit 1; }
cp "shortcuts/Send to Grok Bot.shortcut" "$out/send-to-grok-bot.shortcut"
test -f "$out/connect.html"
test -f "$out/send-to-grok-bot.shortcut"
test -f "$out/connect.js"
test -f "$out/prompts.js"
test -f "$out/_redirects"
test -f "$out/setup/index.html"
echo "wrote $out"
