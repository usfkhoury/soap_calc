/*
 * app.js — UI wiring, persistence, and offline sync for the Soap Calculator.
 *
 * Offline-first: the calculator, the oil⇄bars linkage, and the steps are pure
 * client-side and always work. The batch log + cure history are public to read;
 * adding batches / logging cure weights requires the OWNER to sign in with
 * Google (Google Identity Services). The ID token is sent as a Bearer header and
 * verified by the /api/soap function. Writes made offline queue and flush on
 * reconnect (re-signing in if the token has expired).
 *
 * Units: kg or g (toggle); grams are the canonical stored unit (and Notion's).
 */
(function () {
  'use strict';

  var API = '/api/soap';
  var CLIENT_ID = (document.querySelector('meta[name="google-client-id"]') || {}).content || '';
  var K = {
    inputs: 'soap.inputs',   // { oil, superfat, conc, sap, barWeight } — weights in GRAMS
    unit: 'soap.unit',       // 'kg' | 'g'
    batches: 'soap.batches',
    queue: 'soap.queue'
  };

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    oil: $('oil'), bars: $('bars'), barWeight: $('bar-weight'),
    superfat: $('superfat'), conc: $('conc'), sap: $('sap'),
    outLye: $('out-lye'), outWater: $('out-water'), outTotal: $('out-total'),
    explain: $('calc-explain'),
    batchBars: $('batch-bars'), batchNotes: $('batch-notes'), saveBatch: $('save-batch'),
    batches: $('batches'), refresh: $('refresh'),
    status: $('status'), unitToggle: $('unit-toggle'),
    authArea: $('auth-area'), writeForm: $('write-form')
  };

  // ---------- storage ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  // ---------- units ----------
  var unit = load(K.unit, 'kg');
  function gPerUnit() { return unit === 'kg' ? 1000 : 1; }
  function toGrams(v) { return (parseFloat(v) || 0) * gPerUnit(); }
  function fmtWeight(g) { return unit === 'kg' ? (g / 1000).toFixed(3) : String(Math.round(g * 10) / 10); }
  function round2(n) { return Math.round(n * 100) / 100; }

  function applyUnitLabels() {
    var els = document.querySelectorAll('.u-unit');
    for (var i = 0; i < els.length; i++) els[i].textContent = unit;
    var full = unit === 'kg' ? 'kilograms' : 'grams';
    el.unitToggle.textContent = unit;
    el.unitToggle.setAttribute('aria-label', 'Units: ' + full);
    el.unitToggle.title = 'Units: ' + full + ' (tap to switch)';
  }
  function setUnit(next) {
    if (next === unit) return;
    var oilG = toGrams(el.oil.value), bwG = toGrams(el.barWeight.value);
    unit = next; save(K.unit, unit);
    el.oil.value = fmtWeight(oilG); el.barWeight.value = fmtWeight(bwG);
    applyUnitLabels(); recomputeFromOil(); render();
  }

  // ---------- calculator ----------
  function readOpts() { return { sap: parseFloat(el.sap.value), superfat: parseFloat(el.superfat.value), concentration: parseFloat(el.conc.value) }; }
  function paintOutputs(r) { el.outLye.textContent = fmtWeight(r.lye); el.outWater.textContent = fmtWeight(r.water); el.outTotal.textContent = fmtWeight(r.total); }
  function paintExplain(opts) {
    el.explain.textContent =
      'lye = oil × ' + opts.sap + ' × (1 − ' + opts.superfat + '%) ;  ' +
      'water = lye × ' + (opts.concentration ? round2((100 - opts.concentration) / opts.concentration) : 0) +
      ' (' + opts.concentration + '% concentration)';
  }
  function persistInputs(oilG) {
    save(K.inputs, { oil: oilG, superfat: el.superfat.value, conc: el.conc.value, sap: el.sap.value, barWeight: toGrams(el.barWeight.value) });
  }
  function recomputeFromOil() {
    var oilG = toGrams(el.oil.value), opts = readOpts(), r = SoapCalc.recipe(oilG, opts);
    paintOutputs(r);
    el.bars.value = Math.max(0, Math.round(SoapCalc.barsFromOil(oilG, toGrams(el.barWeight.value), opts)));
    paintExplain(opts); persistInputs(oilG);
  }
  function recomputeFromBars() {
    var opts = readOpts();
    var oilG = SoapCalc.oilForBars(parseFloat(el.bars.value) || 0, toGrams(el.barWeight.value), opts);
    el.oil.value = fmtWeight(oilG);
    paintOutputs(SoapCalc.recipe(oilG, opts)); paintExplain(opts); persistInputs(oilG);
  }
  ['oil', 'barWeight', 'superfat', 'conc', 'sap'].forEach(function (k) { el[k].addEventListener('input', recomputeFromOil); });
  el.bars.addEventListener('input', recomputeFromBars);
  el.unitToggle.addEventListener('click', function () { setUnit(unit === 'kg' ? 'g' : 'kg'); });

  // ---------- auth (Google, owner-only writes) ----------
  var idToken = null, ownerEmail = '', isOwner = false;
  function gisReady() { return !!(window.google && google.accounts && google.accounts.id); }
  function parseJwt(t) { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; } }

  function setupAuth(tries) {
    if (!CLIENT_ID) { renderAuth(); return; }
    if (!gisReady()) { if ((tries || 0) < 20) { setTimeout(function () { setupAuth((tries || 0) + 1); }, 250); } else { renderAuth(); } return; }
    google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: true });
    renderAuth();
  }
  function onCredential(resp) {
    idToken = resp.credential;
    ownerEmail = parseJwt(idToken).email || '';
    isOwner = true;
    renderAuth(); render(); setStatus(); flush();
  }
  function signOut() {
    idToken = null; ownerEmail = ''; isOwner = false;
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    renderAuth(); render(); setStatus();
  }
  function renderAuth() {
    var a = el.authArea; a.innerHTML = '';
    if (!CLIENT_ID) {
      var w = document.createElement('p'); w.className = 'hint';
      w.textContent = 'Owner sign-in isn’t configured yet (no Google client ID set).';
      a.appendChild(w); el.writeForm.hidden = true; return;
    }
    if (isOwner) {
      var who = document.createElement('div'); who.className = 'who';
      var span = document.createElement('span'); span.textContent = 'Signed in' + (ownerEmail ? ' as ' + ownerEmail : '');
      var out = document.createElement('button'); out.className = 'btn ghost small'; out.type = 'button'; out.textContent = 'Sign out';
      out.addEventListener('click', signOut);
      who.appendChild(span); who.appendChild(out); a.appendChild(who);
      el.writeForm.hidden = false;
    } else {
      var host = document.createElement('div');
      a.appendChild(host);
      var note = document.createElement('p'); note.className = 'hint';
      note.textContent = 'Sign in as the owner to add batches and log cure weights.';
      a.appendChild(note);
      el.writeForm.hidden = true;
      if (gisReady()) try { google.accounts.id.renderButton(host, { theme: 'outline', size: 'medium', text: 'signin_with' }); } catch (e) {}
    }
  }

  // ---------- network ----------
  function online() { return navigator.onLine !== false; }
  function authHeaders() { var h = { 'Content-Type': 'application/json' }; if (idToken) h['Authorization'] = 'Bearer ' + idToken; return h; }
  function apiList() {
    return fetch(API + '?action=list', { headers: { 'Content-Type': 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('list ' + r.status); return r.json(); })
      .then(function (d) { return d.batches || []; });
  }
  function apiPost(payload) {
    return fetch(API, { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { var e = new Error(payload.action + ' ' + r.status + ' ' + t); e.status = r.status; throw e; }); return r.json(); });
  }

  // ---------- batches (grams canonical) ----------
  function getBatches() { return load(K.batches, []); }
  function setBatches(b) { save(K.batches, b); render(); }
  function getQueue() { return load(K.queue, []); }
  function setQueue(q) { save(K.queue, q); }
  function newId() { return 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function stripLocal(b) { var c = JSON.parse(JSON.stringify(b)); delete c.pending; return c; }

  function saveBatch() {
    if (!isOwner) return;
    var oilG = toGrams(el.oil.value), opts = readOpts(), r = SoapCalc.recipe(oilG, opts);
    var batch = {
      id: newId(), date: new Date().toISOString().slice(0, 10),
      oil: SoapCalc.round(oilG, 1), superfat: opts.superfat, conc: opts.concentration, sap: opts.sap,
      lye: SoapCalc.round(r.lye, 1), water: SoapCalc.round(r.water, 1),
      bars: el.batchBars.value ? parseInt(el.batchBars.value, 10) : null,
      notes: el.batchNotes.value || '', status: 'Curing', cureWeights: [], pending: true
    };
    var batches = getBatches(); batches.unshift(batch); setBatches(batches);
    el.batchBars.value = ''; el.batchNotes.value = '';
    queueWrite({ action: 'create', clientId: batch.id, batch: stripLocal(batch) });
    setStatus();
  }

  function addCureWeight(id, displayWeight) {
    if (!isOwner) return;
    var wG = toGrams(displayWeight);
    if (!isFinite(wG) || wG <= 0) return;
    var batches = getBatches(), b = find(batches, id);
    if (!b) return;
    b.cureWeights = b.cureWeights || [];
    b.cureWeights.push({ date: new Date().toISOString().slice(0, 10), weight: SoapCalc.round(wG, 1) });
    if (SoapCalc.isCured(b.cureWeights.map(function (c) { return c.weight; }))) b.status = 'Cured';
    setBatches(batches);
    queueWrite({ action: 'appendCureWeight', id: id, weight: SoapCalc.round(wG, 1), date: new Date().toISOString().slice(0, 10), status: b.status });
  }

  // ---------- write queue ----------
  function queueWrite(item) { var q = getQueue(); q.push(item); setQueue(q); flush(); }
  var flushing = false;
  function flush() {
    if (flushing || !online() || !idToken) return;   // need a signed-in owner token to write
    var q = getQueue();
    if (!q.length) return;
    flushing = true;
    var item = q[0];
    apiPost(item).then(function (res) {
      if (item.action === 'create' && res && res.id) {
        var batches = getBatches(), b = find(batches, item.clientId);
        if (b) { b.id = res.id; b.pending = false; }
        setBatches(batches);
        q.forEach(function (it) { if (it.id === item.clientId) it.id = res.id; });
      }
      q.shift(); setQueue(q); flushing = false; setStatus();
      if (q.length) flush();
    }).catch(function (err) {
      flushing = false;
      if (err.status === 401 || err.status === 403) { idToken = null; isOwner = false; renderAuth(); render(); }
      setStatus(String(err.message || err));
    });
  }

  // ---------- rendering ----------
  function render() {
    var batches = getBatches();
    el.batches.innerHTML = '';
    if (!batches.length) {
      var empty = document.createElement('p'); empty.className = 'hint';
      empty.textContent = 'No batches yet.' + (isOwner ? ' Save one above after you mix.' : '');
      el.batches.appendChild(empty); return;
    }
    batches.forEach(function (b) { el.batches.appendChild(renderBatch(b)); });
  }

  function renderBatch(b) {
    var wrap = document.createElement('div'); wrap.className = 'batch';
    var top = document.createElement('div'); top.className = 'top';
    var h3 = document.createElement('h3');
    h3.textContent = b.date + (b.oil ? ' · ' + fmtWeight(b.oil) + ' ' + unit + ' oil' : '');
    var pill = document.createElement('span');
    pill.className = 'pill' + (b.status === 'Cured' ? ' cured' : '');
    pill.textContent = (b.pending ? '⏳ ' : '') + (b.status || 'Curing');
    top.appendChild(h3); top.appendChild(pill); wrap.appendChild(top);

    var meta = document.createElement('div'); meta.className = 'meta';
    var bits = ['lye ' + fmtWeight(b.lye) + ' ' + unit, 'water ' + fmtWeight(b.water) + ' ' + unit];
    if (b.bars != null) bits.push(b.bars + ' bars');
    meta.textContent = bits.join(' · '); wrap.appendChild(meta);
    if (b.notes) { var n = document.createElement('div'); n.className = 'meta'; n.textContent = '“' + b.notes + '”'; wrap.appendChild(n); }

    var weights = (b.cureWeights || []).map(function (c) { return c.weight; });
    if (weights.length) wrap.appendChild(sparkline(weights));

    if (isOwner) {
      var row = document.createElement('div'); row.className = 'cure-row';
      var inp = document.createElement('input');
      inp.type = 'number'; inp.inputMode = 'decimal'; inp.min = '0'; inp.step = 'any';
      inp.placeholder = 'this week’s bar weight (' + unit + ')'; inp.style.maxWidth = '15rem';
      var btn = document.createElement('button');
      btn.className = 'btn ghost small'; btn.type = 'button'; btn.textContent = 'Log weight';
      btn.addEventListener('click', function () { addCureWeight(b.id, inp.value); inp.value = ''; });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
      row.appendChild(inp); row.appendChild(btn); wrap.appendChild(row);
    }
    if (weights.length) {
      var info = document.createElement('div'); info.className = 'meta';
      info.textContent = weights.length + ' reading' + (weights.length > 1 ? 's' : '') + ', latest ' + fmtWeight(weights[weights.length - 1]) + ' ' + unit;
      wrap.appendChild(info);
    }
    return wrap;
  }

  function sparkline(weights) {
    var s = document.createElement('div'); s.className = 'spark';
    var max = Math.max.apply(null, weights), min = Math.min.apply(null, weights), span = (max - min) || 1;
    weights.forEach(function (w) {
      var bar = document.createElement('span');
      bar.style.height = (10 + ((w - min) / span) * 90) + '%';
      bar.title = fmtWeight(w) + ' ' + unit; s.appendChild(bar);
    });
    return s;
  }

  // ---------- status ----------
  function setStatus(err) {
    var q = getQueue(), parts = [online() ? 'Online' : 'Offline'];
    if (q.length) parts.push(q.length + ' change' + (q.length > 1 ? 's' : '') + ' pending sync');
    if (q.length && !isOwner) parts.push('sign in to sync');
    if (err) parts.push('sync error: ' + err);
    el.status.textContent = parts.join(' · ');
    el.status.className = 'status-line' + (online() ? '' : ' net-off');
  }

  // ---------- sync ----------
  function refreshFromServer() {
    if (!online()) { setStatus(); return; }
    apiList().then(function (serverBatches) {
      var pending = getBatches().filter(function (b) { return b.pending; });
      setBatches(pending.concat(serverBatches)); setStatus();
    }).catch(function (err) { setStatus(String(err.message || err)); });
  }

  // ---------- events ----------
  el.refresh.addEventListener('click', refreshFromServer);
  el.saveBatch.addEventListener('click', saveBatch);
  window.addEventListener('online', function () { setStatus(); flush(); refreshFromServer(); });
  window.addEventListener('offline', function () { setStatus(); });

  // ---------- init ----------
  (function init() {
    applyUnitLabels();
    var inputs = load(K.inputs, null);
    if (inputs) {
      if (inputs.oil != null) el.oil.value = fmtWeight(Number(inputs.oil));
      if (inputs.superfat != null) el.superfat.value = inputs.superfat;
      if (inputs.conc != null) el.conc.value = inputs.conc;
      if (inputs.sap != null) el.sap.value = inputs.sap;
      if (inputs.barWeight != null) el.barWeight.value = fmtWeight(Number(inputs.barWeight));
    }
    recomputeFromOil();
    render();
    setStatus();
    setupAuth();
    refreshFromServer();
  })();
})();
