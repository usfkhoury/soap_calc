/*
 * calc.js — pure soap math, no DOM. Shared by the UI (window.SoapCalc) and
 * potentially the serverless function / tests (module.exports).
 *
 * All inputs and outputs are by WEIGHT, in grams.
 *
 *   lye   = oil × SAP × (1 − superfat/100)
 *   water = lye × (100 − concentration) / concentration
 *
 * Defaults (the "Moderate" castile profile): SAP 0.135, superfat 5%,
 * lye concentration 40% → lye = oil × 0.128, water = oil × 0.192.
 */
(function (root) {
  'use strict';

  var DEFAULTS = { sap: 0.135, superfat: 5, concentration: 40 };

  function round(n, dp) {
    var f = Math.pow(10, dp == null ? 0 : dp);
    return Math.round(n * f) / f;
  }

  // Returns { lye, water, total } in grams (lye & water rounded to whole grams).
  function recipe(oil, opts) {
    opts = opts || {};
    var sap = num(opts.sap, DEFAULTS.sap);
    var superfat = num(opts.superfat, DEFAULTS.superfat);
    var conc = num(opts.concentration, DEFAULTS.concentration);
    oil = Math.max(0, num(oil, 0));

    var lye = oil * sap * (1 - superfat / 100);
    var water = conc > 0 ? lye * (100 - conc) / conc : 0;

    return {
      lye: round(lye, 1),
      water: round(water, 1),
      total: round(oil + lye + water, 1)
    };
  }

  // Oil weight needed for a desired number of bars.
  function oilForBars(bars, gPerBar) {
    return Math.max(0, num(bars, 0)) * Math.max(0, num(gPerBar, 0));
  }

  // Cure plateau: given weekly weights (numbers, oldest→newest), decide if the
  // bar has cured. Cured = the latest week-over-week drop is below `threshold`
  // percent, with at least `minWeeks` readings to judge from.
  function isCured(weights, threshold, minWeeks) {
    threshold = threshold == null ? 0.5 : threshold; // percent
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
    recipe: recipe,
    oilForBars: oilForBars,
    isCured: isCured,
    round: round
  };

  function num(v, d) { v = parseFloat(v); return isFinite(v) ? v : d; }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SoapCalc = api;
})(typeof self !== 'undefined' ? self : this);
