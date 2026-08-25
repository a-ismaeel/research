// Side drawer, section rail, scoreboard column focus, chart hover read-out.
(function () {
  /* Honour the OS "reduce motion" setting for programmatic scrolls. A CSS media
     query cannot override a behavior passed in JS, so the query is read here.
     Read live rather than cached so a mid-session change is picked up. */
  function motionOK() {
    return !window.matchMedia ||
           !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

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
    toggle.addEventListener('click', function () { setDrawer(panel.hidden); });
  }
  if (scrim) scrim.addEventListener('click', function () { setDrawer(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel && !panel.hidden) {
      setDrawer(false);
      toggle.focus();
    }
  });

  /* ---------------- section rail ----------------
     Marks the section you are currently reading. Without it a long page gives
     no sense of position, which is what made the tabbed version hard to use in
     a different way. IntersectionObserver rather than a scroll handler so it
     costs nothing while idle. */
  var railLinks = [].slice.call(document.querySelectorAll('.toc a'));
  if (railLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    railLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

    var targets = railLinks
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    var visible = {};
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      // Highest section currently on screen wins, so scrolling up marks the
      // section you have moved back into rather than the one below it.
      var current = null;
      for (var i = 0; i < targets.length; i++) {
        if (visible[targets[i].id]) { current = targets[i].id; break; }
      }
      railLinks.forEach(function (a) {
        a.classList.toggle('on', a.getAttribute('href').slice(1) === current);
      });
    }, { rootMargin: '-12% 0px -70% 0px', threshold: 0 });

    targets.forEach(function (t) { obs.observe(t); });

    railLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        var t = document.getElementById(a.getAttribute('href').slice(1));
        if (!t) return;
        e.preventDefault();
        t.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' });
        if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
      });
    });
  }

  /* ---------------- scoreboard column focus ---------------- */
  var sb = document.getElementById('sb-table');
  if (sb) {
    var heads = [].slice.call(sb.querySelectorAll('th.sb-co'));

    function focusCo(co) {
      if (!co || sb.getAttribute('data-hl') === co) {
        sb.removeAttribute('data-hl');
        sb.querySelectorAll('.on').forEach(function (el) { el.classList.remove('on'); });
        heads.forEach(function (h) { h.setAttribute('aria-pressed', 'false'); });
        return;
      }
      sb.setAttribute('data-hl', co);
      sb.querySelectorAll('[data-co]').forEach(function (el) {
        el.classList.toggle('on', el.getAttribute('data-co') === co);
      });
      heads.forEach(function (h) {
        h.setAttribute('aria-pressed', h.getAttribute('data-co') === co ? 'true' : 'false');
      });
    }

    heads.forEach(function (h) {
      h.setAttribute('role', 'button');
      h.setAttribute('tabindex', '0');
      h.setAttribute('aria-pressed', 'false');
      h.title = 'Show this company on its own';
      h.addEventListener('click', function () { focusCo(h.getAttribute('data-co')); });
      h.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          focusCo(h.getAttribute('data-co'));
        }
      });
    });
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
