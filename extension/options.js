const $ = id => document.getElementById(id);
const FIELDS = {webhookUrl: 'u', senderKey: 'k', chatgptTriggerId: 'ti', chatgptToken: 'tt', codexEnvironment: 'ce', codexBranch: 'cb'};
const CONTENT_HOSTS = new Set(['x.com', 'twitter.com']);
const LEGACY_PROMPTS = ['claudePrompt', 'chatgptPrompt', 'codexPrompt'];
let claudeUrl = '';
let claudeToken = '';

function hostOf(pattern) {
  try { return new URL(String(pattern).replace(/\*$/, 'x')).host; }
  catch { return ''; }
}

function brandSet(enabled, webhookUrl) {
  const keys = Array.isArray(enabled) ? enabled : (webhookUrl ? ['grokbot'] : []);
  const set = new Set();
  for (const k of keys) {
    if (k === 'claude' || k === 'claude_routine' || k === 'claude_link') set.add('claude');
    else if (k === 'chatgpt' || k === 'chatgpt_link' || k === 'chatgpt_workspace_agent') set.add('chatgpt');
    else set.add(k);
  }
  return set;
}

function getStore(area, keys) {
  return new Promise(resolve => chrome.storage[area].get(keys, resolve));
}
function setStore(area, obj) {
  return new Promise(resolve => chrome.storage[area].set(obj, resolve));
}
function removeStore(area, keys) {
  return new Promise(resolve => chrome.storage[area].remove(keys, resolve));
}

function cleanKey(v) {
  return String(v || '').replace(/^authorization\s*:\s*/i, '').replace(/^bearer\s+/i, '').trim();
}

function show() {
  document.querySelectorAll('.fields').forEach(el => {
    if (!el.dataset.for) return;
    const box = document.querySelector(`input[data-dest="${el.dataset.for}"]`);
    el.hidden = !(box && box.checked);
  });
  const relayFields = document.getElementById('relayFields');
  const relayOn = document.getElementById('relayOn');
  if (relayFields && relayOn) relayFields.hidden = !relayOn.checked;
}

function claudeLine() {
  const el = $('claudeHint');
  const bits = [];
  if (claudeUrl) bits.push('Routine address saved');
  if (claudeToken) bits.push('secret saved');
  el.className = '';
  if (!bits.length) el.textContent = '';
  else if (claudeUrl && claudeToken) el.textContent = 'Routine address and secret saved.';
  else el.textContent = bits.join('. ') + '. Paste the other one too.';
}

function applyClaudePaste(raw, quiet) {
  const text = String(raw || '').trim();
  if (!text) {
    claudeLine();
    return;
  }
  const parsed = globalThis.STGB_CONNECT.parseSetupPaste(text);
  const el = $('claudeHint');
  if (!parsed.ok) {
    if (!quiet) {
      el.textContent = parsed.error;
      el.className = 'err';
    }
    return;
  }
  if (parsed.kind === 'code' && parsed.destination === 'claude') {
    if (parsed.fields.claudeFireUrl) claudeUrl = parsed.fields.claudeFireUrl;
    if (parsed.fields.claudeToken) claudeToken = parsed.fields.claudeToken;
    if (parsed.mode === 'link') { claudeUrl = ''; claudeToken = ''; }
  } else if (parsed.kind === 'claude') {
    if (parsed.url) claudeUrl = parsed.url;
    if (parsed.token) claudeToken = parsed.token;
  } else {
    el.textContent = 'Paste the Claude routine address and secret in this box.';
    el.className = 'err';
    return;
  }
  el.className = 'ok';
  claudeLine();
  if (claudeUrl && claudeToken) el.className = 'ok';
}

// Saved styles: [{id, name, text}], kept in chrome.storage.local with the rest.
let savedStyles = [];

function savedById(presetId) {
  return globalThis.STGB_PROMPTS.findSaved({savedStyles}, presetId);
}

function promptState() {
  const preset = $('preset').value || 'general';
  const written = $('promptText').value.trim();
  const saved = savedById(preset);
  if (saved) {
    // Editing a saved style and clicking Save updates that style.
    if (written) saved.text = written;
    return {promptPreset: preset, promptText: '', savedStyles: savedStyles.slice()};
  }
  if (preset === 'custom') return {promptPreset: 'custom', promptText: written};
  const builtin = globalThis.STGB_PROMPTS.text(preset).trim();
  if (!written || written === builtin) return {promptPreset: preset, promptText: ''};
  return {promptPreset: 'custom', promptText: written};
}

