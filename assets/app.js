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
     costs nothing while idle.

     The rail is a two-level spine: the same grouping questions on every
     industry, with that industry's own headings nested under them. One DOM
     serves both breakpoints -- on the rail the active section's children open
     automatically, and below 980px CSS turns the same nav into a bottom sheet
     driven by the bar. */
  var toc = document.getElementById('toc');
  var items = toc ? [].slice.call(toc.querySelectorAll('.toc-i')) : [];

  if (items.length && 'IntersectionObserver' in window) {
    var order = items.map(function (el) { return el.getAttribute('data-sec'); });

    var targets = order
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);

    /* Spine item -> the ids it speaks for, so the bar can name the section a
       reader is in even when they are deep inside a child. */
    var ownerOf = {};
    items.forEach(function (el) {
      var id = el.getAttribute('data-sec');
      // A spine row is reached before its children and claims them below, so
      // never overwrite a mapping that is already there -- a child pointing at
      // itself would leave its parent closed while the child is being read.
      if (!(id in ownerOf)) ownerOf[id] = id;
      var kids = el.nextElementSibling;
      if (el.classList.contains('toc-sp') && kids && kids.classList.contains('toc-kids')) {
        [].slice.call(kids.querySelectorAll('.toc-i')).forEach(function (k) {
          ownerOf[k.getAttribute('data-sec')] = id;
        });
      }
    });

    var spineItems = items.filter(function (el) {
      return !el.classList.contains('toc-ki');
    });

    var bar = document.querySelector('.tocbar');
    var barText = document.querySelector('.tocbar-t');
    var barNum = document.querySelector('.tocbar-n');

    function kidsOf(el) {
      var n = el.nextElementSibling;
      return (n && n.classList.contains('toc-kids')) ? n : null;
    }

    /* A section is "open" on the rail when it or one of its children is the
       one being read. The moment the reader uses an expander on the sheet
       they take over, and scrolling stops rearranging what they opened --
       otherwise a section they just opened snaps shut under them. Control
       goes back to the page when the sheet closes. */
    var manualMode = false;

    function mark(current) {
      var owner = ownerOf[current] || current;
      // Both the child being read and the spine row above it are marked, so
      // the rail shows the trail rather than a single orphaned line.
      items.forEach(function (el) {
        var id = el.getAttribute('data-sec');
        el.classList.toggle('on', id === current || id === owner);
      });
      if (!manualMode) {
        spineItems.forEach(function (el) {
          var kids = kidsOf(el);
          if (!kids) return;
          var open = el.getAttribute('data-sec') === owner;
          var x = el.querySelector('.toc-x');
          kids.classList.toggle('open', open);
          if (x) x.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }
      if (barText) {
        var sp = spineItems.filter(function (el) {
          return el.getAttribute('data-sec') === owner;
        })[0];
        var link = sp && sp.querySelector('a');
        if (link) barText.textContent = link.textContent.trim();
        if (barNum && sp) {
          barNum.textContent = (spineItems.indexOf(sp) + 1) + '/' + spineItems.length;
        }
      }
    }

    var visible = {};
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      // Highest section currently on screen wins, so scrolling up marks the
      // section you have moved back into rather than the one below it.
      var current = null;
      for (var i = 0; i < targets.length; i++) {
        if (visible[targets[i].id]) { current = targets[i].id; break; }
      }
      if (current) mark(current);
    }, { rootMargin: '-12% 0px -70% 0px', threshold: 0 });

    targets.forEach(function (t) { obs.observe(t); });
    if (targets.length) mark(targets[0].id);

    /* ---- the sheet ---- */
    var scrim2 = document.querySelector('.toc-scrim');
    var closeBtn = document.querySelector('.toc-close');

    function setSheet(open) {
      if (!bar || !toc) return;
      toc.classList.toggle('open', open);
      if (scrim2) scrim2.hidden = !open;
      bar.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
      if (!open) manualMode = false;
    }

    if (bar) bar.addEventListener('click', function () {
      setSheet(!toc.classList.contains('open'));
    });
    if (scrim2) scrim2.addEventListener('click', function () { setSheet(false); });
    if (closeBtn) closeBtn.addEventListener('click', function () { setSheet(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toc && toc.classList.contains('open')) {
        setSheet(false);
        if (bar) bar.focus();
      }
    });

    /* First tap on a spine row's expander opens it; the label still navigates,
       so nothing is two taps away that used to be one. */
    toc.addEventListener('click', function (e) {
      var x = e.target.closest('.toc-x');
      if (!x) return;
      var row = x.closest('.toc-i');
      var kids = kidsOf(row);
      if (!kids) return;
      manualMode = true;
      var open = !kids.classList.contains('open');
      kids.classList.toggle('open', open);
      x.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    toc.addEventListener('click', function (e) {
      var a = e.target.closest('.toc-i > a');
      if (!a) return;
      var t = document.getElementById(a.getAttribute('href').slice(1));
      if (!t) return;
      e.preventDefault();
      setSheet(false);
      t.scrollIntoView({ behavior: motionOK() ? 'smooth' : 'auto', block: 'start' });
      if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
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

  /* ---------------- appendix: follow one company ----------------
     The appendix is metric-first, so one company's line runs across fifty
     tables instead of down one. This dims the others on every table at once
     and leaves the industry row alone, because the aggregate is the point of
     comparison rather than a competitor. The rail is hidden in the markup and
     revealed here, so a reader without JS gets all rows rather than a control
     that does nothing. */
  var trace = document.getElementById('trace');
  var apBody = trace && trace.closest('.lf-body');
  if (trace && apBody) {
    trace.hidden = false;
    var chips = [].slice.call(trace.querySelectorAll('.tr-chip'));

    function setTrace(co) {
      if (co) apBody.setAttribute('data-trace', co);
      else apBody.removeAttribute('data-trace');
      // CSS cannot compare a row's data-co against an ancestor's data-trace,
      // so the match is marked here.
      apBody.querySelectorAll('.ap tbody tr[data-co]').forEach(function (r) {
        r.classList.toggle('on', !!co && r.getAttribute('data-co') === co);
      });
      chips.forEach(function (c) {
        var on = (c.getAttribute('data-co') || '') === (co || '');
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    trace.addEventListener('click', function (e) {
      var c = e.target.closest('.tr-chip');
      if (!c) return;
      var co = c.getAttribute('data-co') || '';
      // Clicking the active company again clears it, same as the scoreboard.
      setTrace(apBody.getAttribute('data-trace') === co ? '' : co);
    });

    // Clicking a company's name inside any table is the same gesture. The
    // chips carry the keyboard path, so these rows take no tab stop.
    apBody.addEventListener('click', function (e) {
      var th = e.target.closest('.ap tbody tr[data-co] th.rl2');
      if (!th) return;
      var row = th.parentNode;
      if (row.classList.contains('agg')) return;
      var co = row.getAttribute('data-co');
      setTrace(apBody.getAttribute('data-trace') === co ? '' : co);
    });
  }

  /* ---------------- chart hover ---------------- */
  function fmt(v, f) {
    if (v === null || v === undefined) return 'n/a';
    switch (f) {
      case 'pct': return (v * 100).toFixed(1) + '%';
      case 'pp': return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + 'pt';
      case 'num2': return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'x': return v.toFixed(2) + 'x';
      case 'd': return Math.round(v).toLocaleString() + ' days';
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
