#!/usr/bin/env bash
# Assemble the sendtogrokbot.com static site. The published root is dist/site.
set -euo pipefail
cd "$(dirname "$0")/.."
out="dist/site"
rm -rf "$out"
mkdir -p "$out"
cp -R docs/. "$out/"
cp extension/connect.js "$out/connect.js"
cp extension/prompts.js "$out/prompts.js"
cp "shortcuts/Send to Grok Bot.shortcut" "$out/send-to-grok-bot.shortcut"
test -f "$out/connect.html"
test -f "$out/send-to-grok-bot.shortcut"
test -f "$out/connect.js"
test -f "$out/prompts.js"
test -f "$out/_redirects"
test -f "$out/setup/index.html"
echo "wrote $out"
