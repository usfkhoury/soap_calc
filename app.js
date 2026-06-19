/*
 * app.js — UI wiring, persistence, and offline sync for soap_calc.
 *
 * Offline-first: the calculator, scale-by-bars, and steps are pure client-side
 * and always work. Batch records + weekly cure weights mirror to localStorage
 * and sync to Notion (via the /api/soap Netlify function) when online; writes
 * made offline queue and flush on reconnect.
 */
(function () {
  'use strict';

  var API = '/api/soap';
  var K = {
    inputs: 'soap.inputs',
    gPerBar: 'soap.gPerBar',
    secret: 'soap.secret',
    batches: 'soap.batches',   // mirror of server state (+ optimistic local)
    queue: 'soap.queue'        // pending writes to replay
  };

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    oil: $('oil'), superfat: $('superfat'), conc: $('conc'), sap: $('sap'),
    outLye: $('out-lye'), outWater: $('out-water'), outTotal: $('out-total'),
    explain: $('calc-explain'),
    barsWant: $('bars-want'), gPerBar: $('g-per-bar'), barsOil: $('bars-oil'), applyBars: $('apply-bars'),
    batchBars: $('batch-bars'), batchNotes: $('batch-notes'), saveBatch: $('save-batch'),
    batches: $('batches'),
    secret: $('secret'), saveSecret: $('save-secret'), refresh: $('refresh'),
    status: $('status')
  };

  // ---------- storage helpers ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  // ---------- calculator ----------
  function readOpts() {
    return {
      sap: parseFloat(el.sap.value),
      superfat: parseFloat(el.superfat.value),
      concentration: parseFloat(el.conc.value)
    };
  }
  function recompute() {
    var oil = parseFloat(el.oil.value) || 0;
    var opts = readOpts();
    var r = SoapCalc.recipe(oil, opts);
    el.outLye.textContent = r.lye;
    el.outWater.textContent = r.water;
    el.outTotal.textContent = r.total;
    el.explain.textContent =
      'lye = oil × ' + opts.sap + ' × (1 − ' + opts.superfat + '%) ;  ' +
      'water = lye × ' + (opts.concentration ? round2((100 - opts.concentration) / opts.concentration) : 0) +
      ' (' + opts.concentration + '% concentration)';
    save(K.inputs, { oil: el.oil.value, superfat: el.superfat.value, conc: el.conc.value, sap: el.sap.value });
    recomputeBars();
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  function recomputeBars() {
    var oil = SoapCalc.oilForBars(el.barsWant.value, el.gPerBar.value);
    el.barsOil.textContent = SoapCalc.round(oil, 0);
    return oil;
  }

  ['oil', 'superfat', 'conc', 'sap'].forEach(function (id) {
    el[id].addEventListener('input', recompute);
  });
  el.barsWant.addEventListener('input', recomputeBars);
  el.gPerBar.addEventListener('input', function () { save(K.gPerBar, el.gPerBar.value); recomputeBars(); });
  el.applyBars.addEventListener('click', function () {
    el.oil.value = SoapCalc.round(recomputeBars(), 0);
    recompute();
  });

  // ---------- network ----------
  function online() { return navigator.onLine !== false; }
  function authHeaders() {
    var s = load(K.secret, '');
    var h = { 'Content-Type': 'application/json' };
    if (s) h['x-soap-secret'] = s;
    return h;
  }

  function apiList() {
    return fetch(API + '?action=list', { headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('list ' + r.status); return r.json(); })
      .then(function (d) { return d.batches || []; });
  }
  function apiPost(payload) {
    return fetch(API, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error(payload.action + ' ' + r.status + ' ' + t); });
        return r.json();
      });
  }

  // ---------- batch model (localStorage mirror) ----------
  function getBatches() { return load(K.batches, []); }
  function setBatches(b) { save(K.batches, b); render(); }
  function getQueue() { return load(K.queue, []); }
  function setQueue(q) { save(K.queue, q); }

  function newId() { return 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }

  function saveBatch() {
    var oil = parseFloat(el.oil.value) || 0;
    var opts = readOpts();
    var r = SoapCalc.recipe(oil, opts);
    var batch = {
      id: newId(),
      date: new Date().toISOString().slice(0, 10),
      oil: oil, superfat: opts.superfat, conc: opts.concentration, sap: opts.sap,
      lye: r.lye, water: r.water,
      bars: el.batchBars.value ? parseInt(el.batchBars.value, 10) : null,
      notes: el.batchNotes.value || '',
      status: 'Curing',
      cureWeights: [],
      pending: true
    };
    var batches = getBatches();
    batches.unshift(batch);
    setBatches(batches);
    el.batchBars.value = ''; el.batchNotes.value = '';
    queueWrite({ action: 'create', clientId: batch.id, batch: stripLocal(batch) });
    setStatus();
  }

  function addCureWeight(id, weight) {
    weight = parseFloat(weight);
    if (!isFinite(weight) || weight <= 0) return;
    var batches = getBatches();
    var b = find(batches, id);
    if (!b) return;
    b.cureWeights = b.cureWeights || [];
    b.cureWeights.push({ date: new Date().toISOString().slice(0, 10), weight: weight });
    if (SoapCalc.isCured(b.cureWeights.map(function (c) { return c.weight; }))) b.status = 'Cured';
    setBatches(batches);
    queueWrite({ action: 'appendCureWeight', id: id, weight: weight, date: new Date().toISOString().slice(0, 10), status: b.status });
  }

  function stripLocal(b) {
    var c = JSON.parse(JSON.stringify(b));
    delete c.pending; return c;
  }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  // ---------- write queue ----------
  function queueWrite(item) {
    var q = getQueue(); q.push(item); setQueue(q);
    flush();
  }
  var flushing = false;
  function flush() {
    if (flushing || !online()) return;
    var q = getQueue();
    if (!q.length) return;
    flushing = true;
    var item = q[0];
    apiPost(item).then(function (res) {
      // On create, swap the optimistic local id for the server id.
      if (item.action === 'create' && res && res.id) {
        var batches = getBatches();
        var b = find(batches, item.clientId);
        if (b) { b.id = res.id; b.pending = false; }
        setBatches(batches);
        // Re-point any queued cure weights that referenced the local id.
        q.forEach(function (it) { if (it.id === item.clientId) it.id = res.id; });
      }
      q.shift(); setQueue(q);
      flushing = false;
      setStatus();
      if (q.length) flush();
    }).catch(function (err) {
      // Leave it queued; try again on next online/refresh. Stop the loop for now.
      flushing = false;
      setStatus(String(err.message || err));
    });
  }

  // ---------- rendering ----------
  function render() {
    var batches = getBatches();
    el.batches.innerHTML = '';
    if (!batches.length) {
      var empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'No batches yet. Save one above after you mix.';
      el.batches.appendChild(empty);
      return;
    }
    batches.forEach(function (b) { el.batches.appendChild(renderBatch(b)); });
  }

  function renderBatch(b) {
    var wrap = document.createElement('div');
    wrap.className = 'batch';

    var top = document.createElement('div'); top.className = 'top';
    var h3 = document.createElement('h3');
    h3.textContent = b.date + (b.oil ? ' · ' + b.oil + ' g oil' : '');
    var pill = document.createElement('span');
    pill.className = 'pill' + (b.status === 'Cured' ? ' cured' : '');
    pill.textContent = (b.pending ? '⏳ ' : '') + (b.status || 'Curing');
    top.appendChild(h3); top.appendChild(pill);
    wrap.appendChild(top);

    var meta = document.createElement('div'); meta.className = 'meta';
    var bits = ['lye ' + b.lye + ' g', 'water ' + b.water + ' g'];
    if (b.bars != null) bits.push(b.bars + ' bars');
    meta.textContent = bits.join(' · ');
    wrap.appendChild(meta);
    if (b.notes) { var n = document.createElement('div'); n.className = 'meta'; n.textContent = '“' + b.notes + '”'; wrap.appendChild(n); }

    var weights = (b.cureWeights || []).map(function (c) { return c.weight; });
    if (weights.length) wrap.appendChild(sparkline(weights));

    var row = document.createElement('div'); row.className = 'cure-row';
    var inp = document.createElement('input');
    inp.type = 'number'; inp.inputMode = 'decimal'; inp.min = '0'; inp.step = '0.1';
    inp.placeholder = 'this week’s bar weight (g)'; inp.style.maxWidth = '14rem';
    var btn = document.createElement('button');
    btn.className = 'btn ghost small'; btn.type = 'button'; btn.textContent = 'Log weight';
    btn.addEventListener('click', function () { addCureWeight(b.id, inp.value); inp.value = ''; });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { btn.click(); } });
    row.appendChild(inp); row.appendChild(btn);
    wrap.appendChild(row);

    if (weights.length) {
      var last = weights[weights.length - 1];
      var info = document.createElement('div'); info.className = 'meta';
      info.textContent = weights.length + ' reading' + (weights.length > 1 ? 's' : '') + ', latest ' + last + ' g';
      wrap.appendChild(info);
    }
    return wrap;
  }

  function sparkline(weights) {
    var s = document.createElement('div'); s.className = 'spark';
    var max = Math.max.apply(null, weights), min = Math.min.apply(null, weights);
    var span = (max - min) || 1;
    weights.forEach(function (w) {
      var bar = document.createElement('span');
      var h = 10 + ((w - min) / span) * 90; // 10–100%
      bar.style.height = h + '%';
      bar.title = w + ' g';
      s.appendChild(bar);
    });
    return s;
  }

  // ---------- status line ----------
  function setStatus(err) {
    var q = getQueue();
    var parts = [];
    parts.push(online() ? 'Online' : 'Offline');
    if (q.length) parts.push(q.length + ' change' + (q.length > 1 ? 's' : '') + ' pending sync');
    if (!load(K.secret, '') ) parts.push('set a passphrase to sync writes');
    if (err) parts.push('sync error: ' + err);
    el.status.textContent = parts.join(' · ');
    el.status.className = 'status-line' + (online() ? '' : ' net-off');
  }

  // ---------- sync from server ----------
  function refreshFromServer() {
    if (!online()) { setStatus(); return; }
    apiList().then(function (serverBatches) {
      // Server is source of truth; keep any local pending-create batches not yet synced.
      var pending = getBatches().filter(function (b) { return b.pending; });
      setBatches(pending.concat(serverBatches));
      setStatus();
    }).catch(function (err) { setStatus(String(err.message || err)); });
  }

  // ---------- settings ----------
  el.saveSecret.addEventListener('click', function () {
    save(K.secret, el.secret.value || '');
    el.secret.value = '';
    setStatus();
    flush();
  });
  el.refresh.addEventListener('click', refreshFromServer);
  el.saveBatch.addEventListener('click', saveBatch);

  window.addEventListener('online', function () { setStatus(); flush(); refreshFromServer(); });
  window.addEventListener('offline', function () { setStatus(); });

  // ---------- init ----------
  (function init() {
    var inputs = load(K.inputs, null);
    if (inputs) {
      if (inputs.oil != null) el.oil.value = inputs.oil;
      if (inputs.superfat != null) el.superfat.value = inputs.superfat;
      if (inputs.conc != null) el.conc.value = inputs.conc;
      if (inputs.sap != null) el.sap.value = inputs.sap;
    }
    var gpb = load(K.gPerBar, null);
    if (gpb != null) el.gPerBar.value = gpb;

    recompute();
    render();
    setStatus();
    flush();
    refreshFromServer();
  })();
})();
