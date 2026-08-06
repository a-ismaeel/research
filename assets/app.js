// Side drawer + sub-ribbon tab routing + chart hover read-out.
(function () {
  /* ---------------- side drawer ---------------- */
  var toggle = document.querySelector('.navtoggle');
  var panel = document.getElementById('drawer');
  var scrim = document.querySelector('.scrim');

  function setDrawer(open) {
    if (!toggle || !panel) return;
    panel.hidden = !open;
    if (scrim) scrim.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      var first = panel.querySelector('a');
      if (first) first.focus();
    }
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setDrawer(panel.hidden);
    });
  }
  if (scrim) scrim.addEventListener('click', function () { setDrawer(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel && !panel.hidden) {
      setDrawer(false);
      toggle.focus();
    }
  });

  /* ---------------- tabs ---------------- */
  function activate(key, push) {
    var panels = document.querySelectorAll('.tabpanel');
    // Check for a match before touching anything — a hash that isn't a tab
    // (e.g. an in-page anchor like #companies) must leave the current tab
    // alone rather than blanking every panel.
    var found = false;
    panels.forEach(function (p) { if (p.dataset.tab === key) found = true; });
    if (!found) return false;
    panels.forEach(function (p) {
      p.classList.toggle('active', p.dataset.tab === key);
    });
    document.querySelectorAll('.subribbon button').forEach(function (b) {
      var on = b.dataset.tab === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (push && history.replaceState) history.replaceState(null, '', '#' + key);
    return true;
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.subribbon button');
    if (!b) return;
    activate(b.dataset.tab, true);
    window.scrollTo(0, 0);
  });

  // In-page links to a heading within the current tab (e.g. the "Companies
  // covered" KPI tile pointing at #companies) rather than to another tab.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var target = id && document.getElementById(id);
    if (!target || target.classList.contains('tabpanel')) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });

  window.addEventListener('hashchange', function () {
    activate(location.hash.replace('#', ''), false);
  });

  var initial = location.hash.replace('#', '');
  if (!initial || !activate(initial, false)) {
    var first = document.querySelector('.subribbon button');
    if (first) activate(first.dataset.tab, false);
  }

  /* ---------------- chart hover ---------------- */
  function fmt(v, f) {
    if (v === null || v === undefined) return '—';
    switch (f) {
      case 'pct': return (v * 100).toFixed(1) + '%';
      case 'pp': return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + 'pt';
      case 'num2': return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'x': return v.toFixed(2) + 'x';
      default:
        return Math.abs(v) < 100
          ? v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
          : Math.round(v).toLocaleString();
    }
  }

  document.querySelectorAll('.chartbox').forEach(function (box) {
    var cfg;
    try { cfg = JSON.parse(box.dataset.chart); } catch (err) { return; }
    var svg = box.querySelector('svg');
    var tip = box.querySelector('.tip');
    var guide = box.querySelector('.guide');
    if (!svg || !tip) return;
    var vb = svg.viewBox.baseVal;

    function idxAt(vx) {
      if (cfg.mode === 'ts') {
        var t = (vx - cfg.ml) / cfg.pw * (cfg.n - 1);
        return Math.max(0, Math.min(cfg.n - 1, Math.round(t)));
      }
      var step = cfg.pw / cfg.n;
      return Math.max(0, Math.min(cfg.n - 1, Math.floor((vx - cfg.ml) / step)));
    }

    function gx(i) {
      if (cfg.mode === 'ts') return cfg.ml + (i / Math.max(cfg.n - 1, 1)) * cfg.pw;
      var step = cfg.pw / cfg.n;
      return cfg.ml + i * step + step / 2;
    }

    function move(ev) {
      var r = svg.getBoundingClientRect();
      var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
      var vx = (cx - r.left) / r.width * vb.width;
      if (vx < cfg.ml - 4 || vx > cfg.ml + cfg.pw + 4) return hide();
      var i = idxAt(vx);

      var rows = '', total = 0, any = false;
      cfg.series.forEach(function (s) {
        var v = s.values[i];
        if (v !== null && v !== undefined && !s.line) { total += v; any = true; }
        rows += '<div class="tr"><i style="background:' + s.color + '"></i>' +
                '<span class="n">' + s.name + '</span>' +
                '<b>' + fmt(v, s.fmt) + '</b></div>';
      });
      if (cfg.total && any) {
        rows += '<div class="tr tot"><i></i><span class="n">Total</span><b>' +
                fmt(total, cfg.series[0].fmt) + '</b></div>';
      }
      tip.innerHTML = '<div class="th">' + cfg.labels[i] + '</div>' + rows;
      tip.hidden = false;

      var px = gx(i) / vb.width * r.width;
      var tw = tip.offsetWidth;
      var left = Math.max(0, Math.min(r.width - tw, px - tw / 2));
      tip.style.left = left + 'px';
      if (guide) {
        guide.setAttribute('x1', gx(i));
        guide.setAttribute('x2', gx(i));
        guide.setAttribute('opacity', '0.55');
      }
    }

    function hide() {
      tip.hidden = true;
      if (guide) guide.setAttribute('opacity', '0');
    }

    box.addEventListener('mousemove', move);
    box.addEventListener('touchmove', move, { passive: true });
    box.addEventListener('mouseleave', hide);
    box.addEventListener('touchend', hide);
  });
})();
