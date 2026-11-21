/* Shared engine for an industry infographic: the industry as one business,
   the companies side by side, then one company at a time. Reads
   window.SECTOR (written by redesign/sector_data.py inside the build).
   Every sentence that quotes a figure computes it here. Telecom keeps its
   own hand-tuned script; this one serves every other sector. */
(function () {
  const C = window.Charts, F = C.F, S = window.SECTOR;
  const Y = S.years, E = S.entities, N = Y.length, L = N - 1, P = L - 1;
  const CO = S.companies, I = E.industry;
  const $ = id => document.getElementById(id);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const IND = { c: css("--ind"), deep: css("--ind-deep"), soft: css("--ind-soft") };
  const nm = CO.length === 2 ? "both" : `all ${["", "", "two", "three", "four", "five", "six"][CO.length] || CO.length}`;

  // ---- color helpers: deep and soft tones of each company color ----
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (h, t, w) => "#" + hex(h).map((v, i) => Math.round(v + (hex(t)[i] - v) * w).toString(16).padStart(2, "0")).join("");
  CO.forEach(c => { c.deep = mix(c.c, "#000000", 0.38); c.soft = mix(c.c, "#ffffff", 0.6); });

  // ---- derived series ----
  const div = (a, b) => a.map((v, i) => (v == null || b[i] == null || !b[i]) ? null : v / b[i]);
  const growth = a => a.map((v, i) => i && a[i - 1] > 0 && v != null ? v / a[i - 1] - 1 : null);
  const cagr = a => { const i0 = a.findIndex(v => v > 0); return i0 < 0 || i0 === L ? null : Math.pow(a[L] / a[i0], 1 / (L - i0)) - 1; };
  const nz = v => v || 0;
  const capexCfg = S.capex || { key: "capex", pct: "capex_rev", title: "Capital expenditure",
    unit: "SAR billions, property, plant and equipment. Line under the years is % of revenue." };
  for (const k in E) {
    const e = E[k];
    e.gm = div(e.gross, e.revenue); e.em = div(e.ebitda, e.revenue); e.nm = div(e.np, e.revenue);
    e.g = growth(e.revenue);
    e.divs = e.div_paid.map(v => v == null ? 0 : -v);
    const cx = e[capexCfg.key] || [];
    e.capexp = cx.map(v => v == null ? null : Math.abs(v));
    e.capexpct = capexCfg.pct === "capex_rev" ? e.capex_rev : (e[capexCfg.pct] || []);
    e.debtshare = e.debt.map((d, i) => (d == null || e.equity[i] == null) ? null : d / (d + e.equity[i]));
  }
  // An industry operating total only counts years in which every company
  // that discloses the figure today also disclosed it then; otherwise a
  // company starting to report would show up as growth.
  (S.ops || []).flatMap(o => [o.key, o.strip && o.strip.key]).concat(S.kpi ? [S.kpi.key] : []).filter(Boolean).forEach(k => {
    if (!I[k]) return;
    const disc = CO.filter(c => E[c.key][k] && E[c.key][k][L] != null);
    I[k] = I[k].map((v, i) => disc.every(c => E[c.key][k][i] != null) ? v : null);
  });
  const bn = v => F.n(v / 1000);
  const money = v => "SAR " + F.sar(v);
  const tone = v => v >= 0 ? "var(--pos)" : "var(--neg)";
  const FMT = {
    pct: F.pct, pct0: F.pct0, k: v => F.n(v / 1000, 1) + "k", k1: v => F.n(v / 1000, 1),
    mt: v => F.n(v / 1e6, 2) + "m t", kt: v => F.n(v / 1000, 1) + "k t a day", sar0: v => "SAR " + F.int(v), x: F.x,
  };
  const listOf = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const best = (vals, dir = 1) => { let k = -1; vals.forEach((v, i) => { if (v != null && (k < 0 || dir * v > dir * vals[k])) k = i; }); return k; };
  const last = k => CO.map(c => E[c.key][k] ? E[c.key][k][L] : null);

  // ---- page scaffolding ----
  document.title = `${S.title} FY${Y[L]} | aismaeel research`;
  $("h-title").innerHTML = `${S.title} <em>/ FY ${Y[L]}</em>`;
  $("h-sub").textContent = `${listOf(CO.map(c => `${c.name} (${c.ticker})`))}, added together and side by side. ` +
    `Year ended 31 December ${Y[L]} against ${Y[P]}. SAR unless stated.`;
  $("crumb").textContent = S.short;
  const card = (id, title, note, extra = "") =>
    `<div class="card${extra}"><h3>${title}</h3><p class="find" id="f-${id}"></p><div class="chart" id="c-${id}"></div>${note ? `<p class="note">${note}</p>` : ""}<div class="legend" id="l-${id}"></div></div>`;
  const legend = (id, items) => { const n = $("l-" + id); if (n) n.innerHTML = items.map(([c, t, cls]) => `<span><i class="${cls || ""}" style="background:${c}"></i>${t}</span>`).join(""); };

  const ops = (S.ops || []);
  const hasVal = I.ev_ebitda.filter(v => v != null).length >= 2;
  const p1 = [
    card("rev", "Revenue and growth", "SAR billions. Line under the years is growth on the prior year."),
    card("mrg", "Margins", "% of revenue. Net margin is on profit from continuing operations."),
    card("100", "Where each SAR 100 of revenue goes", ""),
    ...(ops[0] ? [card("op0", ops[0].title, ops[0].unit)] : []),
  ];
  const p1b = [
    card("roic", "Return on capital against its cost", "Shaded green where ROIC beats WACC (dashed), red where it falls short."),
    card("capex", capexCfg.title, capexCfg.unit),
    card("fcf", "Free cash flow and what was paid out", "SAR billions."),
    card("cap", "Capital structure", "SAR billions, book values. Labels are each part's share."),
    ...(ops[1] ? [card("op1", ops[1].title, ops[1].unit)] : []),
    ...(hasVal ? [card("val", "What the market pays", "Enterprise value to EBITDA at year end, for years in which every company was listed. Line under the years is P/E.")] : []),
  ];
  if (p1b.length % 2) p1b[p1b.length - 1] = p1b[p1b.length - 1].replace('class="card"', 'class="card wide"');
  if (p1.length % 2) p1[p1.length - 1] = p1[p1.length - 1].replace('class="card"', 'class="card wide"');

  const p2 = [
    card("share", "Who takes the revenue", "% of the companies' combined revenue."),
    card("roicco", "Return on invested capital", "Dashed line is the industry."),
    card("db", `Return against cost of capital, FY${Y[L]}`, ""),
    card("ebm", "EBITDA margin", "% of revenue."),
    card("cxi", capexCfg.title === "Capital expenditure" ? "Capital spending intensity" : capexCfg.title + ", against revenue", "% of revenue."),
    ...(S.compare_line ? [card("cl", S.compare_line.title, S.compare_line.unit)] : []),
    card("evco", "What the market pays", "EV / EBITDA at year end, from each listing."),
    card("cash", `Cash in, cash out, FY${Y[L]}`, "SAR millions."),
  ];
  if (p2.length % 2) p2[p2.length - 1] = p2[p2.length - 1].replace('class="card"', 'class="card wide"');

  $("app").innerHTML = `
  <section class="part" id="industry">
    <div class="parth"><div><div class="num">PART 1</div><h2>The industry, <em>as one business</em></h2>
      <p>${CO.length} companies added together. No company names until Part 2.</p></div></div>
    <div class="kpis" id="ind-kpis"></div>
    <div class="grid">${p1.join("")}</div>
    <h3 class="subh">Capital, returns and <em>what the market paid</em></h3>
    <p class="subp">What the business ties up, what it earns on it, and what it hands back.</p>
    <div class="grid">${p1b.join("")}</div>
    <p class="know" id="know"></p>
    <div class="takes" id="takes"></div>
  </section>
  <section class="part" id="compare">
    <div class="parth"><div><div class="num">PART 2</div><h2>Side by side, <em>who leads on what</em></h2>
      <p>The same measures for each company. FY${Y[L]} first, then how the gaps opened.</p></div>
      <div class="legend" style="margin:0">${CO.map(c => `<span><i style="background:${c.c}"></i>${c.name}</span>`).join("")}</div></div>
    <div class="board" id="board"></div>
    <div class="grid" style="margin-top:14px">${p2.join("")}</div>
  </section>
  <section class="part" id="company">
    <div class="parth"><div><div class="num">PART 3</div><h2>One company, <em>${N} years</em></h2>
      <p>Pick a company. Every chart below redraws for it.</p></div></div>
    <div class="cotabs" role="tablist" id="cotabs"></div>
    <div id="cobody"></div>
  </section>`;

  // ---- KPI tiles ----
  function kpis(host, e, color) {
    const d = (a, b) => (a == null || !b) ? null : a / b - 1;
    const npB = Math.abs(e.np[L]) >= 1000;
    const tiles = [
      { l: "Revenue", v: Math.abs(e.revenue[L]) >= 1000 ? bn(e.revenue[L]) : F.n(e.revenue[L]), u: Math.abs(e.revenue[L]) >= 1000 ? "SAR B" : "SAR M", dv: d(e.revenue[L], e.revenue[P]), kind: "pct" },
      { l: "EBITDA", v: Math.abs(e.ebitda[L]) >= 1000 ? bn(e.ebitda[L]) : F.n(e.ebitda[L]), u: Math.abs(e.ebitda[L]) >= 1000 ? "SAR B" : "SAR M", dv: d(e.ebitda[L], e.ebitda[P]), kind: "pct" },
      { l: "Net profit", v: npB ? bn(e.np[L]) : F.n(e.np[L]), u: npB ? "SAR B" : "SAR M", dv: e.np[P] > 0 ? d(e.np[L], e.np[P]) : null, kind: "pct" },
      { l: "EBITDA margin", v: F.n(e.em[L] * 100), u: "%", dv: e.em[L] - e.em[P], kind: "pts" },
      { l: "ROIC", v: F.n(e.roic[L] * 100), u: "%", dv: e.roic[L] - e.wacc[L], kind: "spread" },
    ];
    if (S.kpi && e[S.kpi.key] && e[S.kpi.key][L] != null) {
      const k = S.kpi, v = e[k.key][L];
      const [num, unit] = k.fmt === "mt" ? [F.n(v / 1e6, 2), "m tons"] : k.fmt === "k" ? [F.n(v / 1000, 1), "k"] : [F.n(v), ""];
      tiles.push({ l: k.l, v: num, u: unit, dv: d(v, e[k.key][P]), kind: "pct" });
    }
    host.innerHTML = tiles.map(t => {
      const cls = t.dv == null || Math.abs(t.dv) < 0.0005 ? "flat" : t.dv > 0 ? "up" : "dn";
      const txt = t.dv == null ? "n/m" : t.kind === "pct" ? F.spct(t.dv) : t.kind === "pts" ? F.pts(t.dv) : `${F.pts(t.dv)} <span>over WACC</span>`;
      return `<div class="kpi"${color ? ` style="border-top-color:${color}"` : ""}><div class="l">${t.l}</div>
        <div class="v">${t.v}<small>${t.u}</small></div><div class="d ${cls}">${txt}</div></div>`;
    }).join("");
  }

  // ---- shared chart builders (industry and company use the same ones) ----
  const T = { // tones
    ind: { color: IND.soft, deep: IND.c, line: IND.c, dk: IND.deep, soft: IND.soft },
  };
  function revenue(id, e, t) {
    C.bars("#c-" + id, { years: Y, values: e.revenue.map(v => v == null ? null : v / 1000), color: t.soft, deep: t.line, name: "Revenue",
      label: v => F.n(v, v < 10 ? 2 : 1), tip: v => "SAR " + F.n(v, 2) + "B",
      strips: [{ name: "Growth", values: e.g, fmt: v => F.spct(v), color: v => tone(v) }] });
  }
  function margins(id, e, t) {
    C.lines("#c-" + id, { years: Y, fmt: F.pct, axisFmt: F.pct0, min: Math.min(0, ...e.nm.filter(v => v != null)),
      series: [{ name: "Gross", color: t.soft, values: e.gm, width: 2.5 }, { name: "EBITDA", color: t.line, values: e.em, width: 2.5 },
        { name: "Net", color: t.dk, values: e.nm, width: 2.5 }] });
  }
  function roic(id, e, t) {
    C.lines("#c-" + id, { years: Y, fmt: F.pct, axisFmt: F.pct0, min: 0, band: [0, 1], bandColor: t === T.ind ? undefined : t.soft,
      series: [{ name: "ROIC", color: t.line, values: e.roic, width: 2.5 }, { name: "WACC", color: "#6f878c", values: e.wacc, width: 2, dash: "5 4" }],
      extraTip: i => [{ k: "Spread", v: F.pts(e.roic[i] - e.wacc[i]) }] });
  }
  function capex(id, e, t) {
    C.bars("#c-" + id, { years: Y, values: e.capexp.map(v => v == null ? null : v / 1000), color: t.soft, deep: t.line, name: capexCfg.title,
      label: v => F.n(v, v < 1 ? 2 : 1), tip: v => "SAR " + F.n(v * 1000, 0) + "M",
      strips: [{ name: "% of revenue", values: e.capexpct, fmt: v => F.pct(v, 0), color: () => "var(--ink-2)" }] });
  }
  function fcf(id, e, t) {
    C.grouped("#c-" + id, { years: Y, fmt: v => money(v), labelLast: true, label: v => F.n(v / 1000, Math.abs(v) < 1000 ? 2 : 1),
      series: [{ name: "Free cash flow", color: t.soft, values: e.fcf }, { name: "Dividends paid", color: t.dk, values: e.divs }] });
    legend(id, [[t.soft, "Free cash flow"], [t.dk, "Dividends paid"]]);
  }
  function op(id, e, t, o) {
    if (!o || !e[o.key] || e[o.key].every(v => v == null)) return false;
    const i0 = Math.max(0, e[o.key].findIndex(v => v != null));   // start at the first reported year
    C.bars("#c-" + id, { years: Y.slice(i0), values: e[o.key].slice(i0).map(v => v == null ? null : v * o.scale), color: t.soft, deep: t.line, name: o.title,
      label: v => F.n(v, v < 10 ? 1 : 0), tip: v => FMT[o.fmt](v / o.scale),
      strips: o.strip && e[o.strip.key] ? [{ name: o.strip.name, values: e[o.strip.key].slice(i0), fmt: v => FMT[o.strip.fmt](v), color: () => "var(--ink-2)" }] : [] });
    return true;
  }
  function mixChart(id, e, t) {
    const parts = S.mix.parts;
    const ok = Y.map((_, i) => parts.every(([k]) => e[k] && e[k][i] != null));
    const yrs = Y.filter((_, i) => ok[i]);
    if (yrs.length < 2) return null;
    const tones = [t.dk, t.line, t.soft];
    C.stack("#c-" + id, { years: yrs, percent: true,
      series: parts.map(([k, n], j) => ({ name: n, color: tones[j % 3], values: e[k].filter((_, i) => ok[i]) })),
      label: (v, s) => F.n(s * 100, 0), tip: (v, s) => F.pct(s, 0) + " · " + money(v) });
    legend(id, parts.map(([k, n], j) => [tones[j % 3], n]));
    const i0 = ok.indexOf(true), sh = (k, i) => e[k][i] / parts.reduce((a, [kk]) => a + nz(e[kk][i]), 0);
    return { i0, sh };
  }
  function valuation(id, e, t) {
    C.bars("#c-" + id, { years: Y, values: e.ev_ebitda, color: t.soft, deep: t.line, name: "EV / EBITDA",
      label: v => F.n(v, 1) + "x", tip: v => F.x(v),
      strips: [{ name: "P/E", values: e.pe, fmt: v => v > 100 ? "n/m" : F.n(v, 0) + "x", color: () => "var(--ink-2)" }] });
  }

  // ================= PART 1 =================
  kpis($("ind-kpis"), I);
  const gs = I.g.slice(1).filter(v => v != null);
  const gAvg = gs.slice(0, -1).reduce((a, b) => a + b, 0) / Math.max(1, gs.length - 1);
  $("f-rev").innerHTML = `Revenue has compounded <b>${F.pct(cagr(I.revenue))}</b> a year since ${Y[0]}. ` +
    `${Y[L]} growth of ${F.pct(I.g[L])} was ${I.g[L] > gAvg + 0.01 ? "faster than" : I.g[L] < gAvg - 0.01 ? "slower than" : "in line with"} the ${F.pct(gAvg, 0)} average of the years before.`;
  revenue("rev", I, T.ind);

  const emD = I.em[L] - I.em[0];
  $("f-mrg").innerHTML = `EBITDA margin is <b>${F.pct(I.em[L])}</b>, ` +
    (Math.abs(emD) < 0.005 ? `about where it was in ${Y[0]}.` : `${emD > 0 ? "up" : "down"} from ${F.pct(I.em[0])} in ${Y[0]}.`) +
    ` Net margin ${F.pct(I.nm[L])}.`;
  margins("mrg", I, T.ind);

  const per100 = i => {
    const r = I.revenue[i], s = v => v / r * 100;
    const below = I.ebit[i] - I.np[i];
    return [
      { name: "Cost of revenue", color: "#4f666b", value: s(I.cor[i]) },
      { name: "Operating costs", color: "#7d9499", value: s(I.gross[i] - I.ebitda[i]) },
      { name: "Depreciation and amortization", color: "#a8b9bc", value: s(I.ebitda[i] - I.ebit[i]) },
      { name: below >= 0 ? "Finance, other items, zakat and tax" : "Net other income", color: "#d3dddf", value: s(below) },
      { name: "Net profit", color: IND.c, value: s(I.np[i]) },
    ];
  };
  const a100 = per100(P), b100 = per100(L);
  const moved = [0, 1, 2, 3].map(k => b100[k].value - a100[k].value);
  const mk = best(moved.map((m, k) => k === 3 && b100[3].value < 0 ? 0 : Math.abs(m)));
  const lbl = ["cost of revenue", "operating costs", "depreciation", "items below operating profit"][mk];
  $("f-100").innerHTML = `Net profit kept <b>SAR ${F.n(b100[4].value, 1)}</b> of every 100, against ${F.n(a100[4].value, 1)} in ${Y[P]}. ` +
    `The biggest move was ${lbl}, ${moved[mk] > 0 ? "up" : "down"} from SAR ${F.n(a100[mk].value, 1)} to ${F.n(b100[mk].value, 1)}.`;
  const otherInc = b100[3].value < 0;
  if (otherInc) $("f-100").innerHTML += ` Other income added SAR ${F.n(-b100[3].value, 1)} per 100 on top of operating profit.`;
  const keep = k => !(a100[k].value <= 0 && b100[k].value <= 0);
  C.split("#c-100", { rows: [{ label: "FY " + Y[P], parts: a100.filter((_, k) => keep(k)) }, { label: "FY " + Y[L], parts: b100.filter((_, k) => keep(k)) }] });
  legend("100", b100.filter((_, k) => keep(k)).map(p => [p.color, p.name.replace("Depreciation and amortization", "D&amp;A").replace("Finance, other items, zakat and tax", "Finance, other, zakat")]));

  const missing = key => CO.filter(c => !E[c.key][key] || E[c.key][key][L] == null).map(c => c.name);
  ops.forEach((o, j) => {
    if (!$("c-op" + j)) return;
    op("op" + j, I, T.ind, o);
    const v = I[o.key], i0 = v.findIndex(x => x != null);
    const miss = missing(o.key);
    let txt = i0 >= 0 && i0 < L ? `From ${FMT[o.fmt](v[i0])} in ${Y[i0]} to <b>${FMT[o.fmt](v[L])}</b> in ${Y[L]}.` : `<b>${FMT[o.fmt](v[L])}</b> in ${Y[L]}.`;
    if (o.strip && I[o.strip.key] && I[o.strip.key][L] != null) {
      const sv = I[o.strip.key], s0 = sv.findIndex(x => x != null);
      txt += ` ${o.strip.name.split(",")[0]}: ${FMT[o.strip.fmt](sv[L])}${o.strip.fmt.startsWith("k") ? "k" : ""}` +
        (s0 >= 0 && s0 < L ? `, against ${FMT[o.strip.fmt](sv[s0])}${o.strip.fmt.startsWith("k") ? "k" : ""} in ${Y[s0]}.` : ".");
    }
    if (miss.length) txt += ` ${o.title} excludes ${listOf(miss)}, which ${miss.length > 1 ? "do" : "does"} not disclose it.`;
    $("f-op" + j).innerHTML = txt;
  });

  const spread = I.roic.map((r, i) => r - I.wacc[i]);
  const above = spread.filter(s => s > 0).length;
  $("f-roic").innerHTML = `ROIC is <b>${F.pct(I.roic[L])}</b> against the cost of capital of ${F.pct(I.wacc[L])}, a spread of ${F.pts(spread[L])}. ` +
    (above === N ? `Above its cost every year since ${Y[0]}.` : above === 0 ? `Below its cost every year since ${Y[0]}.` : `Above its cost in ${above} of ${N} years.`);
  roic("roic", I, T.ind);

  const cxMax = Math.max(...I.capexpct.filter(v => v != null));
  $("f-capex").innerHTML = `<b>SAR ${F.sar(I.capexp[L])}</b> in ${Y[L]}, ${F.pct(I.capexpct[L])} of revenue. ` +
    (I.capexpct[L] >= cxMax - 0.001 ? `The highest share in the series.` : `The peak was ${F.pct(cxMax, cxMax < 0.1 ? 1 : 0)} in ${Y[I.capexpct.indexOf(cxMax)]}.`);
  capex("capex", I, T.ind);

  const fcfL = I.fcf[L], dvL = I.divs[L];
  $("f-fcf").innerHTML = fcfL <= 0
    ? `Free cash flow was <b>${money(fcfL)}</b> in ${Y[L]}, so the ${money(dvL)} paid in dividends was funded from elsewhere.`
    : `Dividends paid of <b>${money(dvL)}</b> were ${dvL > fcfL ? F.n(dvL / fcfL, 1) + " times" : F.pct(dvL / fcfL, 0) + " of"} free cash flow in ${Y[L]}.` +
      ` Over ${N} years, ${money(I.fcf.reduce((a, b) => a + nz(b), 0))} of free cash flow and ${money(I.divs.reduce((a, b) => a + b, 0))} paid out.`;
  fcf("fcf", I, T.ind);

  $("f-cap").innerHTML = `Debt is <b>${F.pct(I.debtshare[L], 0)}</b> of book capital, against ${F.pct(I.debtshare[0], 0)} in ${Y[0]}. ` +
    (I.int_cover[L] != null ? `Interest is covered ${F.n(I.int_cover[L], 1)} times.` : "");
  C.stack("#c-cap", { years: Y, totalLabel: v => F.n(v / 1000, 1),
    series: [{ name: "Interest-bearing debt", color: IND.deep, values: I.debt }, { name: "Book equity", color: IND.soft, values: I.equity }],
    label: (v, s) => F.pct(s, 0), tip: (v, s) => money(v) + (s < 1 ? ` (${F.pct(s, 0)})` : "") });
  legend("cap", [[IND.deep, "Interest-bearing debt"], [IND.soft, "Book equity"]]);

  if (hasVal) {
    const v0 = I.ev_ebitda.findIndex(v => v != null);
    $("f-val").innerHTML = `<b>${F.x(I.ev_ebitda[L])}</b> EBITDA and ${F.x(I.pe[L])} earnings at the ${Y[L]} close` +
      (v0 < L ? `, against ${F.x(I.ev_ebitda[v0])} in ${Y[v0]}, the first year all ${CO.length} were listed.` : ".");
    valuation("val", I, T.ind);
  }

  // what to know first
  const notes = [];
  if (S.dropped.length) notes.push(`Industry figures start in ${Y[0]}, the first year ${nm} companies report, so a company joining the cohort never shows up as growth.`);
  const late = CO.filter(c => c.listedYear > Y[0]);
  if (late.length) {
    const byYear = [...new Set(late.map(c => c.listedYear))].sort().map(y => `${listOf(late.filter(c => c.listedYear === y).map(c => c.name))} in ${y}`);
    notes.push(`Not every company has been listed since ${Y[0]}: ${listOf(byYear)}. Valuation figures start from each listing.`);
  }
  const disc = [P, L].filter(i => I.np_total[i] != null && Math.abs(I.np_total[i] - I.np[i]) > Math.abs(I.np[i]) * 0.02);
  if (disc.length) notes.push(`Net profit is from continuing operations; reported profit in FY${Y[disc[0]]} differs by ${money(I.np_total[disc[0]] - I.np[disc[0]])}.`);
  if (S.capex) notes.push(`Vehicles are bought through operating cash flow, so free cash flow is already after the fleet purchases shown under capital.`);
  $("know").innerHTML = notes.length ? `<b>${notes.length === 1 ? "One thing" : ["", "", "Two things", "Three things", "Four things"][notes.length]} to know first.</b> ${notes.join(" ")}` : "";
  if (!notes.length) $("know").remove();

  const good = [], bad = [];
  (I.g[L] >= gAvg - 0.01 ? good : bad).push(I.g[L] >= gAvg - 0.01
    ? ["Growth held up", `Revenue grew ${F.pct(I.g[L])} in ${Y[L]}, against an average of ${F.pct(gAvg, 0)} before it.`]
    : ["Growth slowed", `Revenue grew ${F.pct(I.g[L])} in ${Y[L]}, against an average of ${F.pct(gAvg, 0)} before it.`]);
  (spread[L] > 0 ? good : bad).push(spread[L] > 0
    ? ["Earns above its cost", `ROIC of ${F.pct(I.roic[L])} beats the cost of capital of ${F.pct(I.wacc[L])} by ${F.n(spread[L] * 100)} points.`]
    : ["Earns below its cost", `ROIC of ${F.pct(I.roic[L])} falls short of the cost of capital of ${F.pct(I.wacc[L])}.`]);
  if (Math.abs(spread[L] - spread[0]) > 0.01)
    (spread[L] > spread[0] ? good : bad).push(spread[L] > spread[0]
      ? ["The spread widened", `ROIC less WACC went from ${F.pts(spread[0])} in ${Y[0]} to ${F.pts(spread[L])}.`]
      : ["The spread narrowed", `ROIC less WACC went from ${F.pts(spread[0])} in ${Y[0]} to ${F.pts(spread[L])}.`]);
  if (Math.abs(emD) > 0.01)
    (emD > 0 ? good : bad).push(emD > 0 ? ["Margins widened", `EBITDA margin rose from ${F.pct(I.em[0])} to ${F.pct(I.em[L])}.`]
      : ["Margins thinned", `EBITDA margin fell from ${F.pct(I.em[0])} to ${F.pct(I.em[L])}.`]);
  if (fcfL <= 0) bad.push(["No free cash after investment", `Free cash flow was ${money(fcfL)} in ${Y[L]}.`]);
  else if (dvL > fcfL) bad.push(["Payouts outran cash", `Dividends paid were ${F.n(dvL / fcfL, 1)} times free cash flow.`]);
  else if (dvL > 0) good.push(["Dividends are covered", `Dividends took ${F.pct(dvL / fcfL, 0)} of free cash flow.`]);
  if (I.debtshare[L] - I.debtshare[0] > 0.1) bad.push(["Leaning on debt", `Debt rose from ${F.pct(I.debtshare[0], 0)} to ${F.pct(I.debtshare[L], 0)} of book capital.`]);
  else if (I.debtshare[L] < 0.35) good.push(["Light balance sheet", `Debt is ${F.pct(I.debtshare[L], 0)} of book capital.`]);
  $("takes").innerHTML = [...good.slice(0, 3).map(t => ["good", ...t]), ...bad.slice(0, 3).map(t => ["bad", ...t])]
    .map(([k, h, p]) => `<div class="take ${k === "bad" ? "bad" : ""}"><h4>${h}</h4><p>${p}</p></div>`).join("");

  // ================= PART 2 =================
  const boardDef = [
    { h: "Revenue", k: "revenue", f: money },
    { h: "EBITDA margin", k: "em", f: F.pct },
    { h: "Net margin", k: "nm", f: F.pct },
    { h: "ROIC", k: "roic", f: F.pct },
    { h: "Free cash flow", k: "fcf", f: money },
    { h: "EV / EBITDA", k: "ev_ebitda", f: F.x },
    ...(S.board || []).map(b => ({ h: b.h, k: b.key, f: FMT[b.fmt] })),
  ].slice(0, 8);
  $("board").innerHTML = boardDef.map(b => {
    const vals = last(b.k), mx = Math.max(...vals.map(v => Math.abs(v || 0))) || 1;
    return `<div class="mini"><h4>${b.h}</h4>` + CO.map((c, i) =>
      `<div class="row"><span class="nm">${c.name}</span><span class="bar"><i style="width:${vals[i] == null ? 0 : Math.max(2, Math.abs(vals[i]) / mx * 100)}%;background:${vals[i] < 0 ? "var(--neg)" : c.c}"></i></span><b>${vals[i] == null ? "n/a" : b.f(vals[i])}</b></div>`).join("") + `</div>`;
  }).join("");

  const shares = CO.map(c => E[c.key].revenue.map((v, i) => v / I.revenue[i]));
  const gain = shares.map(s => s[L] - s[0]);
  const lead = best(shares.map(s => s[L])), gk = best(gain), gainers = gain.filter(g => g > 0.001).length;
  $("f-share").innerHTML = `${CO[lead].name} takes <b>${F.pct(shares[lead][L], 0)}</b> of revenue. ` +
    (gain[gk] > 0.001 ? `${CO[gk].name} ${gainers === 1 ? "is the only one to gain" : "gained most"} since ${Y[0]}, ${F.pts(gain[gk])}.` : `Shares have barely moved since ${Y[0]}.`);
  C.stack("#c-share", { years: Y, percent: true, height: 260, series: CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].revenue })),
    tip: (v, s) => F.pct(s) + " · " + money(v) });

  const rL = last("roic"), rTop = best(rL), rBot = best(rL, -1);
  const rChg = CO.map(c => E[c.key].roic[L] - E[c.key].roic[0]), rMv = best(rChg.map(Math.abs));
  $("f-roicco").innerHTML = `${CO[rTop].name} earns the most, <b>${F.pct(rL[rTop])}</b>; ${CO[rBot].name} the least, ${F.pct(rL[rBot])}. ` +
    `${CO[rMv].name} moved most since ${Y[0]}, from ${F.pct(E[CO[rMv].key].roic[0])}.`;
  C.lines("#c-roicco", { years: Y, fmt: F.pct, axisFmt: F.pct0, min: 0,
    series: [...CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].roic })), { name: "Industry", color: "#6f878c", values: I.roic, dash: "5 4", width: 1.75 }] });

  const items = CO.map(c => ({ name: c.name, color: c.c, a: E[c.key].roic[L], b: E[c.key].wacc[L] }));
  const ab = items.filter(it => it.a >= it.b), be = items.filter(it => it.a < it.b);
  $("f-db").innerHTML = !be.length ? `All ${CO.length} earn above their cost of capital. ${items[best(items.map(i => i.a - i.b))].name} has the widest spread, <b>${F.pts(Math.max(...items.map(i => i.a - i.b)))}</b>.`
    : !ab.length ? `None of the ${CO.length} earns its cost of capital.`
    : `${listOf(ab.map(i => i.name))} earn${ab.length === 1 ? "s" : ""} above ${ab.length === 1 ? "its" : "their"} cost of capital; <b>${listOf(be.map(i => i.name))}</b> ${be.length === 1 ? "does" : "do"} not.`;
  C.dumbbell("#c-db", { items, aName: "ROIC", bName: "WACC" });
  legend("db", [["var(--ink-3)", "ROIC"], ["var(--ink-2)", "WACC"]]);

  const emL = last("em"), eTop = best(emL), eBot = best(emL, -1);
  $("f-ebm").innerHTML = `${CO[eTop].name} has the highest margin at <b>${F.pct(emL[eTop])}</b>, ${CO[eBot].name} the lowest at ${F.pct(emL[eBot])}.`;
  C.lines("#c-ebm", { years: Y, fmt: F.pct, axisFmt: F.pct0, series: CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].em })) });

  const cxL = last("capexpct"), cTop = best(cxL), cBot = best(cxL, -1);
  $("f-cxi").innerHTML = `${CO[cTop].name} spent the most against revenue in ${Y[L]}, <b>${F.pct(cxL[cTop])}</b>; ${CO[cBot].name} the least, ${F.pct(cxL[cBot])}.`;
  C.lines("#c-cxi", { years: Y, fmt: F.pct, axisFmt: F.pct0, min: 0, series: CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].capexpct })) });

  if (S.compare_line && $("c-cl")) {
    const k = S.compare_line.key, vL = last(k), t = best(vL), b = best(vL, -1);
    $("f-cl").innerHTML = vL.every(v => v == null) ? "" : `${CO[t].name} is highest at <b>${FMT[S.compare_line.fmt](vL[t])}</b>, ${CO[b].name} lowest at ${FMT[S.compare_line.fmt](vL[b])}.` +
      (vL.some(v => v == null) ? ` ${listOf(CO.filter((c, i) => vL[i] == null).map(c => c.name))} does not disclose it.` : "");
    C.lines("#c-cl", { years: Y, fmt: FMT[S.compare_line.fmt], axisFmt: S.compare_line.fmt.startsWith("pct") ? F.pct0 : v => F.n(v / 1000, 0) + "k", min: 0, series: CO.map(c => ({ name: c.name, color: c.c, values: E[c.key][k] || [] })) });
  }

  const evL = last("ev_ebitda"), vT = best(evL), vB = best(evL, -1);
  $("f-evco").innerHTML = `${CO[vT].name} trades at the highest multiple, <b>${F.x(evL[vT])}</b> EBITDA; ${CO[vB].name} the lowest, ${F.x(evL[vB])}.`;
  C.lines("#c-evco", { years: Y, fmt: F.x, axisFmt: v => F.n(v, v % 1 ? 1 : 0) + "x", min: 0, series: CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].ev_ebitda })) });

  const pays = CO.map(c => ({ c, f: E[c.key].fcf[L], d: E[c.key].divs[L] }));
  const negF = pays.filter(p => p.f <= 0 && p.d > 0), over = pays.filter(p => p.f > 0 && p.d > p.f), none = pays.filter(p => !p.d);
  const parts = [];
  if (negF.length) parts.push(`${listOf(negF.map(p => p.c.name))} paid dividends with negative free cash flow`);
  if (over.length) parts.push(`${listOf(over.map(p => p.c.name))} paid out more than ${over.length > 1 ? "they" : "it"} generated`);
  if (none.length) parts.push(`${listOf(none.map(p => p.c.name))} paid nothing`);
  const cov = pays.filter(p => p.f > 0 && p.d > 0 && p.d <= p.f);
  if (cov.length) parts.push(`${listOf(cov.map((p, i) => `${p.c.name}${i ? "" : " paid"} ${F.pct(p.d / p.f, 0)}`))} of free cash flow`);
  $("f-cash").innerHTML = parts.length ? parts.join("; ") + "." : "";
  C.grouped("#c-cash", { years: CO.map(c => c.name), fmt: money, labelAll: true, label: v => F.n(v, 0), height: 230,
    series: [{ name: "Free cash flow", color: "#a9bcc0", values: pays.map(p => p.f) }, { name: "Dividends paid", color: "#33484c", values: pays.map(p => p.d) }],
    extraTip: i => pays[i].f > 0 ? [{ k: "Paid out", v: F.pct(pays[i].d / pays[i].f, 0) + " of FCF" }] : [] });
  legend("cash", [["#a9bcc0", "Free cash flow"], ["#33484c", "Dividends paid"]]);

  // ================= PART 3 =================
  const tabs = $("cotabs"), body = $("cobody");
  tabs.innerHTML = CO.map(c => `<button class="cotab" role="tab" data-k="${c.key}" style="--c:${c.c}"><span class="dot" style="background:${c.c}"></span>${c.name}</button>`).join("");

  function company(key) {
    const c = CO.find(x => x.key === key), e = E[key], t = { soft: c.soft, line: c.c, dk: c.deep };
    $("company").style.setProperty("--c", c.c);
    const hasMix = S.mix && S.mix.parts.every(([k]) => e[k] && e[k].some(v => v != null));
    const cards = [
      card("crev", "Revenue and growth", "SAR billions. Line under the years is growth on the prior year."),
      card("cmrg", "Margins", "% of revenue."),
      card("croic", "Return on capital against its cost", "Shaded green where ROIC beats WACC (dashed), red where it falls short."),
      ...(hasMix ? [card("cmix", S.mix.title, "% of revenue.")] : []),
      ...ops.map((o, j) => e[o.key] && e[o.key].some(v => v != null) ? card("cop" + j, o.title, o.unit) : "").filter(Boolean),
      card("cfcf", "Free cash flow and dividends", "SAR billions."),
      card("ccx", capexCfg.title, capexCfg.unit),
      card("cval", "Valuation", `EV / EBITDA at year end, from listing in ${c.listedYear}. Line under the years is P/E.`),
    ];
    if (cards.length % 2) cards[cards.length - 1] = cards[cards.length - 1].replace('class="card"', 'class="card wide"');
    body.innerHTML = `
      <div class="cohead"><div><h3>${c.full}</h3>
        <div class="meta"><b>${c.ticker}</b> · Listed ${c.listed} · ${F.pct(e.revenue[L] / I.revenue[L], 0)} of industry revenue` +
        (e.mcap[L] != null ? ` · market value ${money(e.mcap[L])}` : "") + `</div></div></div>
      <div class="kpis" id="co-kpis"></div><div class="grid">${cards.join("")}</div>`;
    kpis($("co-kpis"), e, c.c);

    const cg = cagr(e.revenue);
    $("f-crev").innerHTML = `${cg == null ? "" : `Up <b>${F.pct(cg)}</b> a year since ${Y[0]}; `}${F.spct(e.g[L])} in ${Y[L]} against ${F.spct(I.g[L])} for the industry.`;
    revenue("crev", e, t);
    const d = e.em[L] - e.em[0];
    $("f-cmrg").innerHTML = `EBITDA margin <b>${F.pct(e.em[L])}</b>, ` + (Math.abs(d) < 0.005 ? `about where it was in ${Y[0]}.` : `against ${F.pct(e.em[0])} in ${Y[0]}.`) +
      ` Net margin ${F.pct(e.nm[L])}, from ${F.pct(e.nm[0])}.`;
    margins("cmrg", e, t);
    const sp = e.roic[L] - e.wacc[L], ya = e.roic.filter((r, i) => r > e.wacc[i]).length;
    $("f-croic").innerHTML = `ROIC <b>${F.pct(e.roic[L])}</b> against the cost of capital of ${F.pct(e.wacc[L])}: ${F.pts(sp)}. ` +
      (ya === 0 ? `Below its cost every year since ${Y[0]}.` : ya === N ? `Above its cost every year since ${Y[0]}.` : `Above its cost in ${ya} of ${N} years.`);
    roic("croic", e, t);
    if (hasMix) {
      const m = mixChart("cmix", e, t);
      if (m) {
        const [k0, n0] = S.mix.parts[0];
        $("f-cmix").innerHTML = `${n0} is <b>${F.pct(m.sh(k0, L), 0)}</b> of revenue` + (m.i0 < L ? `, against ${F.pct(m.sh(k0, m.i0), 0)} in ${Y[m.i0]}.` : ".");
      }
    }
    ops.forEach((o, j) => {
      if (!$("c-cop" + j)) return;
      op("cop" + j, e, t, o);
      const v = e[o.key], i0 = v.findIndex(x => x != null), shr = I[o.key] && I[o.key][L] && v[L] != null && !o.strip ? null : null;
      $("f-cop" + j).innerHTML = v[L] == null ? `Not disclosed for ${Y[L]}.` :
        (i0 < L ? `From ${FMT[o.fmt](v[i0])} in ${Y[i0]} to <b>${FMT[o.fmt](v[L])}</b>.` : `<b>${FMT[o.fmt](v[L])}</b> in ${Y[L]}.`) +
        (o.strip && e[o.strip.key] && e[o.strip.key][L] != null ? ` ${o.strip.name.split(",")[0]}: ${FMT[o.strip.fmt](e[o.strip.key][L])}${o.strip.fmt.startsWith("k") ? "k" : ""}.` : "");
    });
    const cum = a => a.reduce((x, y) => x + nz(y), 0);
    $("f-cfcf").innerHTML = `Since ${Y[0]}: <b>${money(cum(e.fcf))}</b> of free cash flow, ${money(cum(e.divs))} paid in dividends.` +
      (e.fcf[L] > 0 && e.divs[L] > 0 ? ` In ${Y[L]}, ${F.pct(e.divs[L] / e.fcf[L], 0)} of it went out.` : e.fcf[L] <= 0 ? ` Free cash flow was negative in ${Y[L]}.` : "");
    fcf("cfcf", e, t);
    $("f-ccx").innerHTML = `<b>${money(e.capexp[L])}</b> in ${Y[L]}, ${F.pct(e.capexpct[L])} of revenue. The industry spent ${F.pct(I.capexpct[L])}.`;
    capex("ccx", e, t);
    $("f-cval").innerHTML = e.ev_ebitda[L] == null ? "Not listed long enough to show." :
      `<b>${F.x(e.ev_ebitda[L])}</b> EBITDA and ${F.x(e.pe[L])} earnings at the ${Y[L]} close` + (I.ev_ebitda[L] != null ? `. The industry trades at ${F.x(I.ev_ebitda[L])} EBITDA.` : ".");
    valuation("cval", e, t);
  }

  function select(k) {
    tabs.querySelectorAll(".cotab").forEach(x => x.setAttribute("aria-selected", x.dataset.k === k));
    company(k);
  }
  tabs.addEventListener("click", ev => {
    const b = ev.target.closest(".cotab");
    if (!b) return;
    select(b.dataset.k);
    history.replaceState(null, "", "#company-" + b.dataset.k);
  });
  const fromHash = (location.hash.match(/^#company-([\w-]+)/) || [])[1];
  select(CO.some(c => c.key === fromHash) ? fromHash : CO[0].key);
  if (fromHash) $("company").scrollIntoView();

  const tierLinks = [...document.querySelectorAll(".tier")];
  const partsEl = ["industry", "compare", "company"].map(id => $(id));
  const onScroll = () => {
    const y = window.scrollY + 160;
    let on = 0;
    partsEl.forEach((p, i) => { if (p.offsetTop <= y) on = i; });
    tierLinks.forEach((a, i) => a.classList.toggle("on", i === on));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
