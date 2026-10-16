function setupPage() {
  var $ = function (id) { return document.getElementById(id); };
  var STORAGE = "stgb-relay-code";

  function say(id, text, bad) {
    var el = $(id);
    el.textContent = text || "";
    el.className = bad ? "bad" : (id === "status" ? "muted" : "");
  }

  function base() {
    var path = String(location.pathname || "/").replace(/\/$/, "");
    if (path === "/api" || path.slice(-4) === "/api") return location.origin + path;
    return location.origin;
  }

  function remember(connect) {
    try { localStorage.setItem(STORAGE, connect); } catch (e) {}
    $("code").value = connect;
    var parsed = STGB_RELAY_CODE.decodeConnectCode(connect);
    $("key").value = parsed.ok ? parsed.key : "";
  }

  function fresh() {
    return STGB_RELAY_CODE.encodeConnectCode(base(), STGB_RELAY_CODE.newRelayKey());
  }

  function clearForm() {
    $("webhook").value = "";
    $("webhookKey").value = "";
    $("fire").value = "";
    $("token").value = "";
    $("webhookHint").textContent = "";
    $("tokenHint").textContent = "";
    $("clearKey").checked = false;
    $("clearToken").checked = false;
    $("clearKeyLabel").hidden = true;
    $("clearTokenLabel").hidden = true;
    say("saveMsg", "");
  }

  function line(item) {
    var when = item.sentAt || "";
    var date = new Date(when);
    if (!isNaN(date.getTime())) when = date.toLocaleString();
    var names = { grokbot: "Grok Bot", claude: "Claude", chatgpt: "ChatGPT", codex: "Codex" };
    var dest = names[item.destination] || item.destination || "Send";
    var result = item.ok ? "Sent" : ("Failed" + (item.error ? ": " + item.error : ""));
    var who = item.author ? " @" + item.author : "";
    var url = item.url ? " — " + item.url : "";
    return when + " — " + dest + who + " — " + result + url;
  }

  function renderHistory(items) {
    var box = $("history");
    box.replaceChildren();
    if (!items || !items.length) {
      var empty = document.createElement("p");
      empty.textContent = "No sends yet.";
      box.appendChild(empty);
      return;
    }
    for (var i = 0; i < items.length; i++) {
      var p = document.createElement("p");
      p.textContent = line(items[i]);
      box.appendChild(p);
    }
  }

  function loadConfig(connect) {
    var parsed = STGB_RELAY_CODE.decodeConnectCode(connect);
    if (!parsed.ok) {
      say("status", parsed.error, true);
      return Promise.resolve();
    }
    return fetch(parsed.relay + "/v1/config", {
      headers: { "Authorization": "Bearer " + parsed.key }
    }).then(function (res) {
      if (res.status === 401) {
        clearForm();
        renderHistory([]);
        say("status", "Nothing is saved for this code yet. Saving will create it. If you expected destinations you already saved, the code is wrong.");
        return null;
      }
      return res.json().then(function (data) {
        if (!res.ok || !data || !data.destinations) {
          say("status", (data && data.error) || "Could not load what is saved.", true);
          return null;
        }
        var grok = data.destinations.grokbot || {};
        var claude = data.destinations.claude || {};
        $("webhook").value = grok.webhookUrl || "";
        $("fire").value = claude.fireUrl || "";
        $("webhookKey").value = "";
        $("token").value = "";
        $("clearKey").checked = false;
        $("clearToken").checked = false;
        $("webhookHint").textContent = grok.hasKey ? "A webhook key is saved. Leave the box blank to keep it." : "";
        $("tokenHint").textContent = claude.hasToken ? "A routine token is saved. Leave the box blank to keep it." : "";
        $("clearKeyLabel").hidden = !grok.hasKey;
        $("clearTokenLabel").hidden = !claude.hasToken;
        say("status", "These are the destinations saved for this code.");
        renderHistory(data.history || []);
        return data;
      });
    }).catch(function () {
      say("status", "Could not reach the relay.", true);
    });
  }

  function save() {
    var parsed = STGB_RELAY_CODE.decodeConnectCode($("code").value);
    if (!parsed.ok) {
      say("saveMsg", parsed.error, true);
      return Promise.resolve();
    }
    var grok = { webhookUrl: $("webhook").value.trim() };
    var claude = { fireUrl: $("fire").value.trim() };
    if ($("clearKey").checked) grok.senderKey = "";
    else if ($("webhookKey").value) grok.senderKey = $("webhookKey").value;
    if ($("clearToken").checked) claude.token = "";
    else if ($("token").value) claude.token = $("token").value;
    say("saveMsg", "Saving...");
    return fetch(parsed.relay + "/v1/config", {
      method: "PUT",
      headers: { "Authorization": "Bearer " + parsed.key, "Content-Type": "application/json" },
      body: JSON.stringify({ grokbot: grok, claude: claude })
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          say("saveMsg", (data && data.error) || "Save failed.", true);
          return null;
        }
        say("saveMsg", "Saved.");
        return loadConfig($("code").value);
      });
    }).catch(function () {
      say("saveMsg", "Could not reach the relay.", true);
    });
  }

  $("copy").addEventListener("click", function () {
    var value = $("code").value;
    function fallback() {
      $("code").focus();
      $("code").select();
      say("copyMsg", "Select the code and copy it.", true);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () { say("copyMsg", "Copied."); }, fallback);
    } else fallback();
  });

  $("form").addEventListener("submit", function (event) {
    event.preventDefault();
    globalThis.__stgbLast = save();
  });

  $("load").addEventListener("click", function () {
    var parsed = STGB_RELAY_CODE.decodeConnectCode($("existing").value);
    if (!parsed.ok) {
      say("loadMsg", parsed.error, true);
      return;
    }
    var connect = STGB_RELAY_CODE.encodeConnectCode(parsed.relay, parsed.key);
    remember(connect);
    $("existing").value = "";
    say("loadMsg", "Loaded.");
    globalThis.__stgbLast = loadConfig(connect);
  });

  $("newCode").addEventListener("click", function () {
    remember(fresh());
    clearForm();
    renderHistory([]);
    say("status", "This is a new code. Save destinations to turn it on. A code you already saved still works if you kept a copy.");
  });

  var existing = "";
  try { existing = localStorage.getItem(STORAGE) || ""; } catch (e) {}
  if (String(location.hash || "").indexOf("#code=") === 0) {
    var fromHash = "";
    try { fromHash = decodeURIComponent(location.hash.slice(6)); } catch (e2) { fromHash = ""; }
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    if (STGB_RELAY_CODE.decodeConnectCode(fromHash).ok) existing = fromHash;
  }
  if (!existing || !STGB_RELAY_CODE.decodeConnectCode(existing).ok) existing = fresh();
  remember(existing);
  return loadConfig(existing);
}
