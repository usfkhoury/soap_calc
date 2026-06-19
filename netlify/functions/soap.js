/*
 * soap.js — Netlify Function: the only thing that holds the Notion token.
 *
 * Reads/writes two Notion databases (Soap Batches + Cure Weights). Reads are
 * open; writes (create / appendCureWeight / updateBars) require the shared
 * passphrase in the `x-soap-secret` header (a light guard for a personal tool,
 * not real auth).
 *
 * Env: NOTION_TOKEN, NOTION_SOAP_DB_ID, NOTION_CURE_DB_ID, SOAP_WRITE_SECRET.
 */
const { Client } = require('@notionhq/client');

const SOAP_DB = process.env.NOTION_SOAP_DB_ID;
const CURE_DB = process.env.NOTION_CURE_DB_ID;
const SECRET = process.env.SOAP_WRITE_SECRET;

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

// ---- Notion property helpers ----
const num = (v) => (v == null || v === '' ? null : Number(v));
const numProp = (v) => ({ number: num(v) });
const textProp = (v) => ({ rich_text: v ? [{ text: { content: String(v).slice(0, 1900) } }] : [] });
const titleProp = (v) => ({ title: [{ text: { content: String(v).slice(0, 200) } }] });
const dateProp = (v) => (v ? { date: { start: v } } : { date: null });
const selectProp = (v) => (v ? { select: { name: v } } : { select: null });

const readNum = (p) => (p && p.number != null ? p.number : null);
const readSelect = (p) => (p && p.select ? p.select.name : null);
const readDate = (p) => (p && p.date ? p.date.start : null);
const readText = (p) => (p && p.rich_text && p.rich_text.length ? p.rich_text.map((t) => t.plain_text).join('') : '');
const readTitle = (p) => (p && p.title && p.title.length ? p.title.map((t) => t.plain_text).join('') : '');

function mapBatch(page) {
  const p = page.properties || {};
  return {
    id: page.id,
    date: readDate(p['Date']),
    oil: readNum(p['Oil (g)']),
    superfat: readNum(p['Superfat (%)']),
    conc: readNum(p['Concentration (%)']),
    lye: readNum(p['Lye (g)']),
    water: readNum(p['Water (g)']),
    bars: readNum(p['Bars']),
    status: readSelect(p['Status']) || 'Curing',
    notes: readText(p['Notes']),
    cureWeights: []
  };
}

async function listBatches() {
  const batches = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: SOAP_DB,
      start_cursor: cursor,
      sorts: [{ property: 'Date', direction: 'descending' }]
    });
    res.results.forEach((pg) => batches.push(mapBatch(pg)));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  // Pull all cure weights once and attach to their batch.
  if (CURE_DB) {
    const byId = {};
    batches.forEach((b) => (byId[b.id] = b));
    let c2;
    do {
      const cw = await notion.databases.query({ database_id: CURE_DB, start_cursor: c2 });
      cw.results.forEach((pg) => {
        const p = pg.properties || {};
        const rel = p['Batch'] && p['Batch'].relation && p['Batch'].relation[0];
        const bid = rel && rel.id;
        if (bid && byId[bid]) {
          byId[bid].cureWeights.push({ date: readDate(p['Date']), weight: readNum(p['Weight (g)']) });
        }
      });
      c2 = cw.has_more ? cw.next_cursor : undefined;
    } while (c2);
    batches.forEach((b) => b.cureWeights.sort((a, z) => String(a.date).localeCompare(String(z.date))));
  }
  return batches;
}

async function createBatch(b) {
  const page = await notion.pages.create({
    parent: { database_id: SOAP_DB },
    properties: {
      Name: titleProp((b.date || '') + ' · ' + (b.oil || 0) + ' g'),
      Date: dateProp(b.date),
      'Oil (g)': numProp(b.oil),
      'Superfat (%)': numProp(b.superfat),
      'Concentration (%)': numProp(b.conc),
      'Lye (g)': numProp(b.lye),
      'Water (g)': numProp(b.water),
      Bars: numProp(b.bars),
      Status: selectProp(b.status || 'Curing'),
      Notes: textProp(b.notes)
    }
  });
  return { id: page.id };
}

async function appendCureWeight({ id, weight, date, status }) {
  await notion.pages.create({
    parent: { database_id: CURE_DB },
    properties: {
      Name: titleProp((date || '') + ' · ' + weight + ' g'),
      Batch: { relation: [{ id }] },
      Date: dateProp(date),
      'Weight (g)': numProp(weight)
    }
  });
  if (status) {
    await notion.pages.update({ page_id: id, properties: { Status: selectProp(status) } });
  }
  return { ok: true, status: status || null };
}

async function updateBars({ id, bars }) {
  await notion.pages.update({ page_id: id, properties: { Bars: numProp(bars) } });
  return { ok: true };
}

exports.handler = async (event) => {
  try {
    if (!process.env.NOTION_TOKEN || !SOAP_DB) {
      return json(500, { error: 'Server not configured (missing NOTION_TOKEN / NOTION_SOAP_DB_ID).' });
    }

    if (event.httpMethod === 'GET') {
      const action = (event.queryStringParameters || {}).action || 'list';
      if (action !== 'list') return json(400, { error: 'unknown GET action' });
      return json(200, { batches: await listBatches() });
    }

    if (event.httpMethod === 'POST') {
      const provided = event.headers['x-soap-secret'] || event.headers['X-Soap-Secret'];
      if (!SECRET || provided !== SECRET) return json(401, { error: 'bad or missing passphrase' });

      const payload = JSON.parse(event.body || '{}');
      switch (payload.action) {
        case 'create': return json(200, await createBatch(payload.batch || {}));
        case 'appendCureWeight': return json(200, await appendCureWeight(payload));
        case 'updateBars': return json(200, await updateBars(payload));
        default: return json(400, { error: 'unknown action' });
      }
    }

    return json(405, { error: 'method not allowed' });
  } catch (err) {
    return json(500, { error: String((err && err.message) || err) });
  }
};