function formState() {
  const o = {enabled: [...document.querySelectorAll('input[data-dest]:checked')].map(el => el.dataset.dest)};
  for (const [key, id] of Object.entries(FIELDS)) o[key] = $(id).value.trim();
  o.senderKey = cleanKey(o.senderKey);
  o.claudeFireUrl = claudeUrl;
  o.claudeToken = claudeToken;
  Object.assign(o, promptState());
  o.savedStyles = savedStyles.slice();
  const relayBox = document.getElementById('relayOn');
  const relayCode = document.getElementById('relayCode');
  o.useRelay = !!(relayBox && relayBox.checked);
  o.relayCode = relayCode ? relayCode.value.trim() : '';
  return o;
}

function connectMessage(text, ok) {
  const el = $('cm');
  el.textContent = text || '';
  el.className = text ? (ok ? 'ok' : 'err') : '';
}

function fillPresetSelect() {
  const sel = $('preset');
  sel.replaceChildren();
  for (const id of globalThis.STGB_PROMPTS.ORDER) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = globalThis.STGB_PROMPTS.label(id);
    sel.appendChild(opt);
  }
  if (savedStyles.length) {
    const group = document.createElement('optgroup');
    group.label = 'My styles';
    for (const x of savedStyles) {
      const opt = document.createElement('option');
      opt.value = 'saved:' + x.id;
      opt.textContent = x.name;
      group.appendChild(opt);
    }
    sel.appendChild(group);
  }
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = 'Custom';
  sel.appendChild(custom);
}

function styleButtons() {
  const saved = !!savedById($('preset').value);
  $('delStyle').hidden = !saved;
  $('saveStyle').hidden = false;
  $('saveStyle').disabled = savedStyles.length >= globalThis.STGB_PROMPTS.MAX_STYLES;
}

function showPrompt(preset, text) {
  const saved = savedById(preset);
  if (saved) {
    $('preset').value = preset;
    $('promptText').value = saved.text;
    styleButtons();
    return;
  }
  const id = preset === 'custom' || globalThis.STGB_PROMPTS.ORDER.indexOf(preset) !== -1 ? preset : 'general';
  $('preset').value = id;
  $('promptText').value = text || (id === 'custom' ? '' : globalThis.STGB_PROMPTS.text(id));
  styleButtons();
}

function fill(local) {
  const enabled = brandSet(local.enabled, local.webhookUrl);
  document.querySelectorAll('input[data-dest]').forEach(el => { el.checked = enabled.has(el.dataset.dest); });
  for (const [key, id] of Object.entries(FIELDS)) $(id).value = local[key] || '';
  claudeUrl = local.claudeFireUrl || '';
  claudeToken = local.claudeToken || '';
  $('claudePaste').value = '';
  claudeLine();
  savedStyles = globalThis.STGB_PROMPTS.savedList(local).map(x => ({id: x.id, name: String(x.name).trim(), text: String(x.text).trim()}));
  fillPresetSelect();
  if (local.promptPreset || local.promptText) showPrompt(local.promptPreset || 'general', local.promptText || '');
  else if (local.claudePrompt || local.chatgptPrompt || local.codexPrompt) showPrompt('custom', local.claudePrompt || local.chatgptPrompt || local.codexPrompt || '');
  else showPrompt('general', '');
  const relayOn = document.getElementById('relayOn');
  const relayCode = document.getElementById('relayCode');
  if (relayOn) relayOn.checked = !!local.useRelay;
  if (relayCode) relayCode.value = local.relayCode || '';
  show();
}

function persist(o, done, denyText) {
  if (!settingsLoaded) { done('Settings did not load. Reload this page before you click Save.'); return; }
  const problem = settingsProblem(o);
  if (problem) { done(problem); return; }
  const origins = stgbNeededOrigins(o);
  const write = () => {
    chrome.storage.local.set(o, () => {
      chrome.storage.local.remove(LEGACY_PROMPTS, () => {
        dropUnusedOrigins(stgbNeededOrigins(o));
        done(chrome.runtime.lastError || null);
      });
    });
  };
  // permissions.request has to run in the gesture that started this, before any await.
  if (!origins.length) { write(); return; }
  try {
    chrome.permissions.request({origins}, granted => {
      const err = chrome.runtime.lastError && chrome.runtime.lastError.message;
      if (!granted || err) { done(denyText || 'Click Save and choose Allow to send there'); return; }
      write();
    });
  } catch (err) {
    done((err && err.message) || denyText || 'Click Save and choose Allow to send there');
  }
}

