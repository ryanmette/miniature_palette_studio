// collection-io.js — portable collection import/export (#27). Pure + DOM-free (testable).
// CSV interop targets the paintRack export format (the community de-facto standard; Miniature Nation
// imports it too): roughly `brand, name, [status]`. We are a collection-aware planner, not an
// inventory app — "good-enough" matching (by brand+name) is all we need. The richer full-fidelity
// backup format is JSON via store.exportJSON/importJSON; this module handles the CSV bridge + matching.

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
// Map common brand spellings to our dataset's canonical brand (normalised).
const BRAND_ALIAS = {
  gamesworkshop: 'citadel',
  thearmypainter: 'armypainter',
  formulap3: 'p3', privateerpress: 'p3',
};
const canonBrand = b => { const n = norm(b); return BRAND_ALIAS[n] || n; };

/** Minimal RFC-4180-ish CSV reader: handles quoted fields, escaped quotes, and \n / \r\n rows. */
export function parseCsvRows(text) {
  const rows = []; let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

/** Parse paintRack-style CSV into {brand, name, status} rows. Tolerant of column order; falls back to
 *  positional brand,name when there's no recognisable header. */
export function parsePaintRackCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  const find = (...keys) => header.findIndex(h => keys.some(k => h.includes(k)));
  let bi = find('brand', 'manufacturer'), ni = find('name', 'paint');
  const si = find('wish', 'want', 'buy', 'status', 'own', 'have', 'qty', 'quantity');
  if (bi < 0 && ni < 0) {   // no header → assume positional: brand, name, [status]
    return rows.map(r => ({ brand: (r[0] || '').trim(), name: (r[1] || '').trim(), status: (r[2] || '').trim() }));
  }
  if (bi < 0) bi = 0;
  if (ni < 0) ni = bi === 0 ? 1 : 0;
  return rows.slice(1).map(r => ({
    brand: (r[bi] || '').trim(), name: (r[ni] || '').trim(), status: si >= 0 ? (r[si] || '').trim() : '',
  }));
}

/** Build name lookups for matching CSV rows to dataset paint ids. */
function nameIndex(idx) {
  const byBrandName = new Map(), byName = new Map();
  for (const p of idx.paints) {
    byBrandName.set(canonBrand(p.brand) + '|' + norm(p.name), p.id);
    const k = norm(p.name); let arr = byName.get(k); if (!arr) byName.set(k, arr = []); arr.push(p.id);
  }
  return { byBrandName, byName };
}

/**
 * Map paintRack-style CSV text to collection marks against a dataset index.
 * A row is 'want' if its status mentions wish/want/buy, else 'owned' (an inventory export = paints owned).
 * Matches on brand+name, then falls back to name-only. Unmatched rows are reported, not dropped silently.
 * @returns {{marks: Array<{id,mark}>, matched:number, unmatched: Array<{brand,name}>}}
 */
export function csvToMarks(idx, text) {
  const rows = parsePaintRackCsv(text);
  const { byBrandName, byName } = nameIndex(idx);
  const marks = [], unmatched = [], seen = new Set();
  for (const r of rows) {
    if (!r.name) continue;
    const id = byBrandName.get(canonBrand(r.brand) + '|' + norm(r.name)) || (byName.get(norm(r.name)) || [])[0];
    if (!id) { unmatched.push({ brand: r.brand, name: r.name }); continue; }
    if (seen.has(id)) continue; seen.add(id);
    marks.push({ id, mark: /wish|want|buy/.test(r.status.toLowerCase()) ? 'want' : 'owned' });
  }
  return { marks, matched: marks.length, unmatched };
}

/** Serialise the collection to paintRack-compatible CSV (brand,name,status). Round-trips with csvToMarks. */
export function marksToCsv(idx, ownedIds, wantIds) {
  const esc = v => (/[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  let out = 'brand,name,status\n';
  const add = (id, status) => { const p = idx.byId.get(id); if (p) out += `${esc(p.brand)},${esc(p.name)},${status}\n`; };
  for (const id of ownedIds) add(id, 'owned');
  for (const id of wantIds) add(id, 'wishlist');
  return out;
}
