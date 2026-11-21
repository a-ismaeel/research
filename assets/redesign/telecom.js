/* Telecom deep dive: wires workbook data into the three tiers.
   Every sentence that carries a number computes it here, so the copy cannot
   drift from the workbook when the model is restated. */
(function () {
  const C = window.Charts, F = C.F;
  const D = window.TELECOM, Y = D.years, E = D.entities;
  const L = Y.length - 1, P = L - 1;            // latest, prior year index
  const $ = id => document.getElementById(id);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  const CO = [
    { key: "stc", name: "stc", full: "Saudi Telecom Company", ticker: "7010", listed: "Jan 2003",
      c: css("--stc"), deep: "#0f5e52", soft: "#a3d8ce" },
    { key: "mobily", name: "Mobily", full: "Etihad Etisalat Company", ticker: "7020", listed: "Dec 2004",
      c: css("--mobily"), deep: "#8f4d06", soft: "#f5c88c" },
    { key: "zain", name: "Zain KSA", full: "Mobile Telecommunication Company Saudi Arabia", ticker: "7030", listed: "Jul 2008",
      c: css("--zain"), deep: "#3535a3", soft: "#c3c3f2" },
  ];
  const IND = { c: css("--ind"), deep: css("--ind-deep"), soft: css("--ind-soft") };

  // ---- derived series ----
  const div = (a, b) => a.map((v, i) => (v == null || !b[i]) ? null : v / b[i]);
  const growth = a => a.map((v, i) => i && a[i - 1] ? v / a[i - 1] - 1 : null);
  const cagr = (a, i0 = 0, i1 = a.length - 1) => Math.pow(a[i1] / a[i0], 1 / (i1 - i0)) - 1;
  const neg = a => a.map(v => v == null ? null : -v);
  for (const k in E) {
    const e = E[k];
    e.gm = div(e.gross, e.revenue);
    e.em = div(e.ebitda, e.revenue);
    e.nm = div(e.np, e.revenue);
    e.g = growth(e.revenue);
    e.divs = neg(e.div_paid).map(v => v || 0);
    e.capexp = neg(e.capex);
    e.debtshare = e.debt.map((d, i) => d / (d + e.equity[i]));
  }
  const I = E.industry;
  const bn = v => F.n(v / 1000);
  const tone = v => v >= 0 ? "var(--pos)" : "var(--neg)";

  // ---- KPI tiles ----
  function kpis(host, e, color) {
    const d = (a, b) => a / b - 1;
    const tiles = [
      { l: "Revenue", v: bn(e.revenue[L]), u: "SAR B", dv: d(e.revenue[L], e.revenue[P]), kind: "pct" },
      { l: "EBITDA", v: bn(e.ebitda[L]), u: "SAR B", dv: d(e.ebitda[L], e.ebitda[P]), kind: "pct" },
      { l: "Net profit", v: e.np[L] >= 1000 ? bn(e.np[L]) : F.n(e.np[L]), u: e.np[L] >= 1000 ? "SAR B" : "SAR M", dv: d(e.np[L], e.np[P]), kind: "pct" },
      { l: "EBITDA margin", v: F.n(e.em[L] * 100), u: "%", dv: e.em[L] - e.em[P], kind: "pts" },
      { l: "ROIC", v: F.n(e.roic[L] * 100), u: "%", dv: e.roic[L] - e.wacc[L], kind: "spread" },
      { l: "Mobile subs", v: F.n(e.subs[L] / 1e6), u: "m", dv: d(e.subs[L], e.subs[P]), kind: "pct" },
    ];
    host.innerHTML = tiles.map(t => {
      const cls = Math.abs(t.dv) < 0.0005 ? "flat" : t.dv > 0 ? "up" : "dn";
      const txt = t.kind === "pct" ? F.spct(t.dv) : t.kind === "pts" ? F.pts(t.dv)
        : `${F.pts(t.dv)} <span>over WACC</span>`;
      return `<div class="kpi"${color ? ` style="border-top-color:${color}"` : ""}><div class="l">${t.l}</div>
        <div class="v">${t.v}<small>${t.u}</small></div><div class="d ${cls}">${txt}</div></div>`;
    }).join("");
  }

  // ================= PART 1: INDUSTRY =================
  kpis($("ind-kpis"), I);

  const gMin = Math.min(...I.g.slice(1));
  $("f-rev").innerHTML = `Revenue has compounded <b>${F.pct(cagr(I.revenue))}</b> a year since ${Y[0]}. ` +
    `${Y[L]} growth of ${F.pct(I.g[L])} was the ${I.g[L] === gMin ? "slowest since " + Y[0] : "latest"}.`;
  C.bars("#c-rev", {
    years: Y, values: I.revenue.map(v => v / 1000), color: IND.soft, deep: IND.c, name: "Revenue",
    label: v => F.n(v), tip: v => "SAR " + F.n(v) + "B",
    strips: [{ name: "Growth", values: I.g, fmt: v => F.spct(v), color: v => v < 0.045 ? "var(--neg)" : "var(--ind)" }],
  });

  $("f-mrg").innerHTML = `EBITDA margin is <b>${F.pct(I.em[L])}</b>, down from ${F.pct(I.em[0])} in ${Y[0]}. ` +
    `Cost of revenue took ${F.pct(I.cor[L] / I.revenue[L], 0)} of sales, from ${F.pct(I.cor[0] / I.revenue[0], 0)}.`;
  C.lines("#c-mrg", {
    years: Y, fmt: F.pct, axisFmt: F.pct0, min: 0, labW: 96,
    series: [
      { name: "Gross", color: IND.soft, values: I.gm, width: 2.5 },
      { name: "EBITDA", color: IND.c, values: I.em, width: 2.5 },
      { name: "Net", color: IND.deep, values: I.nm, width: 2.5 },
    ],
  });

  // Where SAR 100 goes
  const per100 = i => {
    const r = I.revenue[i], s = v => v / r * 100;
    return [
      { name: "Cost of revenue", color: "#4f666b", value: s(I.cor[i]) },
      { name: "Operating costs", color: "#7d9499", value: s(I.employee[i] + I.marketing[i] + I.ga[i]) },
      { name: "Depreciation and amortization", color: "#a8b9bc", value: s(I.dep[i] + I.amort[i]) },
      { name: "Finance, other items, zakat and tax", color: "#d3dddf", value: s(I.interest[i] + I.int_income[i] + I.other_exp[i] + I.tax[i] + I.zakat[i]) },
      { name: "Net profit", color: IND.c, value: s(I.np[i]) },
    ];
  };
  const p24 = per100(P), p25 = per100(L);
  $("f-100").innerHTML = `Net profit kept <b>SAR ${F.n(p25[4].value, 1)}</b> of every 100, up from ${F.n(p24[4].value, 1)}. ` +
    `The gain came from below operating profit: other items fell from SAR ${F.n(p24[3].value, 1)} to ${F.n(p25[3].value, 1)}.`;
  C.split("#c-100", { rows: [{ label: "FY " + Y[P], parts: p24 }, { label: "FY " + Y[L], parts: p25 }] });
  $("l-100").innerHTML = p25.map(p => `<span><i style="background:${p.color}"></i>${p.name.replace("Depreciation and amortization", "D&amp;A").replace("Finance, other items, zakat and tax", "Finance, other, zakat")}</span>`).join("");

  let arpuFalls = 0;
  for (let i = L; i > 0 && I.arpu[i] < I.arpu[i - 1]; i--) arpuFalls++;
  $("f-subs").innerHTML = `Subscribers are up <b>${F.pct(I.subs[L] / I.subs[0] - 1, 0)}</b> since ${Y[0]}, to ${F.n(I.subs[L] / 1e6)}m. ` +
    `Revenue per subscriber has fallen ${arpuFalls} years running, to SAR ${F.int(I.arpu[L])}.`;
  C.bars("#c-subs", {
    years: Y, values: I.subs.map(v => v / 1e6), color: IND.soft, deep: IND.c, name: "Subscribers",
    label: v => F.n(v), tip: v => F.n(v) + "m",
    strips: [{ name: "Retail revenue per subscriber, SAR", values: I.arpu, fmt: v => F.n(v, 0), color: (v) => "var(--ink-2)" }],
  });

  const spread = I.roic.map((r, i) => r - I.wacc[i]);
  const iW = I.wacc.indexOf(Math.min(...I.wacc));
  $("f-roic").innerHTML = `ROIC has held between ${F.pct(Math.min(...I.roic))} and ${F.pct(Math.max(...I.roic))} for eight years. ` +
    `The cost of capital rose from ${F.pct(I.wacc[iW])} in ${Y[iW]} to <b>${F.pct(I.wacc[L])}</b>, so the spread narrowed from ${F.n(spread[iW] * 100)} to ${F.n(spread[L] * 100)} points.`;
  C.lines("#c-roic", {
    years: Y, fmt: F.pct, axisFmt: F.pct0, min: 0, band: [0, 1],
    series: [
      { name: "ROIC", color: IND.c, values: I.roic, width: 2.5 },
      { name: "WACC", color: "#6f878c", values: I.wacc, width: 2, dash: "5 4" },
    ],
    extraTip: i => [{ k: "Spread", v: F.pts(spread[i]) }],
  });

  const maxCx = Math.max(...I.capex_rev);
  $("f-capex").innerHTML = `Spending is <b>SAR ${bn(I.capexp[L])}B</b>, near its high in riyals, but ${F.pct(I.capex_rev[L])} of revenue is well below the ${F.pct(maxCx, 0)} of the ${Y[I.capex_rev.indexOf(maxCx)]} build.`;
  C.bars("#c-capex", {
    years: Y, values: I.capexp.map(v => v / 1000), color: IND.soft, deep: IND.c, name: "Capex",
    label: v => F.n(v), tip: v => "SAR " + F.n(v) + "B",
    strips: [{ name: "% of revenue", values: I.capex_rev, fmt: v => F.pct(v, 0), color: () => "var(--ink-2)" }],
  });

  $("f-fcf").innerHTML = `Dividends paid of <b>SAR ${bn(I.divs[L])}B</b> were ${F.n(I.divs[L] / I.fcf[L], 1)} times free cash flow in ${Y[L]}. ` +
    `In ${Y[P]} they were ${F.pct(I.divs[P] / I.fcf[P], 0)} of it.`;
  C.grouped("#c-fcf", {
    years: Y, fmt: v => F.sarFull(v), labelLast: true, label: v => F.b(v),
    series: [{ name: "Free cash flow", color: IND.soft, values: I.fcf }, { name: "Dividends paid", color: IND.deep, values: I.divs }],
  });

  $("f-val").innerHTML = `The market pays <b>${F.x(I.ev_ebitda[L])}</b> EBITDA against ${F.x(I.ev_ebitda[0])} in ${Y[0]}, ` +
    `for a return on capital that barely moved (${F.pct(I.roic[0])} then, ${F.pct(I.roic[L])} now).`;
  C.bars("#c-val", {
    years: Y, values: I.ev_ebitda, color: IND.soft, deep: IND.c, name: "EV / EBITDA",
    label: v => F.n(v, 1) + "x", tip: v => F.x(v),
    strips: [{ name: "ROIC", values: I.roic, fmt: v => F.pct(v), color: () => "var(--ind)" }],
  });

  $("f-5g").innerHTML = `From ${F.int(I.g5_sites[0])} sites in ${Y[0]} to <b>${F.n(I.g5_sites[L] / 1000)}k</b>. ` +
    `5G now reaches ${F.pct(I.g5_cov[L], 0)} of the population; 4G reaches ${F.pct(I.g4_cov[L], 0)}.`;
  C.bars("#c-5g", {
    years: Y, values: I.g5_sites.map(v => v / 1000), color: IND.soft, deep: IND.c, name: "5G sites",
    label: v => F.n(v, 1), tip: v => F.n(v, 1) + "k sites",
    strips: [{ name: "5G coverage", values: I.g5_cov, fmt: v => F.pct(v, 0), color: () => "var(--ind)" }],
  });

  $("f-cap").innerHTML = `Debt is <b>${F.pct(I.debtshare[L], 0)}</b> of book capital, close to where it was in ${Y[0]}, ` +
    `and interest is covered ${F.n(I.int_cover[L], 0)} times. The balance sheet is not the constraint.`;
  C.stack("#c-cap", {
    years: Y, totalLabel: v => F.b(v),
    series: [{ name: "Interest-bearing debt", color: IND.deep, values: I.debt }, { name: "Book equity", color: IND.soft, values: I.equity }],
    label: (v, s) => F.pct(s, 0), tip: (v, s) => F.sarFull(v) + (s < 1 ? ` (${F.pct(s, 0)})` : ""),
  });

  const discont = I.np_total[P] - I.np[P];
  const otherDrop = I.other_exp[P] - I.other_exp[L];
  $("know").innerHTML = `<b>Two things to know first.</b> Net profit here is from continuing operations. ` +
    `FY${Y[P]} reported profit of SAR ${bn(I.np_total[P])}B includes SAR ${bn(discont)}B from discontinued operations at stc, left out so the years compare. ` +
    `Profit rose ${F.pct(I.np[L] / I.np[P] - 1)} mostly because other expenses fell by SAR ${bn(otherDrop)}B, not because the operating business improved: EBITDA rose ${F.pct(I.ebitda[L] / I.ebitda[P] - 1)}.`;

  const takes = [
    ["good", "Returns are steady", `ROIC sat between ${F.pct(Math.min(...I.roic))} and ${F.pct(Math.max(...I.roic))} every year since ${Y[0]}, always above the cost of capital.`],
    ["good", "Light balance sheet", `Debt is ${F.pct(I.debtshare[L], 0)} of book capital and interest is covered ${F.n(I.int_cover[L], 0)} times.`],
    ["good", "The network is mostly built", `5G reaches ${F.pct(I.g5_cov[L], 0)} of the population, and capex is ${F.pct(I.capex_rev[L], 0)} of revenue against ${F.pct(maxCx, 0)} at the peak.`],
    ["bad", "Growth slowed", `Revenue grew ${F.pct(I.g[L])} in ${Y[L]}, the slowest year since ${Y[0]}, while revenue per subscriber fell again.`],
    ["bad", "Payouts outran cash", `Dividends paid were ${F.n(I.divs[L] / I.fcf[L], 1)} times free cash flow. That cannot repeat without debt or asset sales.`],
    ["bad", "Margins drift lower", `EBITDA margin fell from ${F.pct(I.em[0])} to ${F.pct(I.em[L])} as low-margin device sales grew.`],
  ];
  $("takes").innerHTML = takes.map(([k, h, p]) => `<div class="take ${k === "bad" ? "bad" : ""}"><h4>${h}</h4><p>${p}</p></div>`).join("");

  // ================= PART 2: COMPARE =================
  const last = (k, i = L) => CO.map(c => E[c.key][k][i]);
  const board = [
    { h: "Revenue", k: "revenue", f: v => "SAR " + F.sar(v) },
    { h: "EBITDA margin", k: "em", f: F.pct },
    { h: "Net margin", k: "nm", f: F.pct },
    { h: "ROIC", k: "roic", f: F.pct },
    { h: "Free cash flow", k: "fcf", f: v => "SAR " + F.sar(v) },
    { h: "Mobile subscribers", k: "subs", f: v => F.n(v / 1e6) + "m" },
    { h: "Revenue per subscriber", k: "arpu", f: v => "SAR " + F.int(v) },
    { h: "EV / EBITDA", k: "ev_ebitda", f: F.x },
  ];
  $("board").innerHTML = board.map(b => {
    const vals = last(b.k), mx = Math.max(...vals.map(Math.abs));
    return `<div class="mini"><h4>${b.h}</h4>` + CO.map((c, i) =>
      `<div class="row"><span class="nm">${c.name}</span><span class="bar"><i style="width:${Math.max(2, Math.abs(vals[i]) / mx * 100)}%;background:${c.c}"></i></span><b>${b.f(vals[i])}</b></div>`).join("") + `</div>`;
  }).join("");

  const shares = CO.map(c => E[c.key].revenue.map((v, i) => v / I.revenue[i]));
  const gain = CO.map((c, k) => shares[k][L] - shares[k][0]);
  const gk = gain.indexOf(Math.max(...gain));
  $("f-share").innerHTML = `stc takes <b>${F.pct(shares[0][L], 0)}</b> of revenue. ${CO[gk].name} is the only one to gain share since ${Y[0]}, ${F.pts(gain[gk])}.`;
  C.stack("#c-share", {
    years: Y, percent: true, height: 260,
    series: CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].revenue })),
    tip: (v, s) => F.pct(s) + " · SAR " + F.sar(v),
  });

  const subsSh = CO.map(c => E[c.key].subs[L] / I.subs[L]);
  $("f-mix").innerHTML = `stc books <b>${F.pct(shares[0][L], 0)}</b> of revenue with ${F.pct(subsSh[0], 0)} of mobile subscribers. ` +
    `Mobily and Zain KSA serve ${F.pct(subsSh[1] + subsSh[2], 0)} of subscribers for ${F.pct(shares[1][L] + shares[2][L], 0)} of revenue.`;
  C.split("#c-mix", {
    rowH: 40, fmt: v => F.n(v, 0) + "%",
    rows: [
      { label: "Revenue", parts: CO.map((c, k) => ({ name: c.name, color: c.c, value: shares[k][L] * 100 })) },
      { label: "Mobile subscribers", parts: CO.map((c, k) => ({ name: c.name, color: c.c, value: subsSh[k] * 100 })) },
    ],
  });

  const m = E.mobily, s = E.stc;
  $("f-roicco").innerHTML = `Mobily went from <b>${F.pct(m.roic[0])} to ${F.pct(m.roic[L])}</b>, closing most of the gap to stc, ` +
    `whose return fell from ${F.pct(s.roic[0])} to ${F.pct(s.roic[L])}. Zain KSA has stayed under ${F.pct(Math.ceil(Math.max(...E.zain.roic) * 100) / 100, 0)}.`;
  C.lines("#c-roicco", {
    years: Y, fmt: F.pct, axisFmt: F.pct0, min: 0,
    series: [...CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].roic })),
      { name: "Industry", color: "#6f878c", values: I.roic, dash: "5 4", width: 1.75 }],
  });

  const items = CO.map(c => ({ name: c.name, color: c.c, a: E[c.key].roic[L], b: E[c.key].wacc[L] }));
  const below = items.filter(it => it.a < it.b);
  $("f-db").innerHTML = below.length
    ? `${items.filter(it => it.a >= it.b).map(it => it.name).join(" and ")} earn above their cost of capital. <b>${below.map(it => it.name).join(", ")}</b> earns ${F.n((below[0].b - below[0].a) * 100)} points below it.`
    : `All three earn above their cost of capital.`;
  C.dumbbell("#c-db", { items, aName: "ROIC", bName: "WACC" });

  const emL = CO.map(c => E[c.key].em[L]);
  const lo = emL.indexOf(Math.min(...emL));
  $("f-ebm").innerHTML = `${CO[lo].name}${lo === 0 ? ", the largest," : ""} has the lowest margin at <b>${F.pct(emL[lo])}</b>, down from ${F.pct(E[CO[lo].key].em[0])} in ${Y[0]}.`;
  C.lines("#c-ebm", {
    years: Y, fmt: F.pct, axisFmt: F.pct0, min: 0.2,
    series: CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].em })),
  });

  const z = E.zain;
  $("f-cxi").innerHTML = `Zain KSA cut capital spending to <b>${F.pct(z.capex_rev[L])}</b> of revenue in ${Y[L]}, from ${F.pct(z.capex_rev[0], 0)} in ${Y[0]}. ` +
    `stc and Mobily still spend ${F.pct(s.capex_rev[L], 0)} and ${F.pct(m.capex_rev[L], 0)}.`;
  C.lines("#c-cxi", {
    years: Y, fmt: F.pct, axisFmt: F.pct0, min: 0,
    series: CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].capex_rev })),
  });

  $("f-evco").innerHTML = `stc re-rated from <b>${F.x(s.ev_ebitda[0])} to ${F.x(s.ev_ebitda[L])}</b>. Mobily, with the steepest ROIC gain, rose only to ${F.x(m.ev_ebitda[L])}; Zain KSA trades at ${F.x(z.ev_ebitda[L])}.`;
  C.lines("#c-evco", {
    years: Y, fmt: F.x, axisFmt: v => F.n(v, v % 1 ? 1 : 0) + "x", min: 0,
    series: CO.map(c => ({ name: c.name, color: c.c, values: E[c.key].ev_ebitda })),
  });

  const cover = CO.map(c => E[c.key].divs[L] / E[c.key].fcf[L]);
  $("f-cash").innerHTML = `stc paid out <b>${F.n(cover[0], 1)} times</b> its free cash flow. Mobily paid ${F.pct(cover[1], 0)} of it and Zain KSA ${F.pct(cover[2], 0)}.`;
  C.grouped("#c-cash", {
    years: CO.map(c => c.name), fmt: v => F.sarFull(v), labelAll: true, label: v => F.b(v), height: 230,
    series: [{ name: "Free cash flow", color: "#a9bcc0", values: CO.map(c => E[c.key].fcf[L]) },
      { name: "Dividends paid", color: "#33484c", values: CO.map(c => E[c.key].divs[L]) }],
    extraTip: i => [{ k: "Paid out", v: F.pct(cover[i], 0) + " of FCF" }],
  });

  // ================= PART 3: COMPANY =================
  const tabs = $("cotabs"), body = $("cobody");
  tabs.innerHTML = CO.map((c, i) => `<button class="cotab" role="tab" aria-selected="${i === 0}" data-k="${c.key}" style="--c:${c.c}"><span class="dot" style="background:${c.c}"></span>${c.name}</button>`).join("");

  function company(key) {
    const c = CO.find(x => x.key === key), e = E[key];
    document.getElementById("company").style.setProperty("--c", c.c);
    const shareL = e.revenue[L] / I.revenue[L];
    body.innerHTML = `
      <div class="cohead"><div><h3>${c.full}</h3>
        <div class="meta"><b>${c.ticker}</b> · Listed ${c.listed} · ${F.pct(shareL, 0)} of industry revenue · market value SAR ${F.sar(e.mcap[L])}</div></div></div>
      <div class="kpis" id="co-kpis"></div>
      <div class="grid">
        <div class="card"><h3>Revenue and growth</h3><p class="find" id="cf-rev"></p><div class="chart" id="cc-rev"></div>
          <p class="note">SAR billions. Line under the years is growth on the prior year.</p></div>
        <div class="card"><h3>Margins</h3><p class="find" id="cf-mrg"></p><div class="chart" id="cc-mrg"></div>
          <p class="note">% of revenue.</p></div>
        <div class="card"><h3>Return on capital against its cost</h3><p class="find" id="cf-roic"></p><div class="chart" id="cc-roic"></div>
          <p class="note">Shaded green where ROIC beats WACC (dashed), red where it falls short.</p></div>
        <div class="card"><h3>Revenue by customer</h3><p class="find" id="cf-seg"></p><div class="chart" id="cc-seg"></div>
          <div class="legend"><span><i style="background:${c.deep}"></i>Retail</span><span><i style="background:${c.c}"></i>Enterprise</span><span><i style="background:${c.soft}"></i>Wholesale</span></div></div>
        <div class="card"><h3>Subscribers and what they pay</h3><p class="find" id="cf-subs"></p><div class="chart" id="cc-subs"></div>
          <p class="note">Mobile subscribers, millions. Line under the years is retail revenue per subscriber, SAR.</p></div>
        <div class="card"><h3>Free cash flow and dividends</h3><p class="find" id="cf-fcf"></p><div class="chart" id="cc-fcf"></div>
          <div class="legend"><span><i style="background:${c.soft}"></i>Free cash flow</span><span><i style="background:${c.deep}"></i>Dividends paid</span></div></div>
        <div class="card"><h3>Capital expenditure</h3><p class="find" id="cf-cx"></p><div class="chart" id="cc-cx"></div>
          <p class="note">SAR billions. Line under the years is % of revenue.</p></div>
        <div class="card"><h3>Valuation</h3><p class="find" id="cf-val"></p><div class="chart" id="cc-val"></div>
          <p class="note">EV / EBITDA at year end. Line under the years is P/E.</p></div>
      </div>`;
    kpis($("co-kpis"), e, c.c);
    const gk = { color: c.soft, deep: c.c };

    $("cf-rev").innerHTML = `Up <b>${F.pct(cagr(e.revenue))}</b> a year since ${Y[0]}; ${F.spct(e.g[L])} in ${Y[L]} against ${F.spct(I.g[L])} for the industry.`;
    C.bars("#cc-rev", { years: Y, values: e.revenue.map(v => v / 1000), ...gk, name: "Revenue", label: v => F.n(v), tip: v => "SAR " + F.n(v) + "B",
      strips: [{ name: "Growth", values: e.g, fmt: v => F.spct(v), color: v => tone(v) }] });

    $("cf-mrg").innerHTML = `EBITDA margin <b>${F.pct(e.em[L])}</b>, ` +
      (Math.abs(e.em[L] - e.em[0]) < 0.005 ? `about where it was in ${Y[0]}.` : `against ${F.pct(e.em[0])} in ${Y[0]}.`) +
      ` Net margin ${F.pct(e.nm[L])}, from ${F.pct(e.nm[0])}.`;
    C.lines("#cc-mrg", { years: Y, fmt: F.pct, axisFmt: F.pct0, min: Math.min(0, ...e.nm),
      series: [{ name: "Gross", color: c.soft, values: e.gm, width: 2.5 }, { name: "EBITDA", color: c.c, values: e.em, width: 2.5 }, { name: "Net", color: c.deep, values: e.nm, width: 2.5 }] });

    const sp = e.roic[L] - e.wacc[L];
    const yrsAbove = e.roic.filter((r, i) => r > e.wacc[i]).length;
    $("cf-roic").innerHTML = `ROIC <b>${F.pct(e.roic[L])}</b> against a ${F.pct(e.wacc[L])} cost of capital: ${F.pts(sp)}. ` + (yrsAbove === 0 ? `Below its cost in every year since ${Y[0]}.` : yrsAbove === Y.length ? `Above its cost in every year since ${Y[0]}.` : `Above its cost in ${yrsAbove} of ${Y.length} years.`);
    C.lines("#cc-roic", { years: Y, fmt: F.pct, axisFmt: F.pct0, min: 0, band: [0, 1], bandColor: c.soft,
      series: [{ name: "ROIC", color: c.c, values: e.roic, width: 2.5 }, { name: "WACC", color: "#6f878c", values: e.wacc, width: 2, dash: "5 4" }],
      extraTip: i => [{ k: "Spread", v: F.pts(e.roic[i] - e.wacc[i]) }] });

    const segT = i => e.retail[i] + e.enterprise[i] + e.wholesale[i];
    const entSh = e.enterprise.map((v, i) => v / segT(i));
    $("cf-seg").innerHTML = `Retail is <b>${F.pct(e.retail[L] / segT(L), 0)}</b> of reported segment revenue. Enterprise went from ${F.pct(entSh[0], 0)} to ${F.pct(entSh[L], 0)}.`;
    C.stack("#cc-seg", { years: Y, percent: true,
      series: [{ name: "Retail", color: c.deep, values: e.retail }, { name: "Enterprise", color: c.c, values: e.enterprise }, { name: "Wholesale", color: c.soft, values: e.wholesale }],
      label: (v, s) => F.n(s * 100, 0), tip: (v, s) => F.pct(s, 0) + " · SAR " + F.sar(v) });

    $("cf-subs").innerHTML = `<b>${F.n(e.subs[L] / 1e6)}m</b> subscribers, ${F.spct(e.subs[L] / e.subs[P] - 1)} on the year. Each paid SAR ${F.int(e.arpu[L])} in retail revenue, ${F.spct(e.arpu[L] / e.arpu[P] - 1)}.`;
    C.bars("#cc-subs", { years: Y, values: e.subs.map(v => v / 1e6), ...gk, name: "Subscribers", label: v => F.n(v), tip: v => F.n(v) + "m",
      strips: [{ name: "Retail revenue per subscriber, SAR", values: e.arpu, fmt: v => F.n(v, 0), color: () => "var(--ink-2)" }] });

    const cum = (a) => a.reduce((x, y) => x + (y || 0), 0);
    $("cf-fcf").innerHTML = `Since ${Y[0]}: <b>SAR ${F.sar(cum(e.fcf))}</b> of free cash flow, SAR ${F.sar(cum(e.divs))} paid in dividends. In ${Y[L]}, ${F.pct(e.divs[L] / e.fcf[L], 0)} of it went out.`;
    C.grouped("#cc-fcf", { years: Y, fmt: v => F.sarFull(v), labelLast: true, label: v => F.b(v),
      series: [{ name: "Free cash flow", color: c.soft, values: e.fcf }, { name: "Dividends paid", color: c.deep, values: e.divs }] });

    $("cf-cx").innerHTML = `<b>SAR ${F.sar(e.capexp[L])}</b> in ${Y[L]}, ${F.pct(e.capex_rev[L])} of revenue. The industry spent ${F.pct(I.capex_rev[L])}.`;
    C.bars("#cc-cx", { years: Y, values: e.capexp.map(v => v / 1000), ...gk, name: "Capex", label: v => F.n(v, v < 10 ? 1 : 0), tip: v => "SAR " + F.n(v, 1) + "B",
      strips: [{ name: "% of revenue", values: e.capex_rev, fmt: v => F.pct(v, 0), color: () => "var(--ink-2)" }] });

    $("cf-val").innerHTML = `<b>${F.x(e.ev_ebitda[L])}</b> EBITDA and ${F.x(e.pe[L])} earnings at the ${Y[L]} close. The industry trades at ${F.x(I.ev_ebitda[L])} EBITDA.`;
    C.bars("#cc-val", { years: Y, values: e.ev_ebitda, ...gk, name: "EV / EBITDA", label: v => F.n(v, 1) + "x", tip: v => F.x(v),
      strips: [{ name: "P/E", values: e.pe, fmt: v => v < 0 || v > 100 ? "n/m" : F.n(v, 0) + "x", color: () => "var(--ink-2)" }] });
  }

  tabs.addEventListener("click", ev => {
    const b = ev.target.closest(".cotab");
    if (!b) return;
    tabs.querySelectorAll(".cotab").forEach(x => x.setAttribute("aria-selected", x === b));
    company(b.dataset.k);
    history.replaceState(null, "", "#company-" + b.dataset.k);
  });
  const fromHash = (location.hash.match(/^#company-(\w+)/) || [])[1];
  const startKey = CO.some(c => c.key === fromHash) ? fromHash : "stc";
  tabs.querySelectorAll(".cotab").forEach(x => x.setAttribute("aria-selected", x.dataset.k === startKey));
  company(startKey);
  if (fromHash) document.getElementById("company").scrollIntoView();

  // tier highlight on scroll
  const tierLinks = [...document.querySelectorAll(".tier")];
  const parts = ["industry", "compare", "company"].map(id => document.getElementById(id));
  const obs = new IntersectionObserver(() => {
    const y = window.scrollY + 160;
    let on = 0;
    parts.forEach((p, i) => { if (p.offsetTop <= y) on = i; });
    tierLinks.forEach((a, i) => a.classList.toggle("on", i === on));
  }, { threshold: [0, 0.25, 0.5, 1] });
  parts.forEach(p => obs.observe(p));
  window.addEventListener("scroll", () => {
    const y = window.scrollY + 160;
    let on = 0;
    parts.forEach((p, i) => { if (p.offsetTop <= y) on = i; });
    tierLinks.forEach((a, i) => a.classList.toggle("on", i === on));
  }, { passive: true });
})();