function clearPasteBox() {
  const wipe = () => { $('cc').value = ''; };
  wipe();
  setTimeout(wipe, 0);
}

function usePaste(raw, fromClick) {
  const parsed = globalThis.STGB_CONNECT.parseSetupPaste(raw);
  if (!parsed.ok) {
    if (!$('cc').value.trim()) $('cc').value = String(raw).replace(/^#/, '');
    connectMessage(parsed.error, false);
    return;
  }
  const plan = globalThis.STGB_CONNECT.planConnect(formState(), parsed);
  if (!plan.ok) { connectMessage(plan.error, false); return; }
  fill(plan.settings);
  const text = globalThis.STGB_CONNECT.finishMessage(parsed, plan);
  const o = formState();
  if (!fromClick) {
    clearPasteBox();
    chrome.storage.local.set(o, () => {
      chrome.storage.local.remove(LEGACY_PROMPTS, () => {
        const needsAllow = stgbNeededOrigins(o).length > 0;
        connectMessage(needsAllow ? text + ' Click Save and choose Allow.' : text, true);
      });
    });
    return;
  }
  persist(o, err => {
    if (!err) clearPasteBox();
    connectMessage(err ? (typeof err === 'string' ? err : 'Could not save. Click Save.') : text, !err);
  }, 'Choose Allow to finish.');
}

function configured(local) {
  const s = local || {};
  if (String(s.webhookUrl || '').trim()) return true;
  if (String(s.senderKey || '').trim()) return true;
  if (String(s.claudeFireUrl || '').trim() || String(s.claudeToken || '').trim()) return true;
  if (String(s.chatgptTriggerId || '').trim() || String(s.chatgptToken || '').trim()) return true;
  if (String(s.relayCode || '').trim()) return true;
  if (String(s.codexEnvironment || '').trim()) return true;
  return false;
}

function settingsProblem(o) {
  if (o.useRelay) {
    if (!self.STGB_RELAY) return 'Relay code could not be checked';
    const parsed = self.STGB_RELAY.decodeConnectCode(o.relayCode || '');
    if (!parsed.ok) return parsed.error;
  }
  if (o.enabled.includes('grokbot') && o.webhookUrl && !stgbWebhookPattern(o.webhookUrl)) return 'Webhook URL must be a valid https link';
  return '';
}

function say(text, bad) {
  $('m').textContent = text;
  $('m').classList.toggle('bad', !!bad);
  clearTimeout(say.t);
  if (!bad && text) say.t = setTimeout(() => { $('m').textContent = ''; $('m').classList.remove('bad'); }, 2000);
}

function copyText(text, button) {
  const original = button.textContent;
  navigator.clipboard.writeText(text).then(() => {
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = original; }, 1500);
  }, () => say('Select the text and copy it', true));
}

function dropUnusedOrigins(keep) {
  const needed = new Set(keep.map(hostOf));
  chrome.permissions.getAll(all => {
    const extra = (all.origins || []).filter(origin => {
      const host = hostOf(origin);
      return host && !needed.has(host) && !CONTENT_HOSTS.has(host);
    });
    if (!extra.length) return;
    chrome.permissions.remove({origins: extra}, () => { void chrome.runtime.lastError; });
  });
}

let settingsLoaded = false;

function showNotice(text) {
  const el = $('notice');
  if (!el) return;
  el.textContent = text || '';
  el.hidden = !text;
}

async function load() {
  let local = await getStore('local', null) || {};
  let sync = {};
  try { sync = await getStore('sync', null) || {}; }
  catch (_) { sync = {}; }
  const migrated = stgbMigrateSettings(local, sync);
  if (migrated.patch && Object.keys(migrated.patch).length) await setStore('local', migrated.patch);
  if (migrated.removeSync && migrated.removeSync.length) await removeStore('sync', migrated.removeSync);
  local = migrated.settings;
  fill(local);
  settingsLoaded = true;
  const more = document.getElementById('more');
  if (more) more.open = configured(local);
  let notice = '';
  try {
    const session = await new Promise(resolve => chrome.storage.session.get('setupNotice', resolve));
    notice = session && session.setupNotice || '';
    if (notice) chrome.storage.session.remove('setupNotice');
  } catch (_) {}
  const grokOn = brandSet(local.enabled, local.webhookUrl).has('grokbot');
  const grokEmpty = !(local.webhookUrl || '').trim() && !(local.useRelay && (local.relayCode || '').trim());
  if (!notice && grokOn && grokEmpty) notice = 'Grok Bot is checked, but the webhook is empty. Paste the webhook URL and the Authorization header in the box above, one at a time or together. A webhook saved by version 1.1.0 is kept when it is still in this browser.';
  showNotice(notice);
}

