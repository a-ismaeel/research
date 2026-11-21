/* Small SVG chart kit for the redesign prototype. No dependencies.
   Every chart draws at the container's real pixel width (so text never
   scales), redraws on resize, and carries a hover read-out. One y-axis per
   chart, always: a second measure goes in a text strip under the years. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const MINUS = "-";

  // ---------- number formats (site policy: B / M, plain hyphen) ----------
  const F = {
    n(v, dp) {
      if (v == null || isNaN(v)) return "n/a";
      if (dp == null) dp = Math.abs(v) >= 100 ? 0 : 1;
      const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
      return (v < 0 ? MINUS : "") + s;
    },
    // input SAR millions
    sar(m) {
      if (m == null) return "n/a";
      const a = Math.abs(m);
      if (a >= 1000) return F.n(m / 1000) + "B";
      return F.n(m) + "M";
    },
    sarFull(m) { return "SAR " + F.sar(m); },
    b(m) { return F.n(m / 1000); },           // SAR billions, no unit
    pct(v, dp = 1) { return v == null ? "n/a" : F.n(v * 100, dp) + "%"; },
    pct0(v) { return F.pct(v, 0); },
    spct(v, dp = 1) { if (v == null) return "n/a"; const r = +(v * 100).toFixed(dp); return r === 0 ? F.n(0, dp) + "%" : (r > 0 ? "+" : "") + F.n(r, dp) + "%"; },
    pts(d, dp = 1) { const r = +(d * 100).toFixed(dp); return r === 0 ? F.n(0, dp) + " pts" : (r > 0 ? "+" : "") + F.n(r, dp) + " pts"; },
    x(v) { return v == null ? "n/a" : F.n(v, 1) + "x"; },
    m(v) { return F.n(v / 1e6, 1) + "m"; },    // counts in millions
    k(v) { return v >= 1000 ? F.n(v / 1000, 1) + "k" : F.n(v, 0); },
    int(v) { return F.n(v, 0); },
  };

  // ---------- tooltip ----------
  let tip;
  function tipEl() {
    if (!tip) { tip = document.createElement("div"); tip.className = "tip"; document.body.appendChild(tip); }
    return tip;
  }
  function showTip(ev, head, rows) {
    const t = tipEl();
    t.innerHTML = `<div class="th">${head}</div>` + rows.map(r =>
      `<div class="tr"><span>${r.c ? `<i style="background:${r.c}"></i>` : ""}${r.k}</span><b>${r.v}</b></div>`).join("");
    t.classList.add("on");
    moveTip(ev);
  }
  function moveTip(ev) {
    const t = tipEl(), pad = 14;
    let x = ev.clientX + pad, y = ev.clientY + pad;
    const r = t.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
    t.style.left = x + "px"; t.style.top = y + "px";
  }
  function hideTip() { tipEl().classList.remove("on"); }
  window.addEventListener("scroll", () => tip && tip.classList.remove("on"), { passive: true });

  // ---------- svg helpers ----------
  function el(tag, attrs, parent, text) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  // Bar with 4px rounded data end, square at the baseline.
  function barPath(x, y0, w, y1, r = 4) {
    const h = y0 - y1;
    if (Math.abs(h) < 0.5) return `M${x},${y0}h${w}`;
    const up = h > 0;
    r = Math.min(r, w / 2, Math.abs(h));
    if (up) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
    return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / e;
    const step = m <= 1 ? 1 : m <= 1.2 ? 1.2 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10;
    return step * e;
  }
  function ticks(min, max, n = 4) {
    const span = max - min, raw = span / n;
    const e = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = [1, 2, 2.5, 5, 10].map(s => s * e).find(s => span / s <= n + 0.01) || raw;
    const out = [];
    for (let v = Math.ceil(min / st) * st; v <= max + 1e-9; v += st) out.push(+v.toFixed(10));
    return out;
  }

  const registry = [];
  function mount(host, draw) {
    const node = typeof host === "string" ? document.querySelector(host) : host;
    if (!node) return;
    const render = () => {
      const W = Math.max(280, node.clientWidth);
      node.innerHTML = "";
      draw(node, W);
    };
    render();
    registry.push({ node, render, w: node.clientWidth });
  }
  let rT;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => registry.forEach(r => {
      if (!r.node.isConnected) return;
      if (Math.abs(r.node.clientWidth - r.w) > 2) { r.w = r.node.clientWidth; r.render(); }
    }), 120);
  });

  function svgRoot(node, W, H, label) {
    const s = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": label || "" }, node);
    s.addEventListener("mouseleave", () => { hideTip(); s.classList.remove("dim"); s.querySelectorAll(".hl").forEach(n => n.classList.remove("hl")); });
    return s;
  }
  function hl(svg, nodes) {
    svg.classList.add("dim");
    svg.querySelectorAll(".hl").forEach(n => n.classList.remove("hl"));
    nodes.forEach(n => n && n.classList.add("hl"));
  }

  // ---------- 1. Single-series columns with optional text strips ----------
  // o: {years, values, color, deep, label(v), tip(v), strips:[{name, values, fmt, color(v)}], height, min0}
  function bars(host, o) {
    mount(host, (node, W) => {
      const strips = o.strips || [];
      const H = (o.height || 230) + strips.length * 18 + (strips.length ? 16 : 0);
      const pl = 8, pr = 8, pt = 22, pb = 26 + strips.length * 18 + (strips.length ? 16 : 0);
      const svg = svgRoot(node, W, H, o.aria);
      const n = o.years.length, iw = W - pl - pr, bw = iw / n;
      const vals = o.values;
      const max = niceMax(Math.max(...vals.filter(v => v != null)) * 1.04);
      const minV = Math.min(0, ...vals.filter(v => v != null));
      const min = minV < 0 ? -niceMax(-minV * 1.1) : 0;
      const y = v => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
      ticks(min, max, 3).forEach(t => { if (t !== 0) el("line", { x1: pl, x2: W - pr, y1: y(t), y2: y(t), class: "gl" }, svg); });
      const w = Math.min(46, bw * 0.62);
      vals.forEach((v, i) => {
        const cx = pl + bw * i + bw / 2;
        const g = el("g", { class: "mk" }, svg);
        if (v != null) {
          const isLast = i === n - 1 && o.deep;
          el("path", { d: barPath(cx - w / 2, y(0), w, y(v)), fill: isLast ? o.deep : o.color }, g);
          const lab = o.label ? o.label(v, i) : F.n(v);
          if (lab !== "" && (o.labelAll !== false || i === 0 || i === n - 1))
            el("text", { x: cx, y: v >= 0 ? y(v) - 6 : y(v) + 14, "text-anchor": "middle", class: "lb sm" }, g, lab);
        }
        el("text", { x: cx, y: H - pb + 17, "text-anchor": "middle", class: "ax" }, svg, o.years[i]);
        strips.forEach((s, k) => {
          const sv = s.values[i];
          if (sv == null) return;
          el("text", { x: cx, y: H - pb + 36 + k * 18, "text-anchor": "middle", class: "st", style: `fill:${s.color ? s.color(sv) : "var(--ink-2)"}` }, svg, s.fmt(sv));
        });
        const hit = el("rect", { x: pl + bw * i, y: pt - 10, width: bw, height: H - pt - pb + 10, class: "hit" }, svg);
        hit.addEventListener("mousemove", ev => {
          hl(svg, [g]);
          const rows = [{ k: o.name || "Value", v: o.tip ? o.tip(v) : F.n(v), c: o.color }];
          strips.forEach(s => { if (s.values[i] != null) rows.push({ k: s.name, v: s.fmt(s.values[i]) }); });
          showTip(ev, o.years[i], rows);
        });
      });
      el("line", { x1: pl, x2: W - pr, y1: y(0), y2: y(0), class: "base" }, svg);
      strips.forEach((s, k) => {
        if (s.caption === false) return;
      });
      if (strips.length) {
        const cap = strips.map(s => s.name).join(" · ");
        el("text", { x: W / 2, y: H - 4, "text-anchor": "middle", class: "ax", style: "font-size:11px" }, svg, cap);
      }
    });
  }

  // ---------- 2. Stacked columns (absolute or 100%) ----------
  // o: {years, series:[{name,color,values}], percent, label(v,share), height, totalLabel}
  function stack(host, o) {
    mount(host, (node, W) => {
      const H = o.height || 250, pl = 8, pr = 8, pt = 22, pb = 26;
      const svg = svgRoot(node, W, H, o.aria);
      const n = o.years.length, bw = (W - pl - pr) / n;
      const tot = o.years.map((_, i) => o.series.reduce((a, s) => a + (s.values[i] || 0), 0));
      const max = o.percent ? 1 : niceMax(Math.max(...tot) * 1.06);
      const y = v => pt + (H - pt - pb) * (1 - v / max);
      if (!o.percent) ticks(0, max, 3).forEach(t => { if (t) el("line", { x1: pl, x2: W - pr, y1: y(t), y2: y(t), class: "gl" }, svg); });
      const w = Math.min(o.percent ? 56 : 46, bw * 0.66);
      o.years.forEach((yr, i) => {
        const cx = pl + bw * i + bw / 2;
        const g = el("g", { class: "mk" }, svg);
        let acc = 0;
        const segs = o.series.map(s => s.values[i] || 0);
        const T = o.percent ? tot[i] : 1;
        segs.forEach((v, k) => {
          const share = v / tot[i];
          const val = o.percent ? share : v;
          const y0 = y(acc), y1 = y(acc + val);
          acc += val;
          const top = k === segs.length - 1;
          const gap = k > 0 ? 1 : 0;
          if (top) el("path", { d: barPath(cx - w / 2, y0 - gap, w, y1), fill: o.series[k].color }, g);
          else el("rect", { x: cx - w / 2, y: y1, width: w, height: Math.max(0, y0 - y1 - gap), fill: o.series[k].color }, g);
          if (y0 - y1 >= 17 && o.label !== false) {
            const t = o.label ? o.label(v, share) : (o.percent ? F.n(share * 100, 0) : F.b(v));
            el("text", { x: cx, y: (y0 + y1) / 2 + 4, "text-anchor": "middle", class: "lb in sm" }, g, t);
          }
        });
        if (o.totalLabel) el("text", { x: cx, y: y(acc) - 6, "text-anchor": "middle", class: "lb sm" }, g, o.totalLabel(tot[i]));
        el("text", { x: cx, y: H - pb + 17, "text-anchor": "middle", class: "ax" }, svg, yr);
        const hit = el("rect", { x: pl + bw * i, y: pt - 10, width: bw, height: H - pt - pb + 10, class: "hit" }, svg);
        hit.addEventListener("mousemove", ev => {
          hl(svg, [g]);
          const rows = o.series.map((s, k) => ({ k: s.name, c: s.color, v: (o.tip ? o.tip(segs[k], segs[k] / tot[i]) : F.sar(segs[k])) })).reverse();
          if (!o.percent) rows.push({ k: "Total", v: o.tip ? o.tip(tot[i], 1) : F.sar(tot[i]) });
          showTip(ev, yr, rows);
        });
      });
      el("line", { x1: pl, x2: W - pr, y1: y(0), y2: y(0), class: "base" }, svg);
    });
  }

  // ---------- 3. Lines with direct end labels, crosshair read-out ----------
  // o: {years, series:[{name,color,values,dash,width,soft}], fmt, axisFmt, min, max, band:[i,j], height, endFmt}
  function lines(host, o) {
    mount(host, (node, W) => {
      const H = o.height || 240;
      const labW = o.endLabels === false ? 10 : (o.labW || 92);
      const pl = 40, pr = labW, pt = 16, pb = 26;
      const svg = svgRoot(node, W, H, o.aria);
      const all = o.series.flatMap(s => s.values).filter(v => v != null);
      let min = o.min != null ? o.min : Math.min(0, ...all);
      let max = o.max != null ? o.max : Math.max(...all);
      const pad = (max - min) * 0.08;
      if (o.max == null) max += pad;
      if (o.min == null && min < 0) min -= pad;
      const tk = ticks(min, max, 4);
      min = Math.min(min, tk[0]); max = Math.max(max, tk[tk.length - 1]);
      const n = o.years.length, iw = W - pl - pr;
      const x = i => pl + iw * (i / (n - 1));
      const y = v => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
      const af = o.axisFmt || o.fmt || F.n;
      tk.forEach(t => {
        el("line", { x1: pl, x2: W - pr + 4, y1: y(t), y2: y(t), class: t === 0 ? "base" : "gl" }, svg);
        el("text", { x: pl - 6, y: y(t) + 4, "text-anchor": "end", class: "ax" }, svg, af(t));
      });
      o.years.forEach((yr, i) => {
        if (n > 9 && i % 2) return;
        el("text", { x: x(i), y: H - 6, "text-anchor": "middle", class: "ax" }, svg, yr);
      });
      if (o.band) {
        // Fill between two series, green where the first is above, red where below.
        const [a, b] = o.band.map(k => o.series[k].values);
        const up = o.bandColor || "var(--brand-tint)", dn = "#f6d4d4";
        for (let i = 0; i < n - 1; i++) {
          const d0 = a[i] - b[i], d1 = a[i + 1] - b[i + 1];
          const P = (xx, yy) => xx + "," + yy;
          if (d0 * d1 >= 0) {
            el("path", { d: `M${P(x(i), y(a[i]))}L${P(x(i + 1), y(a[i + 1]))}L${P(x(i + 1), y(b[i + 1]))}L${P(x(i), y(b[i]))}Z`, fill: (d0 + d1) >= 0 ? up : dn, opacity: 0.85 }, svg);
          } else {
            const t = d0 / (d0 - d1), xc = x(i) + (x(i + 1) - x(i)) * t, vc = a[i] + (a[i + 1] - a[i]) * t;
            el("path", { d: `M${P(x(i), y(a[i]))}L${P(xc, y(vc))}L${P(x(i), y(b[i]))}Z`, fill: d0 >= 0 ? up : dn, opacity: 0.85 }, svg);
            el("path", { d: `M${P(xc, y(vc))}L${P(x(i + 1), y(a[i + 1]))}L${P(x(i + 1), y(b[i + 1]))}Z`, fill: d1 >= 0 ? up : dn, opacity: 0.85 }, svg);
          }
        }
      }
      const groups = o.series.map(s => {
        const g = el("g", { class: "mk" }, svg);
        let d = "", started = false;
        s.values.forEach((v, i) => { if (v == null) { started = false; return; } d += (started ? "L" : "M") + x(i) + "," + y(v); started = true; });
        el("path", { d, fill: "none", stroke: s.color, "stroke-width": s.width || 2.25, "stroke-dasharray": s.dash || null, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
        if (!s.dash) s.values.forEach((v, i) => { if (v != null && (i === n - 1 || o.dots)) el("circle", { cx: x(i), cy: y(v), r: 4, fill: s.color, stroke: "#fff", "stroke-width": 2 }, g); });
        return g;
      });
      // end labels, nudged apart
      if (o.endLabels !== false) {
        const ends = o.series.map((s, k) => ({ k, v: s.values[n - 1], y: y(s.values[n - 1]) })).filter(e => e.v != null).sort((a, b) => a.y - b.y);
        for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 26) ends[i].y = ends[i - 1].y + 26;
        ends.forEach(e => {
          const s = o.series[e.k];
          const g = groups[e.k];
          el("text", { x: W - pr + 10, y: e.y - 2, class: "lb sm" }, g, (o.endFmt || o.fmt || F.n)(e.v));
          el("text", { x: W - pr + 10, y: e.y + 11, class: "ax", style: "font-size:11px" }, g, s.name);
        });
      }
      // crosshair
      const cross = el("line", { y1: pt, y2: H - pb, class: "gl", style: "stroke:var(--axis);opacity:0", "stroke-dasharray": "3 3" }, svg);
      const hit = el("rect", { x: pl, y: pt, width: iw, height: H - pt - pb, class: "hit" }, svg);
      hit.addEventListener("mousemove", ev => {
        const r = svg.getBoundingClientRect();
        const px = (ev.clientX - r.left) * (W / r.width);
        const i = Math.max(0, Math.min(n - 1, Math.round((px - pl) / iw * (n - 1))));
        cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.style.opacity = 1;
        const rows = o.series.map(s => ({ k: s.name, c: s.color, v: (o.fmt || F.n)(s.values[i]) }));
        if (o.extraTip) rows.push(...o.extraTip(i));
        showTip(ev, o.years[i], rows);
      });
      hit.addEventListener("mouseleave", () => { cross.style.opacity = 0; });
    });
  }

  // ---------- 4. Grouped columns ----------
  // o: {years, series:[{name,color,values}], fmt, label(v), height}
  function grouped(host, o) {
    mount(host, (node, W) => {
      const H = o.height || 240, pl = 8, pr = 8, pt = 22, pb = 26;
      const svg = svgRoot(node, W, H, o.aria);
      const n = o.years.length, bw = (W - pl - pr) / n, k = o.series.length;
      const all = o.series.flatMap(s => s.values).filter(v => v != null);
      const max = niceMax(Math.max(...all) * 1.08);
      const minV = Math.min(0, ...all);
      const min = minV < 0 ? -niceMax(-minV * 1.15) : 0;
      const y = v => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
      ticks(min, max, 3).forEach(t => { if (t) el("line", { x1: pl, x2: W - pr, y1: y(t), y2: y(t), class: "gl" }, svg); });
      const gw = Math.min(64, bw * 0.78), w = (gw - (k - 1) * 2) / k;
      o.years.forEach((yr, i) => {
        const x0 = pl + bw * i + (bw - gw) / 2;
        const g = el("g", { class: "mk" }, svg);
        o.series.forEach((s, j) => {
          const v = s.values[i];
          if (v == null) return;
          const xx = x0 + j * (w + 2);
          el("path", { d: barPath(xx, y(0), w, y(v), 3), fill: s.color }, g);
          if ((o.labelLast && i === n - 1) || o.labelAll) el("text", { x: xx + w / 2, y: v >= 0 ? y(v) - 5 : y(v) + 13, "text-anchor": "middle", class: "lb sm" }, g, o.label ? o.label(v) : F.b(v));
        });
        el("text", { x: pl + bw * i + bw / 2, y: H - pb + 17, "text-anchor": "middle", class: "ax" }, svg, yr);
        const hit = el("rect", { x: pl + bw * i, y: pt - 10, width: bw, height: H - pt - pb + 10, class: "hit" }, svg);
        hit.addEventListener("mousemove", ev => {
          hl(svg, [g]);
          const rows = o.series.map(s => ({ k: s.name, c: s.color, v: (o.fmt || F.sar)(s.values[i]) }));
          if (o.extraTip) rows.push(...o.extraTip(i));
          showTip(ev, yr, rows);
        });
      });
      el("line", { x1: pl, x2: W - pr, y1: y(0), y2: y(0), class: "base" }, svg);
    });
  }

  // ---------- 5. Horizontal 100% split rows ("where each SAR 100 goes") ----------
  // o: {rows:[{label, parts:[{name,color,value}]}], fmt, height per row}
  function split(host, o) {
    mount(host, (node, W) => {
      const rh = o.rowH || 54, gapH = 32;
      const H = o.rows.length * (rh + gapH) + 4;
      const svg = svgRoot(node, W, H, o.aria);
      o.rows.forEach((r, ri) => {
        const y0 = ri * (rh + gapH) + 22;
        el("text", { x: 0, y: y0 - 8, class: "lb" }, svg, r.label);
        const tot = r.parts.reduce((a, p) => a + Math.max(0, p.value), 0);
        let x = 0;
        r.parts.forEach((p, k) => {
          const v = Math.max(0, p.value);
          const w = W * v / tot;
          const g = el("g", { class: "mk", "data-k": k }, svg);
          const rr = (k === 0 || k === r.parts.length - 1) ? 4 : 0;
          el("rect", { x: x + (k ? 1 : 0), y: y0, width: Math.max(0, w - (k ? 2 : 0)), height: rh, rx: rr, fill: p.color }, g);
          const txt = (o.fmt || (v => F.n(v, 1)))(p.value);
          if (w > txt.length * 7.2 + 10) el("text", { x: x + w / 2, y: y0 + rh / 2 + 4.5, "text-anchor": "middle", class: "lb in" }, g, txt);
          const hit = el("rect", { x, y: y0, width: w, height: rh, class: "hit" }, svg);
          hit.addEventListener("mousemove", ev => {
            hl(svg, [...svg.querySelectorAll(`g[data-k="${k}"]`)]);
            showTip(ev, p.name, o.rows.map(rw => ({ k: rw.label, v: (o.fmt || (v => F.n(v, 1)))(rw.parts[k].value) })));
          });
          x += w;
        });
      });
    });
  }

  // ---------- 6. Dumbbell: return vs cost per entity ----------
  // o: {items:[{name,color,a,b}], aName, bName, fmt}
  function dumbbell(host, o) {
    mount(host, (node, W) => {
      const rh = 46, pl = 76, pr = 64, pt = 26;
      const H = pt + o.items.length * rh + 16;
      const svg = svgRoot(node, W, H, o.aria);
      const all = o.items.flatMap(it => [it.a, it.b]);
      const max = niceMax(Math.max(...all) * 1.1), min = 0;
      const x = v => pl + (W - pl - pr) * (v - min) / (max - min);
      ticks(min, max, 4).forEach(t => {
        el("line", { x1: x(t), x2: x(t), y1: pt - 6, y2: H - 12, class: "gl" }, svg);
        el("text", { x: x(t), y: pt - 12, "text-anchor": "middle", class: "ax" }, svg, F.pct0(t));
      });
      o.items.forEach((it, i) => {
        const cy = pt + i * rh + rh / 2;
        const g = el("g", { class: "mk" }, svg);
        el("text", { x: 0, y: cy + 4, class: "lb" }, g, it.name);
        const good = it.a >= it.b;
        el("line", { x1: x(it.a), x2: x(it.b), y1: cy, y2: cy, stroke: good ? "var(--pos)" : "var(--neg)", "stroke-width": 4, "stroke-linecap": "round", opacity: 0.35 }, g);
        el("rect", { x: x(it.b) - 1.5, y: cy - 10, width: 3, height: 20, rx: 1.5, fill: "var(--ink-2)" }, g);
        el("circle", { cx: x(it.a), cy, r: 8, fill: it.color, stroke: "#fff", "stroke-width": 2 }, g);
        const d = it.a - it.b;
        el("text", { x: W - pr + 10, y: cy + 4, class: "lb", style: `fill:${good ? "var(--pos)" : "var(--neg)"}` }, g, F.pts(d));
        const hit = el("rect", { x: 0, y: cy - rh / 2, width: W, height: rh, class: "hit" }, svg);
        hit.addEventListener("mousemove", ev => {
          hl(svg, [g]);
          showTip(ev, it.name, [{ k: o.aName, v: F.pct(it.a), c: it.color }, { k: o.bName, v: F.pct(it.b) }, { k: "Spread", v: F.pts(d) }]);
        });
      });
    });
  }

  window.Charts = { F, bars, stack, lines, grouped, split, dumbbell, showTip, hideTip };
})();
