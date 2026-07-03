// collection-io.js — portable collection import/export (#27). Pure + DOM-free (testable).
// CSV interop targets the paintRack export format (the community de-facto standard; Miniature Nation
// imports it too): roughly `brand, name, [status]`. We are a collection-aware planner, not an
// inventory app — "good-enough" matching (by brand+name) is all we need. The richer full-fidelity
// backup format is JSON via store.exportJSON/importJSON; this module handles the CSV bridge + matching.

// Normalise any label to a bare comparison key: lowercase, strip everything but a–z and 0–9. This lets
// "Army Painter", "army-painter" and "armypainter" all collapse to the same key for matching.
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
// Map common brand spellings to our dataset's canonical brand (normalised).
// e.g. a paintRack export saying "Games Workshop" should match our "Citadel" rows.
const BRAND_ALIAS = {
  gamesworkshop: 'citadel',
  thearmypainter: 'armypainter',
  formulap3: 'p3', privateerpress: 'p3',
};
// Canonicalise a brand string: normalise it, then apply any alias (falling back to the normalised form).
const canonBrand = b => { const n = norm(b); return BRAND_ALIAS[n] || n; };

/** Minimal RFC-4180-ish CSV reader: handles quoted fields, escaped quotes, and \n / \r\n rows. */
// Hand-rolled CSV parser (no library, per §6). Walks the text one character at a time as a tiny state
// machine: `inQuotes` tracks whether we're inside a "quoted field" where commas/newlines are literal text.
export function parseCsvRows(text) {
  const rows = []; let row = [], field = '', inQuotes = false;  // accumulators: all rows, current row, current field, quote state
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      // Inside quotes: a " either closes the field or, if doubled ("") , is an escaped literal quote.
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;                                   // any other char is literal content
    } else if (c === '"') inQuotes = true;               // an opening quote starts a quoted field
    else if (c === ',') { row.push(field); field = ''; } // comma ends the current field
    else if (c === '\n' || c === '\r') {                 // newline ends the current row
      if (c === '\r' && text[i + 1] === '\n') i++;        // treat CRLF as one line break (skip the \n)
      row.push(field); field = '';                        // flush the last field of the row
      if (row.length > 1 || row[0] !== '') rows.push(row); // keep the row unless it's a single empty field (blank line)
      row = [];                                           // start a fresh row
    } else field += c;                                   // ordinary character → append to current field
  }
  // Flush any trailing field/row when the text doesn't end with a newline.
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

/** Parse paintRack-style CSV into {brand, name, status} rows. Tolerant of column order; falls back to
 *  positional brand,name when there's no recognisable header. */
export function parsePaintRackCsv(text) {
  const rows = parseCsvRows(text);                                  // raw rows first
  if (!rows.length) return [];                                      // empty file → nothing to import
  const header = rows[0].map(h => h.trim().toLowerCase());          // treat row 0 as a candidate header
  // Helper: find the column whose header contains ANY of the given keywords (returns its index, or -1).
  const find = (...keys) => header.findIndex(h => keys.some(k => h.includes(k)));
  let bi = find('brand', 'manufacturer'), ni = find('name', 'paint');  // brand + name column indexes
  const si = find('wish', 'want', 'buy', 'status', 'own', 'have', 'qty', 'quantity');  // status/quantity column index
  if (bi < 0 && ni < 0) {   // no header → assume positional: brand, name, [status]
    // No recognisable header row, so treat EVERY row (including row 0) as data in fixed column order.
    return rows.map(r => ({ brand: (r[0] || '').trim(), name: (r[1] || '').trim(), status: (r[2] || '').trim() }));
  }
  if (bi < 0) bi = 0;                    // header had a name column but no brand → assume brand is column 0
  if (ni < 0) ni = bi === 0 ? 1 : 0;     // name column missing → pick whichever of 0/1 the brand isn't
  // Skip the header row and map each data row into a {brand, name, status} object (status blank if no column).
  return rows.slice(1).map(r => ({
    brand: (r[bi] || '').trim(), name: (r[ni] || '').trim(), status: si >= 0 ? (r[si] || '').trim() : '',
  }));
}

/** Build name lookups for matching CSV rows to dataset paint ids. */
// Precompute two indexes over the dataset so matching each CSV row is a fast Map lookup rather than a scan:
//   byBrandName: exact "brand|name" key → single paint id (the precise match)
//   byName:      name-only key → LIST of ids (the looser fallback when the brand doesn't match)
function nameIndex(idx) {
  const byBrandName = new Map(), byName = new Map();
  for (const p of idx.paints) {
    byBrandName.set(canonBrand(p.brand) + '|' + norm(p.name), p.id);   // one id per brand+name combo
    const k = norm(p.name); let arr = byName.get(k); if (!arr) byName.set(k, arr = []); arr.push(p.id);  // group ids sharing a name
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
  const rows = parsePaintRackCsv(text);                     // CSV text → {brand,name,status} rows
  const { byBrandName, byName } = nameIndex(idx);           // lookups over the dataset
  const marks = [], unmatched = [], seen = new Set();       // results, misses, and a dedupe guard
  for (const r of rows) {
    if (!r.name) continue;                                  // skip rows with no paint name (nothing to match)
    // Prefer the exact brand+name match; if that misses, fall back to the first paint sharing the name.
    const id = byBrandName.get(canonBrand(r.brand) + '|' + norm(r.name)) || (byName.get(norm(r.name)) || [])[0];
    if (!id) { unmatched.push({ brand: r.brand, name: r.name }); continue; }  // record misses (surfaced, never dropped silently)
    if (seen.has(id)) continue; seen.add(id);               // ignore duplicate rows for the same paint
    // Classify the row: wish/want/buy wording → to-buy, anything else → owned (an inventory export lists what you own).
    marks.push({ id, mark: /wish|want|buy/.test(r.status.toLowerCase()) ? 'want' : 'owned' });
  }
  return { marks, matched: marks.length, unmatched };       // caller applies marks + can report matched/unmatched counts
}

/** Serialise the collection to paintRack-compatible CSV (brand,name,status). Round-trips with csvToMarks. */
// "Round-trips" = export then re-import yields the same marks. Output columns match what csvToMarks reads.
export function marksToCsv(idx, ownedIds, wantIds) {
  // Quote a value only if it contains a comma, quote, or newline; escape embedded quotes by doubling them.
  const esc = v => (/[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  let out = 'brand,name,status\n';                          // header row
  // Look up each id's paint and append a CSV line; silently skip ids not in the dataset.
  const add = (id, status) => { const p = idx.byId.get(id); if (p) out += `${esc(p.brand)},${esc(p.name)},${status}\n`; };
  for (const id of ownedIds) add(id, 'owned');              // owned paints get status "owned"
  for (const id of wantIds) add(id, 'wishlist');            // to-buy paints get "wishlist" (read back as 'want')
  return out;
}