fillPresetSelect();
document.querySelectorAll('input[data-dest]').forEach(el => el.addEventListener('change', show));
const relayOn = document.getElementById('relayOn');
if (relayOn) relayOn.addEventListener('change', show);
$('cc').addEventListener('input', () => connectMessage('', true));
$('preset').addEventListener('change', () => {
  const id = $('preset').value;
  const saved = savedById(id);
  if (saved) $('promptText').value = saved.text;
  else if (id !== 'custom') $('promptText').value = globalThis.STGB_PROMPTS.text(id);
  styleButtons();
});
$('promptText').addEventListener('input', () => {
  const id = $('preset').value;
  if (savedById(id)) return;
  if (id !== 'custom' && $('promptText').value.trim() !== globalThis.STGB_PROMPTS.text(id).trim()) $('preset').value = 'custom';
  styleButtons();
});
$('saveStyle').addEventListener('click', () => {
  if (!$('promptText').value.trim()) { say('Write the instructions first', true); return; }
  $('styleForm').hidden = false;
  $('styleName').value = '';
  $('styleName').focus();
});
$('styleCancel').addEventListener('click', () => { $('styleForm').hidden = true; });
function addStyle() {
  const name = $('styleName').value.trim().slice(0, 40);
  const text = $('promptText').value.trim();
  if (!name) { say('Give the style a name', true); return; }
  if (!text) { say('Write the instructions first', true); return; }
  if (savedStyles.some(x => x.name.toLowerCase() === name.toLowerCase())) { say('You already have a style with that name', true); return; }
  if (savedStyles.length >= globalThis.STGB_PROMPTS.MAX_STYLES) { say('You can save up to ' + globalThis.STGB_PROMPTS.MAX_STYLES + ' styles', true); return; }
  const style = {id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, text};
  savedStyles.push(style);
  fillPresetSelect();
  $('preset').value = 'saved:' + style.id;
  $('styleForm').hidden = true;
  styleButtons();
  persist(formState(), err => say(err ? (typeof err === 'string' ? err : 'Could not save') : 'Saved "' + name + '". It is now in the Send menu on X.', !!err));
}
$('styleOk').addEventListener('click', addStyle);
$('styleName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addStyle(); } });
$('delStyle').addEventListener('click', () => {
  const saved = savedById($('preset').value);
  if (!saved) return;
  savedStyles = savedStyles.filter(x => x !== saved);
  fillPresetSelect();
  showPrompt('general', '');
  persist(formState(), err => say(err ? (typeof err === 'string' ? err : 'Could not save') : 'Deleted "' + saved.name + '"', !!err));
});
$('claudePaste').addEventListener('input', () => {
  const value = $('claudePaste').value;
  const quiet = !/\n/.test(value) && !/sk-ant-/.test(value) && !/trig_/.test(value) && !/stgb1\./i.test(value);
  applyClaudePaste(value, quiet);
});
$('claudePaste').addEventListener('blur', () => applyClaudePaste($('claudePaste').value, false));
$('copyPrompt').onclick = () => copyText(globalThis.STGB_PROMPTS.CLAUDE_TASK, $('copyPrompt'));
const ready = load();
$('cc').addEventListener('paste', event => {
  if (!settingsLoaded) {
    connectMessage('Reload this page, then paste again.', false);
    return;
  }
  const data = event.clipboardData;
  const raw = data ? data.getData('text') : '';
  if (!raw) return;
  usePaste(raw, true);
});
$('s').onclick = () => {
  if (!settingsLoaded) { say('Reload this page, then click Save.', true); return; }
  persist(formState(), err => {
    if (err) say(typeof err === 'string' ? err : 'Could not save', true);
    else {
      $('claudePaste').value = '';
      claudeLine();
      say('Saved', false);
    }
  });
};

ready.then(() => {
  const hash = location.hash || '';
  if (!/(?:^|[/#])stgb1\./i.test(hash) && !/^#connect=/i.test(hash)) return;
  try { history.replaceState(null, '', location.pathname + location.search); }
  catch (_) {}
  usePaste(hash, false);
});
