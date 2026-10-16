// Shared by every page. Sets the Add to Chrome link in one place and wires copy buttons.
(function () {
  'use strict';
  // Placeholder until the Chrome Web Store listing is live. Change this one line.
  var CHROME_STORE_URL = 'https://github.com/jamespendry/send-to-grok-bot#readme';

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
})();
