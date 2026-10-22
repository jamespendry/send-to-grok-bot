// Shared by every page. Sets the Add to Chrome link in one place and wires copy buttons.
(function () {
  'use strict';
  // Until the Chrome Web Store listing is live, this opens /install.
  // When the listing is live, put its URL here.
  var CHROME_STORE_URL = '/install';

  document.querySelectorAll('[data-chrome-store]').forEach(function (a) {
    a.href = CHROME_STORE_URL;
  });

  // On an iPhone, the iPhone button comes first; Chrome keeps its Recommended label.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) document.documentElement.classList.add('ios');
  // Copies inside the tap itself. iPhone Safari can refuse navigator.clipboard and leave the
  // old clipboard in place, so the selected-text copy runs first, while the tap still counts.
  function copyNow(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    // iPhone selects nothing in a read-only or invisible field, and then copies nothing while
    // still reporting success. So the field is editable, on screen, and focused.
    ta.contentEditable = 'true';
    ta.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:0;opacity:0.01;font-size:16px';
    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    var range = document.createRange();
    range.selectNodeContents(ta);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    sel.removeAllRanges();
    ta.blur();
    ta.remove();
    if (ok) return Promise.resolve();
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return Promise.reject(new Error('copy'));
  }
  window.stgbCopy = copyNow;
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
    copyNow(text).then(function () { show('Copied'); }, function () { show('Select and copy'); });
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
  // Install celebration. On /install, the moment the extension is detected, the Send arrow
  // flies in as a paper plane, hits the center, and the "You're installed" card bursts out
  // with confetti in the four AI colors. It plays once per browser; /install#celebrate replays it.
  (function () {
    if (!document.querySelector('.flow') || !/\/install(\.html)?$/.test(location.pathname)) return;
    var KEY = 'stgb-install-celebrated';
    var forced = location.hash === '#celebrate';
    var seen = false;
    try { seen = localStorage.getItem(KEY) === '1'; } catch (e) {}
    var ready = function () { return document.documentElement.hasAttribute('data-stgb-ready'); };
    var played = false;

    function run() {
      if (played) return;
      played = true;
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var words = function (t) { return t.split(' ').map(function (w, i) { return '<span style="--i:' + i + '">' + w + '</span>'; }).join(' '); };

      var wrap = document.createElement('div');
      wrap.className = 'celebrate';
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.setAttribute('aria-labelledby', 'celebrate-title');
      wrap.innerHTML =
        '<div class="celebrate-aurora" aria-hidden="true"></div>' +
        '<canvas aria-hidden="true"></canvas>' +
        '<div class="celebrate-card">' +
          '<svg class="celebrate-check" viewBox="0 0 96 96" aria-hidden="true">' +
            '<circle class="ring" cx="48" cy="48" r="44"/>' +
            '<path class="tick" d="M29 49.5 L42.5 63 L68 35"/>' +
          '</svg>' +
          '<h2 id="celebrate-title" class="words">' + words('You’re installed.') + '</h2>' +
          '<p>The Send arrow is now on every post on x.com. One more step: pick your AI.</p>' +
          '<a class="btn large" href="/setup">Next: Choose your AI</a>' +
        '</div>';
      document.body.appendChild(wrap);
      var card = wrap.querySelector('.celebrate-card');
      var next = wrap.querySelector('.btn');
      var close = function () {
        wrap.classList.add('out');
        setTimeout(function () { wrap.remove(); }, 320);
        document.removeEventListener('keydown', onKey);
      };
      var onKey = function (e) { if (e.key === 'Escape') close(); };
      wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(function () { wrap.classList.add('in'); });
      var hit = function () { wrap.classList.add('hit'); next.focus({preventScroll: true}); };
      if (calm) { hit(); return; }

      // The card tilts a little toward the pointer, like a physical card.
      wrap.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
        card.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
      });

      var canvas = wrap.querySelector('canvas');
      var ctx = canvas.getContext('2d');
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W, H;
      function size() {
        W = innerWidth; H = innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      size();
      addEventListener('resize', size);
      var dark = matchMedia('(prefers-color-scheme: dark)').matches;
      // Grok Bot ink, Claude orange, ChatGPT green, X blue, plus a gold accent.
      var COLORS = [dark ? '#FFFFFF' : '#0F1419', '#D97757', '#10A37F', '#1D9BF0', '#F5B400'];
      var parts = [], rings = [], trail = [];

      function burst(x, y, n, angle, spread, speed) {
        for (var i = 0; i < n; i++) {
          var a = angle + (Math.random() - 0.5) * spread;
          var v = speed * (0.4 + Math.random() * 0.8);
          var r = Math.random();
          parts.push({
            x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            w: 6 + Math.random() * 8, h: 4 + Math.random() * 6,
            rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
            tilt: Math.random() * 6.28, vt: 0.06 + Math.random() * 0.12,
            shape: r < 0.16 ? 'plane' : r < 0.5 ? 'circle' : 'rect',
            color: COLORS[(Math.random() * COLORS.length) | 0],
            life: 0, max: 230 + Math.random() * 150
          });
        }
      }
      function planePath(s) {
        ctx.beginPath();
        ctx.moveTo(s, 0); ctx.lineTo(-s, -s * 0.78); ctx.lineTo(-s * 0.42, 0); ctx.lineTo(-s, s * 0.78);
        ctx.closePath();
      }
      // The flight: a swooping curve from the lower left that loops in to the card's center.
      var t0 = performance.now(), FLIGHT = 1050;
      var P = function () {
        var cx = W / 2, cy = H / 2 - 30;
        return [[-60, H * 0.82], [W * 0.18, H * 0.05], [W * 0.95, H * 0.22], [cx, cy]];
      };
      function bez(p, t) {
        var u = 1 - t;
        return [u*u*u*p[0][0] + 3*u*u*t*p[1][0] + 3*u*t*t*p[2][0] + t*t*t*p[3][0],
                u*u*u*p[0][1] + 3*u*u*t*p[1][1] + 3*u*t*t*p[2][1] + t*t*t*p[3][1]];
      }
      var ease = function (t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; };
      var landed = false;

      (function frame(now) {
        now = now || performance.now();
        ctx.clearRect(0, 0, W, H);
        var k = Math.min(1, (now - t0) / FLIGHT);
        if (!landed) {
          var p = P(), e = ease(k), pos = bez(p, e), ahead = bez(p, Math.min(1, e + 0.01));
          trail.push({x: pos[0], y: pos[1]});
          if (trail.length > 26) trail.shift();
          // Trail: a fading ribbon that shifts through the brand colors.
          for (var i = 1; i < trail.length; i++) {
            ctx.strokeStyle = COLORS[1 + (i % 4)];
            ctx.globalAlpha = i / trail.length * 0.9;
            ctx.lineWidth = 1 + i / trail.length * 5;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(trail[i-1].x, trail[i-1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
          }
          ctx.globalAlpha = 1;
          ctx.save();
          ctx.translate(pos[0], pos[1]);
          ctx.rotate(Math.atan2(ahead[1] - pos[1], ahead[0] - pos[0]));
          ctx.fillStyle = dark ? '#FFFFFF' : '#0F1419';
          ctx.shadowColor = 'rgba(29,155,240,.55)'; ctx.shadowBlur = 18;
          planePath(16 + 10 * Math.sin(k * Math.PI));
          ctx.fill();
          ctx.restore();
          if (k >= 1) {
            landed = true;
            var c = P()[3];
            rings.push({x: c[0], y: c[1], r: 10, a: 1, w: 6}, {x: c[0], y: c[1], r: 4, a: 0.8, w: 3, delay: 6});
            burst(c[0], c[1], 170, 0, Math.PI * 2, 15);
            hit();
            setTimeout(function () {
              burst(0, H, 100, -Math.PI / 3.1, 0.55, 22);
              burst(W, H, 100, -Math.PI + Math.PI / 3.1, 0.55, 22);
            }, 280);
          }
        }
        for (var j = rings.length - 1; j >= 0; j--) {
          var g = rings[j];
          if (g.delay) { g.delay--; continue; }
          g.r += (Math.max(W, H) * 0.75 - g.r) * 0.06; g.a *= 0.93;
          ctx.globalAlpha = g.a; ctx.strokeStyle = '#1D9BF0'; ctx.lineWidth = g.w;
          ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 6.28); ctx.stroke();
          if (g.a < 0.02) rings.splice(j, 1);
        }
        ctx.globalAlpha = 1;
        for (var n = parts.length - 1; n >= 0; n--) {
          var q = parts[n];
          q.life++;
          q.vx *= 0.982; q.vy = q.vy * 0.982 + 0.26;
          q.x += q.vx; q.y += q.vy; q.rot += q.vr; q.tilt += q.vt;
          if (q.life > q.max || q.y > H + 40) { parts.splice(n, 1); continue; }
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, (q.max - q.life) / 60));
          ctx.translate(q.x, q.y);
          ctx.fillStyle = q.color;
          if (q.shape === 'plane') { ctx.rotate(Math.atan2(q.vy, q.vx)); planePath(q.w * 0.8); ctx.fill(); }
          else {
            ctx.rotate(q.rot); ctx.scale(1, Math.cos(q.tilt));
            if (q.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, q.h / 1.6, 0, 6.28); ctx.fill(); }
            else ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
          }
          ctx.restore();
        }
        if (!landed || parts.length || rings.length) requestAnimationFrame(frame);
        else removeEventListener('resize', size);
      })();
    }

    if (forced) { if (history.replaceState) history.replaceState(null, '', location.pathname); setTimeout(run, 300); return; }
    if (seen) return;
    if (ready()) { setTimeout(run, 400); return; }
    new MutationObserver(function (m, o) { if (ready()) { o.disconnect(); setTimeout(run, 400); } })
      .observe(document.documentElement, {attributes: true, attributeFilter: ['data-stgb-ready']});
  })();
})();
