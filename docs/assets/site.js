// Shared by every page. Sets the Add to Chrome link in one place and wires copy buttons.
(function () {
  'use strict';
  // Until the Chrome Web Store listing is live, this opens /install.
  // When the listing is live, put its URL here.
  var CHROME_STORE_URL = '/install';

  document.querySelectorAll('[data-chrome-store]').forEach(function (a) {
    a.href = CHROME_STORE_URL;
  });

  // <button data-copy="#id"> copies the text of #id. data-copy-text copies a literal.
  document.addEventListener('click', function (event) {
    var btn = event.target.closest && event.target.closest('[data-copy], [data-copy-text]');
    if (!btn) return;
    var text = btn.getAttribute('data-copy-text');
    if (text == null) {
      var src = document.querySelector(btn.getAttribute('data-copy'));
      text = src ? src.textContent.trim() : '';
    }
    var label = btn.dataset.label || btn.textContent;
    btn.dataset.label = label;
    function show(t) {
      btn.textContent = t;
      clearTimeout(btn._t);
      btn._t = setTimeout(function () { btn.textContent = label; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { show('Copied'); }, function () { show('Select and copy'); });
    } else {
      show('Select and copy');
    }
  });
  // The relay page's QR code opens /mobile#code=stgbr1.... Show that code ready to copy.
  // The #fragment never reaches a server, and it is removed from the address bar here.
  (function () {
    var box = document.getElementById('phone-ready');
    if (!box || location.hash.indexOf('#code=') !== 0) return;
    var code = '';
    try { code = decodeURIComponent(location.hash.slice(6)).trim(); } catch (e) {}
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    if (!/^stgbr1\.[A-Za-z0-9_-]{20,8000}$/.test(code)) return;
    document.getElementById('phone-code').textContent = code;
    box.hidden = false;
  })();
  // Links to a folded section, such as /setup/claude#claude-does-it, open it.
  function openTarget() {
    var id = location.hash.slice(1);
    var el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView({block: 'start'}); }
  }
  window.addEventListener('hashchange', openTarget);
  openTarget();
})();
