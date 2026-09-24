// Reading progress, side drawer, section rail, scoreboard column focus,
// prose claims, build stack progress, chart hover read-out.
(function () {
  /* Honour the OS "reduce motion" setting for programmatic scrolls. A CSS media
     query cannot override a behavior passed in JS, so the query is read here.
     Read live rather than cached so a mid-session change is picked up. */
  function motionOK() {
    return !window.matchMedia ||
           !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------------- reading progress ----------------
     How far down the piece you are, as a 2px rule across the top of the
     viewport. These pages run long and the rail only says which section you
     are in, not how much of the whole is left.

     Passive listener into one rAF, because this fires on every scroll tick and
     reading window.scrollY inside the frame keeps the layout read out of the
     event handler. Drawn once immediately as well: a reload restores the old
     scroll position without firing a scroll event, and a bar that reads zero
     two thirds of the way down a page is worse than no bar. */
  var readbar = document.querySelector('.readbar');
  if (readbar) {
    var queued = false;

    function drawProgress() {
      queued = false;
      var d = document.documentElement;
      var max = d.scrollHeight - window.innerHeight;
      var pos = window.pageYOffset || d.scrollTop || 0;
      var pct = max > 0 ? (pos / max) * 100 : 0;
      readbar.style.transform =
        'scaleX(' + (Math.max(0, Math.min(100, pct)) / 100) + ')';
    }

    function queueProgress() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(drawProgress);
    }

    window.addEventListener('scroll', queueProgress, { passive: true });
    // The denominator moves when the viewport does, and on the sheet
    // breakpoints the page height changes with it.
    window.addEventListener('resize', queueProgress, { passive: true });
    drawProgress();
    // Fonts and images landing after this script runs change scrollHeight, and
    // scroll restoration can arrive after it too.
    window.addEventListener('load', drawProgress);
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

  /* ---------------- prose claims ----------------
     A sentence that names a series, wired to the series it names. Hovering or
     focusing the phrase drops everything else in the chart back and leaves
     that one line at full strength, so the reader does not have to find it in
     a legend first.

     Generic on purpose: this knows nothing about ROIC or any other series. A
     claim carries the chart's id and a series key, the chart carries groups
     tagged with the same keys, and all this does is toggle two attributes.
     The dimming itself is in the stylesheet.

     data-chart takes one id or several separated by spaces. Several, because a
     section can answer one question with a panel per company, and a claim
     about "what that capital costs" is a claim about all of them.

     Note the collision of names: .chartbox also carries a data-chart, holding
     the hover payload. Different element, different meaning. */
  /* At most one company is pinned across the whole page. */
  var pinned = null;
  document.querySelectorAll('.claim[data-chart][data-series]').forEach(function (btn) {
    var key = btn.getAttribute('data-series');
    var boxes = (btn.getAttribute('data-chart') || '').split(/\s+/)
      .filter(Boolean)
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    // A claim pointing at a chart that is not on this page stays inert rather
    // than becoming a control that does nothing when pressed.
    if (!boxes.length) return;

    function lift() {
      boxes.forEach(function (box) {
        box.setAttribute('data-dim', '');
        box.querySelectorAll('[data-series]').forEach(function (g) {
          if (g.getAttribute('data-series') === key) g.setAttribute('data-on', '');
          else g.removeAttribute('data-on');
        });
      });
    }

    function drop() {
      boxes.forEach(function (box) {
        box.removeAttribute('data-dim');
        box.querySelectorAll('[data-on]').forEach(function (g) {
          g.removeAttribute('data-on');
        });
      });
    }

    /* A pin outranks a hover: passing the cursor over another name must not
       silently undo the thing the reader deliberately chose. */
    btn.addEventListener('mouseenter', function () { if (!pinned) lift(); });
    btn.addEventListener('focus', function () { if (!pinned) lift(); });
    btn.addEventListener('mouseleave', function () { if (!pinned) drop(); });
    btn.addEventListener('blur', function () { if (!pinned) drop(); });

    /* Narrow enough and the chart is below the fold rather than beside the
       sentence, so the highlight happens somewhere the reader cannot see.
       880px is where .grid2 and .grid3 already give up their columns. */
    /* Pinning, not just hovering.
       Hover is a convenience that half the readers do not have. A tap or a
       click pins the company until it is tapped again or another one is, which
       is the same gesture on a phone, a tablet and a desktop. The narrow-screen
       scroll stays, because there the chart is below the sentence. */
    function activate() {
      var already = btn.getAttribute('aria-pressed') === 'true';
      document.querySelectorAll('.claim[aria-pressed="true"]').forEach(
        function (o) { o.setAttribute('aria-pressed', 'false'); });
      if (already) { pinned = null; drop(); return; }
      btn.setAttribute('aria-pressed', 'true');
      pinned = btn;
      lift();
      if (window.innerWidth < 880) {
        boxes[0].scrollIntoView({
          behavior: motionOK() ? 'smooth' : 'auto', block: 'center',
        });
      }
    }

    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', activate);
    /* A claim is a span with a button role, so the keyboard activation a real
       <button> would have given for free is wired here. Space is prevented
       first: on a span it scrolls the page instead of pressing anything. */
    btn.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      activate();
    });
  });

  /* ---------------- the build stack: how much is paid for ----------------
     Stack-only, because only the stack is a sequence.

     Highlighting a company from the prose is not here: every figure on the
     page uses the prose-claim handler above, which already carries pointer,
     keyboard and touch. There is one mechanism for that gesture and this is
     not it. */
  var stk = document.querySelector('.stk');
  if (stk) {
    var stages = [].slice.call(stk.querySelectorAll('.stage'));

    var reached = 1;

    function paint(n) {
      if (n === reached) return;
      reached = n;
      stages.forEach(function (s, i) { s.classList.toggle('built', i < n); });
    }

    /* The stage being read is the last one whose top has crossed a line a
       little above the middle of the viewport, which is roughly where a
       reader is actually looking. Read off the rects rather than from an
       IntersectionObserver: a stage is tall enough that the band an observer
       would need is narrow, and a fast scroll or a jump to an anchor can step
       straight over a narrow band and leave the count behind. Five rect reads
       inside one rAF is cheaper than being wrong.

       Above the figure nothing has crossed, so it holds at stage one; below it
       everything has, so it holds at five. Scrolling back up rolls the
       count back, because the stack is only as built as the part you have
       read. */
    var qd = false;

    function readStage() {
      qd = false;
      var line = window.innerHeight * 0.38;
      var n = 1;
      for (var i = 0; i < stages.length; i++) {
        if (stages[i].getBoundingClientRect().top <= line) n = i + 1;
      }
      paint(n);
    }

    function queueStage() {
      if (qd) return;
      qd = true;
      requestAnimationFrame(readStage);
    }

    window.addEventListener('scroll', queueStage, { passive: true });
    window.addEventListener('resize', queueStage, { passive: true });
    readStage();
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
      /* Millions of riyals, for a chart whose values are already divided down.
         Additive: no existing series names this format. */
      case 'sarm': return 'SAR ' + (Math.abs(v) >= 100 ? Math.round(v).toLocaleString()
          : v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })) + 'M';
      /* Whole riyals, for a per-head figure. Additive, like sarm. */
      case 'sar0': return 'SAR ' + Math.round(v).toLocaleString();
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
  /* ---------------- spread panels: draw once on first view ----------------
     The finished chart is the resting state. This only adds .sp-in, which
     replays the ROIC line's stroke; with reduced motion nothing is added. */
  var panels = [].slice.call(document.querySelectorAll('svg.sp'));
  if (panels.length && 'IntersectionObserver' in window && motionOK()) {
    panels.forEach(function (svg) {
      var ln = svg.querySelector('.sp-roic');
      if (ln && ln.getTotalLength) svg.style.setProperty('--len', Math.ceil(ln.getTotalLength()));
    });
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('sp-in');
        seen.unobserve(e.target);
      });
    }, { threshold: 0.35 });
    panels.forEach(function (svg) { seen.observe(svg); });
  }

  /* ---------------- table headers that follow the page ----------------
     position:sticky cannot do this: .tbl-wrap scrolls sideways, so it is the
     sticky container and the header never moves. Any table of eight rows or
     more outside the appendix gets its header translated while it is on
     screen, clearing the mobile section bar or the company switcher. */
  var heads = [].slice.call(document.querySelectorAll('table')).filter(function (t) {
    return t.tHead && t.tBodies[0] && t.tBodies[0].rows.length >= 8 && !t.closest('.ap, .vh');
  });
  if (heads.length) {
    heads.forEach(function (t) { t.classList.add('float-head'); });
    var clearance = function () {
      var o = 0;
      [document.querySelector('.tocbar'), document.querySelector('.cosw')].forEach(function (b) {
        if (b && getComputedStyle(b).position === 'sticky' && getComputedStyle(b).display !== 'none') {
          o = Math.max(o, b.offsetHeight);
        }
      });
      return o;
    };
    var queued = false;
    var place = function () {
      queued = false;
      var top = clearance();
      heads.forEach(function (t) {
        var r = t.getBoundingClientRect(), hh = t.tHead.offsetHeight;
        var dy = Math.max(0, Math.min(top - r.top, r.height - hh - 44));
        t.style.setProperty('--hy', dy + 'px');
        t.classList.toggle('floating', dy > 0);
      });
    };
    window.addEventListener('scroll', function () {
      if (!queued) { queued = true; requestAnimationFrame(place); }
    }, { passive: true });
    window.addEventListener('resize', place, { passive: true });
    place();
  }

  /* ---------------- column read-across ----------------
     The row already lights on hover; this lights the column, so a reader can
     answer "which company, which year" without tracing a finger. Rows with a
     spanning cell (group headings) are left alone. */
  var lit = [];
  function spans(row) { return [].some.call(row.cells, function (c) { return c.colSpan > 1; }); }
  document.addEventListener('mouseover', function (e) {
    var cell = e.target.closest && e.target.closest('td, th');
    lit.forEach(function (c) { c.classList.remove('col-on'); });
    lit = [];
    if (!cell) return;
    var tbl = cell.closest('table');
    if (!tbl || tbl.closest('.vh') || tbl.classList.contains('matrix') ||
        tbl.classList.contains('mkspec') || spans(cell.parentElement) || cell.cellIndex === 0) return;
    var i = cell.cellIndex;
    [].forEach.call(tbl.rows, function (r) {
      if (spans(r)) return;
      var c = r.cells[i];
      if (c) { c.classList.add('col-on'); lit.push(c); }
    });
  });

  /* ---------------- appendix on a phone ----------------
     Every table opens on the reporting year rather than on the first, and the
     pinned company column takes an edge once the years slide under it. */
  document.querySelectorAll('.ap .tbl-wrap').forEach(function (w) {
    w.addEventListener('scroll', function () {
      w.classList.toggle('is-scrolled', w.scrollLeft > 2);
    }, { passive: true });
    if (window.innerWidth <= 780) w.scrollLeft = w.scrollWidth;
  });

  /* ---------------- company switcher ----------------
     On a phone the strip scrolls; start it with the current company in view. */
  var cur = document.querySelector('.cosw [aria-current]');
  if (cur && cur.parentElement.scrollWidth > cur.parentElement.clientWidth) {
    cur.parentElement.scrollLeft = cur.offsetLeft - (cur.parentElement.clientWidth - cur.offsetWidth) / 2;
  }

  /* ---------------- defined terms ----------------
     A .def button opens its entry from the page's glossary templates in one
     popover (the popover API, so no scroll container can clip it). Hover and
     focus open it, a tap toggles it, Escape and a click elsewhere close it. */
  var pop = null, openBtn = null;
  function entry(key) { return document.querySelector('template[data-def="' + key + '"]'); }
  function showDef(btn) {
    var t = entry(btn.getAttribute('data-def'));
    if (!t) return;
    if (!pop) {
      pop = document.createElement('div');
      pop.className = 'defpop'; pop.setAttribute('role', 'tooltip'); pop.id = 'defpop';
      pop.setAttribute('popover', 'manual');
      document.body.appendChild(pop);
    }
    pop.innerHTML = t.innerHTML;
    if (pop.showPopover) { try { pop.showPopover(); } catch (err) {} } else { pop.style.display = 'block'; }
    btn.setAttribute('aria-describedby', 'defpop');
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left)) + 'px';
    pop.style.top = (r.bottom + 8 + h > window.innerHeight ? r.top - h - 8 : r.bottom + 8) + 'px';
    openBtn = btn;
  }
  function hideDef() {
    if (!pop || !openBtn) return;
    if (pop.hidePopover) { try { pop.hidePopover(); } catch (err) {} } else { pop.style.display = 'none'; }
    openBtn.removeAttribute('aria-describedby');
    openBtn = null;
  }
  var hoverable = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.def');
    if (b) { e.preventDefault(); if (openBtn === b) hideDef(); else showDef(b); }
    else if (openBtn && !(e.target.closest && e.target.closest('.defpop'))) hideDef();
  });
  document.addEventListener('mouseover', function (e) {
    var b = hoverable && e.target.closest && e.target.closest('.def');
    if (b && b !== openBtn) showDef(b);
  });
  document.addEventListener('mouseout', function (e) {
    var b = e.target.closest && e.target.closest('.def');
    if (b && b === openBtn && !(e.relatedTarget && b.contains(e.relatedTarget))) hideDef();
  });
  document.addEventListener('focusin', function (e) {
    if (e.target.classList && e.target.classList.contains('def')) showDef(e.target);
  });
  document.addEventListener('focusout', function (e) { if (e.target === openBtn) hideDef(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideDef(); });
})();
