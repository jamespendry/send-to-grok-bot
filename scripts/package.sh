#!/usr/bin/env bash
# Build a Chrome Web Store zip. manifest.json is at the root of the archive.
set -euo pipefail
cd "$(dirname "$0")/.."
root="$(pwd)"
ext="$root/extension"
version="$(node -p "require('./extension/manifest.json').version")"
name="send-to-grok-bot-${version}.zip"
out="$root/dist/$name"

files=(
  manifest.json
  background.js
  content.js
  content.css
  hosts.js
  connect.js
  logos.js
  options.html
  options.js
  prompts.js
  relay.js
  site-connect.js
  destinations/grokbot.js
  destinations/claude.js
  destinations/chatgpt.js
  destinations/codex.js
  icons/icon16.png
  icons/icon32.png
  icons/icon48.png
  icons/icon128.png
)

for f in "${files[@]}"; do
  if [[ ! -f "$ext/$f" ]]; then
    echo "missing extension/$f" >&2
    exit 1
  fi
done

while IFS= read -r -d '' js; do
  node --check "$js"
done < <(find "$ext" -name '*.js' -print0)

node --input-type=module -e '
import {createRequire} from "module";
const require = createRequire(process.cwd() + "/");
const m = require("./extension/manifest.json");
const {stgbNeededOrigins, stgbWebhookPattern} = require("./extension/hosts.js");
const fail = (msg) => { console.error(msg); process.exit(1); };
if (m.manifest_version !== 3) fail("manifest_version");
if (m.version !== process.argv[1]) fail("version");
if (m.description.length > 132) fail("description length");
if (!Array.isArray(m.permissions) || m.permissions.length !== 1 || m.permissions[0] !== "storage") fail("permissions");
if (m.host_permissions) fail("required host_permissions");
if (!m.optional_host_permissions || m.optional_host_permissions.join() !== "https://*/*") fail("optional host");
for (const size of ["16", "32", "48", "128"]) {
  if (!m.icons[size] || !m.action.default_icon[size]) fail("icon " + size);
}
const empty = stgbNeededOrigins({enabled: ["claude", "chatgpt", "codex"]});
if (empty.length) fail("tab destinations should not need a host");
const hook = stgbNeededOrigins({enabled: ["grokbot"], webhookUrl: "https://hooks.example.com/a"});
if (hook.join() !== "https://hooks.example.com/*") fail("webhook origin");
if (stgbWebhookPattern("http://hooks.example.com/a")) fail("http webhook");
const apis = stgbNeededOrigins({
  enabled: ["claude", "chatgpt"],
  claudeToken: "tok",
  chatgptTriggerId: "agtch_x"
});
if (apis.join() !== "https://api.anthropic.com/*,https://api.chatgpt.com/*") fail("api origins");
' "$version"

python3 - "$ext" <<'PY'
import struct, sys
from pathlib import Path
ext = Path(sys.argv[1])
def size(path):
    data = path.read_bytes()
    if data[1:4] != b"PNG":
        raise SystemExit(f"{path} is not a png")
    return struct.unpack(">II", data[16:24])
for name, expected in (("icon16.png", (16, 16)), ("icon32.png", (32, 32)), ("icon48.png", (48, 48)), ("icon128.png", (128, 128))):
    got = size(ext / "icons" / name)
    if got != expected:
        raise SystemExit(f"{name} is {got}, expected {expected}")
PY

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
for f in "${files[@]}"; do
  mkdir -p "$stage/$(dirname "$f")"
  cp "$ext/$f" "$stage/$f"
done
mkdir -p "$root/dist"
rm -f "$out"
(
  cd "$stage"
  zip -9 -X -r "$out" . -x '*.DS_Store'
)
echo "wrote $out"
unzip -l "$out"
