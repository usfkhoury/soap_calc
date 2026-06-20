/*
 * calc.js — pure soap math, no DOM. Shared by the UI (window.SoapCalc) and tests.
 *
 * Canonical unit is GRAMS; the UI converts to/from kilograms for display, so
 * every weight in and out of here is grams.
 *
 *   lye   = oil × SAP × (1 − superfat/100)   (SAP defaults to olive oil + NaOH, 0.135)
 *   water = lye × (100 − concentration) / concentration
 *   total (fresh batch) = oil + lye + water  = oil × totalFactor
 *
 * Scale by bars (fresh / poured basis): bars = total / barWeight, invertible to
 *   oil = bars × barWeight / totalFactor.
 */
(function (root) {
  'use strict';

  var DEFAULTS = { sap: 0.135, superfat: 5, concentration: 40 };

  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }
  function round(n, dp) { var f = Math.pow(10, dp == null ? 0 : dp); return Math.round(n * f) / f; }

  // Grams of lye per gram of oil, after superfat.
  function lyeFactor(opts) {
    opts = opts || {};
    return num(opts.sap, DEFAULTS.sap) * (1 - num(opts.superfat, DEFAULTS.superfat) / 100);
  }

  // Fresh-batch weight per gram of oil (oil + lye + water).
  function totalFactor(opts) {
    opts = opts || {};
    var conc = num(opts.concentration, DEFAULTS.concentration);
    var lf = lyeFactor(opts);
    return conc > 0 ? 1 + lf * 100 / conc : 1 + lf;
  }

  // Raw grams — the UI rounds per display unit (kg→3dp, g→1dp).
  function recipe(oil, opts) {
    oil = Math.max(0, num(oil, 0));
    var conc = num((opts || {}).concentration, DEFAULTS.concentration);
    var lye = oil * lyeFactor(opts);
    var water = conc > 0 ? lye * (100 - conc) / conc : 0;
    return { lye: lye, water: water, total: oil + lye + water };
  }

  // Estimated number of fresh/poured bars produced from an oil weight.
  function barsFromOil(oil, barWeight, opts) {
    barWeight = num(barWeight, 0);
    if (barWeight <= 0) return 0;
    return Math.max(0, num(oil, 0)) * totalFactor(opts) / barWeight;
  }

  // Oil weight needed for N fresh/poured bars of a given weight.
  function oilForBars(bars, barWeight, opts) {
    var tf = totalFactor(opts);
    return tf > 0 ? Math.max(0, num(bars, 0)) * Math.max(0, num(barWeight, 0)) / tf : 0;
  }

  // Cure plateau: given weekly weights (oldest→newest), decide if cured. Cured =
  // the latest week-over-week drop is below `threshold` percent, with at least
  // `minWeeks` readings. (Unit-agnostic — works on grams or kg alike.)
  function isCured(weights, threshold, minWeeks) {
    threshold = threshold == null ? 0.5 : threshold;
    minWeeks = minWeeks == null ? 3 : minWeeks;
    var w = (weights || []).map(Number).filter(function (x) { return isFinite(x) && x > 0; });
    if (w.length < minWeeks) return false;
    var prev = w[w.length - 2], last = w[w.length - 1];
    if (!prev) return false;
    var dropPct = (prev - last) / prev * 100;
    return dropPct >= 0 && dropPct < threshold;
  }

  var api = {
    DEFAULTS: DEFAULTS,
    lyeFactor: lyeFactor,
    totalFactor: totalFactor,
    recipe: recipe,
    barsFromOil: barsFromOil,
    oilForBars: oilForBars,
    isCured: isCured,
    round: round
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SoapCalc = api;
})(typeof self !== 'undefined' ? self : this);
