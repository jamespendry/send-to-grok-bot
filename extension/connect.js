// Connection codes pack one destination into a single string: stgb1.<base64url JSON>.
// The options page unpacks it into the same chrome.storage.local fields as the form.
// The code is not stored, and nothing in this file sends it anywhere.
//
// JSON keys: destination, mode, url, key, token, triggerId, environment, branch, prompt.
// destination: grokbot | claude | chatgpt | codex
// mode: webhook (Grok Bot) | routine (Claude) | agent (ChatGPT workspace) | link (open a tab)
(function (root) {
  'use strict';

  const PREFIX = 'stgb1.';
  const MAX_CODE = 40000;
  const MAX_PROMPT = 8000;
  const LABELS = {grokbot: 'Send to Grok Bot', claude: 'Send to Claude', chatgpt: 'Send to ChatGPT', codex: 'Send to Codex'};

  function encodeB64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function decodeB64Url(text) {
    if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
    const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
    let bin;
    try { bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad); }
    catch (_) { return null; }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try { return new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
    catch (_) { return null; }
  }

  function extractCode(raw) {
    let s = String(raw == null ? '' : raw).replace(/[\u200b-\u200d\ufeff]/g, '').trim();
    if ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'"))) s = s.slice(1, -1).trim();
    const flat = s.replace(/\s+/g, '');
    const hash = flat.match(/(?:^|[#?&])connect=([^&]+)/i);
    if (hash) {
      try { s = decodeURIComponent(hash[1]); }
      catch (_) { s = hash[1]; }
      s = s.replace(/\s+/g, '');
    } else {
      s = flat;
    }
    const i = s.toLowerCase().indexOf('stgb1.');
    if (i === -1) return '';
    return s.slice(i);
  }

  function normalizeDest(v) {
    const k = String(v || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
    if (k === 'grok' || k === 'grokbot' || k === 'grok-bot') return 'grokbot';
    if (k === 'claude') return 'claude';
    if (k === 'chatgpt' || k === 'chat-gpt') return 'chatgpt';
    if (k === 'codex') return 'codex';
    return '';
  }

  function pick(obj, keys) {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null && obj[k] !== '') {
        if (typeof obj[k] !== 'string') return {error: 'A connection code field was not text.'};
        return {value: obj[k].trim()};
      }
    }
    return {value: ''};
  }

  function placeholder(v) {
    // Documentation samples use an ellipsis. Real keys are base64url and do not.
    return /\.{3}/.test(v);
  }

  function webhookProblem(v) {
    let url;
    try { url = new URL(v); }
    catch (_) { return 'The webhook address needs to be a full URL starting with https://.'; }
    if (url.username || url.password) return 'Put the key in the key field. Leave it out of the webhook address.';
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'https:') return '';
    if (url.protocol === 'http:' && local) return '';
    return 'The webhook address needs to start with https://.';
  }

  function claudeProblem(v) {
    if (/^trig_[A-Za-z0-9_-]+$/.test(v)) return '';
    let url;
    try { url = new URL(/^[a-z]+:/i.test(v) ? v : 'https://' + v.replace(/^\/\//, '')); }
    catch (_) { return 'The Claude routine address should be the routines page link, a trig_ id, or the fire URL.'; }
    const id = (url.pathname.match(/\/(trig_[A-Za-z0-9_-]+)/) || [])[1];
    const host = url.hostname.replace(/^www\./, '');
    const fire = host === 'api.anthropic.com' && /^\/v1\/claude_code\/routines\/trig_[A-Za-z0-9_-]+\/fire\/?$/.test(url.pathname);
    const page = host === 'claude.ai' && /^\/code\/routines\/trig_[A-Za-z0-9_-]+\/?$/.test(url.pathname);
    if (id && (fire || page)) return '';
    return 'The Claude routine address should be the routines page link, a trig_ id, or the fire URL.';
  }

  function tooLong(label, v, max) {
    if (v.length > max) return label + ' is too long.';
    return '';
  }

  function interpret(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return {ok: false, error: 'That code did not contain a destination.'};
    }
    const destination = normalizeDest(obj.destination || obj.dest || obj.d);
    if (!destination) {
      return {ok: false, error: 'That code names a destination this extension does not have. Use grokbot, claude, chatgpt, or codex.'};
    }
    const url = pick(obj, ['url', 'webhookUrl', 'routineUrl', 'fireUrl']);
    const key = pick(obj, ['key', 'senderKey']);
    const token = pick(obj, ['token']);
    const trigger = pick(obj, ['triggerId', 'trigger_id']);
    const environment = pick(obj, ['environment', 'environmentId']);
    const branch = pick(obj, ['branch']);
    const prompt = pick(obj, ['prompt']);
    const modeRaw = pick(obj, ['mode']);
    if (modeRaw.value && !{link: 1, routine: 1, api: 1, agent: 1, workspace: 1, workspace_agent: 1, webhook: 1}[modeRaw.value]) {
      return {ok: false, error: 'That mode is not one this extension uses. Use link, routine, agent, or webhook.'};
    }
    for (const part of [url, key, token, trigger, environment, branch, prompt, modeRaw]) {
      if (part.error) return {ok: false, error: part.error};
    }
    const promptErr = tooLong('The prompt', prompt.value, MAX_PROMPT);
    if (promptErr) return {ok: false, error: promptErr};
    for (const secret of [key.value, token.value]) {
      if (secret && placeholder(secret)) return {ok: false, error: 'That key looks like an example. Use the real one from the routine page.'};
    }

    const fields = {};
    const filled = [];
    const canonical = {destination: destination};
    let mode = '';

    function addPrompt(storageKey) {
      if (!prompt.value) return;
      fields[storageKey] = prompt.value;
      canonical.prompt = prompt.value;
      filled.push('prompt');
    }

    if (destination === 'grokbot') {
      mode = 'webhook';
      if (modeRaw.value && modeRaw.value !== 'webhook') return {ok: false, error: 'A Grok Bot code uses a webhook. There is no link mode.'};
      if (prompt.value) return {ok: false, error: 'Put the Grok Bot prompt on the routine. The connection code only carries the webhook address and key.'};
      if (!url.value) return {ok: false, error: 'A Grok Bot code needs the webhook address.'};
      const problem = webhookProblem(url.value) || tooLong('The webhook address', url.value, 2000);
      if (problem) return {ok: false, error: problem};
      const keyErr = key.value ? tooLong('The key', key.value, 2000) : '';
      if (keyErr) return {ok: false, error: keyErr};
      fields.webhookUrl = url.value;
      canonical.url = url.value;
      filled.push('url');
      if (key.value) {
        fields.senderKey = key.value;
        canonical.key = key.value;
        filled.push('key');
      }
      canonical.mode = mode;
    } else if (destination === 'claude') {
      if (modeRaw.value && modeRaw.value !== 'link' && modeRaw.value !== 'routine' && modeRaw.value !== 'api') {
        return {ok: false, error: 'A Claude code uses mode link or routine.'};
      }
      const routineToken = token.value || key.value;
      const named = modeRaw.value === 'routine' || modeRaw.value === 'api';
      const wantsRoutine = modeRaw.value === 'link' ? false : named || !!(url.value || routineToken);
      if (wantsRoutine) {
        mode = 'routine';
        if (!url.value || !routineToken) return {ok: false, error: 'A Claude routine code needs both the routine address and the token.'};
        const problem = claudeProblem(url.value) || tooLong('The routine address', url.value, 2000) || tooLong('The token', routineToken, 2000);
        if (problem) return {ok: false, error: problem};
        fields.claudeFireUrl = url.value;
        fields.claudeToken = routineToken;
        canonical.url = url.value;
        canonical.token = routineToken;
        filled.push('url', 'token');
      } else {
        mode = 'link';
        fields.claudeFireUrl = '';
        fields.claudeToken = '';
      }
      canonical.mode = mode;
      addPrompt('claudePrompt');
    } else if (destination === 'chatgpt') {
      if (modeRaw.value && modeRaw.value !== 'link' && modeRaw.value !== 'agent' && modeRaw.value !== 'workspace' && modeRaw.value !== 'workspace_agent') {
        return {ok: false, error: 'A ChatGPT code uses mode link or agent.'};
      }
      const agentToken = token.value || key.value;
      const named = modeRaw.value === 'agent' || modeRaw.value === 'workspace' || modeRaw.value === 'workspace_agent';
      const wantsAgent = modeRaw.value === 'link' ? false : named || !!(trigger.value || agentToken);
      if (wantsAgent) {
        mode = 'agent';
        if (!trigger.value || !agentToken) return {ok: false, error: 'A ChatGPT agent code needs both the trigger id and the token.'};
        if (!/^agtch_[A-Za-z0-9_-]+$/.test(trigger.value)) return {ok: false, error: 'The ChatGPT trigger id should start with agtch_.'};
        const tokenErr = tooLong('The token', agentToken, 2000);
        if (tokenErr) return {ok: false, error: tokenErr};
        fields.chatgptTriggerId = trigger.value;
        fields.chatgptToken = agentToken;
        canonical.triggerId = trigger.value;
        canonical.token = agentToken;
        filled.push('triggerId', 'token');
      } else {
        mode = 'link';
        fields.chatgptTriggerId = '';
        fields.chatgptToken = '';
      }
      canonical.mode = mode;
      addPrompt('chatgptPrompt');
    } else {
      if (modeRaw.value && modeRaw.value !== 'link') return {ok: false, error: 'A Codex code uses mode link.'};
      mode = 'link';
      canonical.mode = mode;
      if (environment.value) {
        if (tooLong('The environment id', environment.value, 200) || /[\s]/.test(environment.value)) return {ok: false, error: 'The Codex environment id should be the hex id from the environment URL.'};
        fields.codexEnvironment = environment.value;
        canonical.environment = environment.value;
        filled.push('environment');
      }
      if (branch.value) {
        if (tooLong('The branch', branch.value, 200) || /[\s]/.test(branch.value)) return {ok: false, error: 'The branch name is not valid.'};
        fields.codexBranch = branch.value;
        canonical.branch = branch.value;
        filled.push('branch');
      }
      addPrompt('codexPrompt');
    }

    const name = LABELS[destination];
    let message = 'Saved ' + name + ' on this computer.';
    if (mode === 'webhook') message += ' Clicking a post sends it to your webhook.';
    else if (mode === 'routine') message += ' Clicking a post starts the Claude routine.';
    else if (mode === 'agent') message += ' Clicking a post starts the ChatGPT agent.';
    else if (destination === 'codex') message += ' Clicking a post opens Codex with the post filled in.';
    else message += ' Clicking a post opens ' + (destination === 'claude' ? 'Claude' : 'ChatGPT') + ' with the post filled in.';

    const words = {url: 'an address', key: 'a key', token: 'a token', triggerId: 'a trigger id', environment: 'an environment id', branch: 'a branch', prompt: 'a prompt'};
    const bits = filled.map(function (k) { return words[k]; });
    return {ok: true, destination: destination, mode: mode, fields: fields, filled: filled, canonical: canonical, message: message, summary: plainSummary(name, bits), label: name};
  }

  function plainSummary(name, bits) {
    if (!bits.length) return name + '. No secret in this code.';
    if (bits.length === 1) return name + ', with ' + bits[0] + '.';
    return name + ', with ' + bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1] + '.';
  }

  function encodeConnectionCode(input) {
    const result = interpret(input);
    if (!result.ok) {
      const err = new Error(result.error);
      err.stgb = true;
      throw err;
    }
    return PREFIX + encodeB64Url(JSON.stringify(result.canonical));
  }

  function decodeConnectionCode(raw) {
    const text = String(raw == null ? '' : raw);
    if (!text.trim()) return {ok: false, error: 'Paste a connection code first. It starts with stgb1.'};
    const extracted = extractCode(text);
    if (!extracted) return {ok: false, error: "That doesn't look like a connection code. It should start with stgb1."};
    if (extracted.length > MAX_CODE || extracted.length <= PREFIX.length) return {ok: false, error: 'That code is damaged. Ask for a new one.'};
    const json = decodeB64Url(extracted.slice(PREFIX.length));
    if (json == null) return {ok: false, error: 'That code is damaged. Ask for a new one.'};
    let obj;
    try { obj = JSON.parse(json); }
    catch (_) { return {ok: false, error: 'That code is damaged. Ask for a new one.'}; }
    return interpret(obj);
  }

  function asCode(input) {
    try {
      const decoded = decodeConnectionCode(encodeConnectionCode(input));
      if (!decoded.ok) return decoded;
      return Object.assign({kind: 'code', plain: decoded.summary}, decoded);
    } catch (e) {
      return {ok: false, error: (e && e.message) || 'Could not read that.'};
    }
  }

  function stripSecret(v) {
    return String(v || '')
      .replace(/^authorization\s*:\s*/i, '')
      .replace(/^bearer\s+/i, '')
      .replace(/^["']|["']$/g, '')
      .replace(/[),.;]+$/g, '')
      .trim();
  }

  function cleanUrl(v) {
    return String(v || '').replace(/[),.;>\]]+$/g, '');
  }

  function claudeShapeOk(url) {
    if (!url) return '';
    const probe = asCode({destination: 'claude', mode: 'routine', url: url, token: 'sk-ant-oat01-probevalue'});
    return probe.ok ? '' : probe.error;
  }

  function parseSetupPaste(raw) {
    const original = String(raw == null ? '' : raw).replace(/[\u200b-\u200d\ufeff]/g, '').trim();
    if (!original) return {ok: false, error: 'Paste a connect link, or the address and the secret, first.'};

    if (/stgb1\./i.test(original)) {
      const decoded = decodeConnectionCode(original);
      if (decoded.ok) return Object.assign({kind: 'code', plain: decoded.summary}, decoded);
      if (/stgb1\.[A-Za-z0-9_-]{8,}/i.test(original.replace(/\s+/g, ''))) return decoded;
    }

    if (/stgbr1\./i.test(original)) {
      const flat = original.replace(/\s+/g, '');
      const at = flat.toLowerCase().indexOf('stgbr1.');
      const code = flat.slice(at);
      if (code.length <= 'stgbr1.'.length) return {ok: false, error: 'That relay link is damaged. Copy it again.'};
      return {ok: true, kind: 'relay', code: code, plain: 'Relay. This points at a relay you already set up.'};
    }

    const urls = (original.match(/https?:\/\/[^\s<>"']+/gi) || []).map(cleanUrl);
    const claudeUrls = urls.filter(function (u) {
      return /api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9_-]+\/fire/i.test(u)
        || /claude\.ai\/code\/routines\/trig_[A-Za-z0-9_-]+/i.test(u);
    });
    const trig = original.match(/\b(trig_[A-Za-z0-9_-]+)\b/);
    const sk = original.match(/\b(sk-ant-[A-Za-z0-9_-]{8,})\b/);
    const auth = original.match(/authorization\s*:\s*(\S+(?:\s+\S+)?)/i);
    const bearer = original.match(/(?:^|[\s])bearer\s+(\S+)/i);
    let headerKey = auth ? stripSecret(auth[1]) : (bearer ? stripSecret(bearer[1]) : '');
    if (/^bearer$/i.test(headerKey)) headerKey = '';

    const skipHost = {
      'x.com': 1, 'twitter.com': 1, 't.co': 1, 'claude.ai': 1, 'chatgpt.com': 1,
      'api.anthropic.com': 1, 'api.chatgpt.com': 1, 'sendtogrokbot.com': 1,
      'fxtwitter.com': 1, 'api.fxtwitter.com': 1, 'vxtwitter.com': 1, 'api.vxtwitter.com': 1,
      'fixupx.com': 1, 'pbs.twimg.com': 1, 'video.twimg.com': 1
    };
    const webhooks = urls.filter(function (u) {
      if (claudeUrls.indexOf(u) !== -1) return false;
      let host = '';
      try { host = new URL(u).hostname.replace(/^www\./, ''); }
      catch (_) { return false; }
      return !skipHost[host];
    });

    const used = {};
    urls.forEach(function (u) { used[u] = 1; });
    if (sk) used[sk[1]] = 1;
    if (headerKey) used[headerKey] = 1;
    if (trig) used[trig[1]] = 1;
    const leftovers = [];
    original.split(/\r?\n/).forEach(function (line) {
      const cleaned = stripSecret(line.trim());
      if (!cleaned || cleaned.length < 8 || /\s/.test(cleaned)) return;
      if (/^https?:\/\//i.test(cleaned) || /^trig_/i.test(cleaned)) return;
      if (/^(post|get|webhook|header|url|method)$/i.test(cleaned)) return;
      if (used[cleaned]) return;
      leftovers.push(cleaned);
    });

    const claudeUrl = claudeUrls[0] || (trig ? trig[1] : '');
    let claudeToken = sk ? sk[1] : '';
    const looksClaude = !!(claudeUrl || claudeToken);
    if (looksClaude && webhooks.length) {
      return {ok: false, error: 'That paste has a Claude routine and another address. Paste one at a time.'};
    }
    if (looksClaude) {
      if (!claudeToken && headerKey && !/^https?:/i.test(headerKey)) claudeToken = headerKey;
      if (!claudeToken && leftovers.length === 1) claudeToken = leftovers[0];
      if (claudeUrls.length > 1) return {ok: false, error: 'That paste has more than one Claude address. Paste one.'};
      if (claudeUrl && claudeToken) return asCode({destination: 'claude', mode: 'routine', url: claudeUrl, token: claudeToken});
      if (claudeUrl) {
        const problem = claudeShapeOk(claudeUrl);
        if (problem) return {ok: false, error: problem};
        return {ok: true, kind: 'claude', url: claudeUrl, token: '', plain: 'Claude. The routine address is here. Add the secret from the same screen.'};
      }
      if (claudeToken.length > 2000) return {ok: false, error: 'The secret is too long.'};
      if (placeholder(claudeToken)) return {ok: false, error: 'That secret looks like an example. Use the real one from the routine page.'};
      return {ok: true, kind: 'claude', url: '', token: claudeToken, plain: 'Claude. The secret is here. Add the routine address from the same screen.'};
    }

    if (webhooks.length > 1) return {ok: false, error: 'That paste has more than one address. Paste one.'};
    if (webhooks.length === 1) {
      let key = headerKey;
      if (!key && leftovers.length === 1) key = leftovers[0];
      if (key && placeholder(key)) return {ok: false, error: 'That key looks like an example. Use the real one from the routine page.'};
      const input = {destination: 'grokbot', mode: 'webhook', url: webhooks[0]};
      if (key) input.key = key;
      return asCode(input);
    }

    if (headerKey || leftovers.length) return {ok: false, error: 'Paste the address as well as the secret.'};
    return {ok: false, error: 'Paste a connect link, a Grok Bot address and header, or a Claude address and secret.'};
  }

  function planConnect(current, parsed) {
    if (!parsed || !parsed.ok) return {ok: false, error: (parsed && parsed.error) || 'Paste a connect link first.'};
    const src = current && typeof current === 'object' ? current : {};
    const next = {};
    for (const key of Object.keys(src)) next[key] = src[key];
    const enabled = Array.isArray(next.enabled) ? next.enabled.slice() : [];
    function enable(dest) {
      if (enabled.indexOf(dest) === -1) enabled.push(dest);
    }
    const removeKeys = [];
    let message = '';

    if (parsed.kind === 'relay') {
      if (typeof STGB_RELAY !== 'undefined' && STGB_RELAY.decodeConnectCode) {
        const checked = STGB_RELAY.decodeConnectCode(parsed.code);
        if (!checked.ok) return {ok: false, error: checked.error};
      }
      next.useRelay = true;
      next.relayCode = parsed.code;
      if (!enabled.length) enabled.push('grokbot', 'claude');
      message = 'Saved the relay on this computer.';
    } else if (parsed.kind === 'code') {
      if (parsed.destination === 'grokbot' && !(parsed.fields && String(parsed.fields.senderKey || '').trim())) {
        return {ok: false, error: 'Paste the webhook URL and the Authorization header together.'};
      }
      enable(parsed.destination);
      const fields = parsed.fields || {};
      for (const key of Object.keys(fields)) next[key] = fields[key];
      const prompt = fields.claudePrompt || fields.chatgptPrompt || fields.codexPrompt || '';
      if (prompt) {
        next.promptPreset = 'custom';
        next.promptText = prompt;
        delete next.claudePrompt;
        delete next.chatgptPrompt;
        delete next.codexPrompt;
        removeKeys.push('claudePrompt', 'chatgptPrompt', 'codexPrompt');
      }
      message = parsed.message;
    } else if (parsed.kind === 'claude') {
      enable('claude');
      if (parsed.url) next.claudeFireUrl = parsed.url;
      if (parsed.token) next.claudeToken = parsed.token;
      const haveUrl = !!next.claudeFireUrl;
      const haveToken = !!next.claudeToken;
      message = 'Saved Send to Claude on this computer.';
      if (haveUrl && haveToken) message += ' Clicking a post starts the Claude routine.';
      else if (!haveUrl) message += ' Paste the routine address as well.';
      else message += ' Paste the secret as well.';
    } else {
      return {ok: false, error: 'Paste a connect link, a Grok Bot address and header, or a Claude address and secret.'};
    }

    next.enabled = enabled;
    let origins = [];
    if (typeof stgbNeededOrigins === 'function') {
      try { origins = stgbNeededOrigins(next); }
      catch (_) { origins = []; }
    }
    return {ok: true, settings: next, removeKeys: removeKeys, origins: origins, message: message, plain: parsed.plain || message};
  }

  function finishMessage(parsed, plan) {
    if (parsed && parsed.destination === 'grokbot' && parsed.fields && String(parsed.fields.senderKey || '').trim()) {
      return 'Now open x.com and click the arrow.';
    }
    return (plan && plan.message) || '';
  }

  const api = {
    PREFIX: PREFIX,
    encodeConnectionCode: encodeConnectionCode,
    decodeConnectionCode: decodeConnectionCode,
    parseSetupPaste: parseSetupPaste,
    planConnect: planConnect,
    finishMessage: finishMessage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.STGB_CONNECT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
