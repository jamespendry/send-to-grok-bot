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
  options.css
  options.js
  prompts.js
  relay.js
  site-connect.js
  grant.html
  grant.js
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

python3 - "$out" "$root" <<'PY'
import json, re, struct, sys, zipfile
from pathlib import Path
out, root = Path(sys.argv[1]), Path(sys.argv[2])
fail = lambda msg: (_ for _ in ()).throw(SystemExit(msg))
# CWS rejects packages over a few dozen megabytes in practice; this one should stay tiny.
if out.stat().st_size > 10 * 1024 * 1024:
    raise SystemExit(f"zip is {out.stat().st_size} bytes")
z = zipfile.ZipFile(out)
names = []
uncompressed = 0
for info in z.infolist():
    if info.is_dir() or info.filename.endswith("/"):
        continue
    if info.filename.startswith("/") or ".." in info.filename.split("/"):
        raise SystemExit("unsafe zip path " + info.filename)
    names.append(info.filename)
    uncompressed += info.file_size
if uncompressed > 5 * 1024 * 1024:
    raise SystemExit(f"uncompressed {uncompressed}")
manifest = json.loads(z.read("manifest.json"))
expected = [
    "manifest.json", "background.js", "content.js", "content.css", "hosts.js", "connect.js",
    "logos.js", "options.html", "options.js", "prompts.js", "relay.js", "site-connect.js",
    "grant.html", "grant.js", "destinations/grokbot.js", "destinations/claude.js",
    "destinations/chatgpt.js", "destinations/codex.js",
    "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png",
]
if sorted(names) != sorted(expected):
    raise SystemExit("zip members\n" + "\n".join(sorted(names)))
if manifest.get("manifest_version") != 3:
    raise SystemExit("manifest_version")
if manifest.get("update_url"):
    raise SystemExit("update_url")
worker = (manifest.get("background") or {}).get("service_worker")
if worker != "background.js" or worker not in names:
    raise SystemExit("service worker")
for block in manifest.get("content_scripts") or []:
    for js in block.get("js") or []:
        if js.startswith("http") or js not in names:
            raise SystemExit("content script " + js)
for size, path in (manifest.get("icons") or {}).items():
    if path not in names:
        raise SystemExit("missing " + path)
raw_manifest = z.read("manifest.json").decode()
if re.search(r"https?://(?!\*/\*)", raw_manifest) and "web_accessible_resources" not in raw_manifest:
    pass
remote = re.compile(r"\beval\s*\(|\bnew\s+Function\s*\(|importScripts\s*\(\s*['\"]https?:|<script[^>]+src\s*=\s*['\"]https?:", re.I)
for name in names:
    if not name.endswith((".js", ".html")):
        continue
    text = z.read(name).decode("utf-8", "replace")
    if remote.search(text):
        raise SystemExit("remote code in " + name)
listing = (root / "store" / "listing.md").read_text()
short = "Adds a native-looking button to X posts that sends the post to Grok Bot, Claude, ChatGPT, or Codex."
if manifest.get("description") != short or short not in listing:
    raise SystemExit("listing description")
if "1.2.7" not in (root / "store" / "SUBMIT.md").read_text():
    raise SystemExit("SUBMIT version")
for policy in (root / "store" / "privacy-policy.md", root / "docs" / "privacy.html"):
    text = policy.read_text()
    for needle in ("chrome.storage.local", "more than one", "does not use analytics", "sendtogrokbot.com/connect"):
        if needle not in text and not (needle == "does not use analytics" and "does not use analytics" in text.replace("\n", " ")):
            if needle not in text:
                raise SystemExit(f"{policy.name} missing {needle}")
if "Privacy practices tab" in (root / "docs" / "privacy.html").read_text():
    raise SystemExit("dashboard section published")
if "When you paste a webhook on sendtogrokbot.com/connect" not in (root / "store" / "privacy-policy.md").read_text():
    raise SystemExit("host justification")
print(f"cws lint ok: {len(names)} files, zip {out.stat().st_size} bytes, uncompressed {uncompressed}")
PY
