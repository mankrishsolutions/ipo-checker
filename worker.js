// Cloudflare Worker: reads public IPO pages (IPO Ji, IPO Watch) + Google News headlines. No API keys.
const H = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'en-IN,en;q=0.9', 'upgrade-insecure-requests': '1', 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', referer: 'https://www.google.com/' };
const ENT = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: ' ', gt: ' ', ndash: '–', mdash: '–', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '…', times: 'x', rupee: '₹', middot: '·' };
const txt = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!\[CDATA\[|\]\]>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m).replace(/\s+/g, ' ').trim();
const get = async u => { const r = await fetch(u, { headers: UA }); const h = await r.text(); if (!r.ok) throw new Error(r.status === 403 || r.status === 503 ? r.status + ' blocked by site' : String(r.status)); if (/just a moment|cf-chl|attention required/i.test(h.slice(0, 4000))) throw new Error('blocked by challenge page'); return h; };
const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/,/g, '')) : null; };
const MONI = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const pd = s => { const m = String(s || '').match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/); if (m && MONI[m[1].slice(0, 3).toLowerCase()] != null) return Date.UTC(+m[3], MONI[m[1].slice(0, 3).toLowerCase()], +m[2]); const t = Date.parse(s); return isNaN(t) ? NaN : t; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const STOP = new Set(['ltd', 'limited', 'pvt', 'private', 'ipo', 'india', 'the', 'and', 'of']);
const tokens = n => { const t = n.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)); return t.length ? t : n.toLowerCase().split(/\s+/).filter(Boolean); };

async function listing() {
  const pages = ['ipo/current-ipo', 'ipo/upcoming-ipo', 'ipo/listed-ipo', 'sme-ipo/current-ipo', 'sme-ipo/upcoming-ipo'];
  const hs = await Promise.all(pages.map(p => get('https://www.ipoji.com/' + p).catch(() => '')));
  const set = new Set();
  hs.forEach(h => { for (const m of h.matchAll(/href="(?:https:\/\/www\.ipoji\.com)?(\/(?:sme-)?ipo\/[a-z0-9-]+-ipo)"/g)) set.add(m[1]); });
  return [...set];
}

const tri = (t, re) => { const m = t.match(re); return m ? [1, 2, 3].map(i => parseFloat(m[i].replace(/,/g, ''))) : null; };
const heads = s => s ? [...s.matchAll(/([A-Z][\w&,'\/ -]{4,70}?):\s/g)].map(m => m[1].trim()).slice(0, 4) : [];
function parseIpoji(h) {
  const t = txt(h);
  const d = t.match(/IPO Dates\s*([A-Za-z]+ \d+, \d{4})\s*[–-]\s*([A-Za-z]+ \d+, \d{4})/i) || (m => m ? [m[0], m[1] + ', ' + m[3], m[2] + ', ' + m[3]] : null)(t.match(/open from ([A-Za-z]+ \d{1,2}) to ([A-Za-z]+ \d{1,2}), (\d{4})/i));
  let status = null;
  if (d) { const now = Date.now(), o = Date.parse(d[1]), c = Date.parse(d[2]) + 864e5; status = now < o ? 'Upcoming' : now < c ? 'Open now' : 'Bidding closed'; }
  const ab = t.match(/About\s+([A-Z][A-Za-z0-9&.,'() -]{2,60}?\s(?:Limited|Ltd\.?))/);
  const ti = (h.match(/<title>\s*([^<]+?)\s*<\/title>/i) || [])[1];
  const hd = (h.match(/<h[1-3][^>]*>\s*([^<]*?\s(?:Limited|Ltd\.?))\s+IPO\s*<\/h[1-3]>/i) || [])[1];
  let full = hd ? hd.trim() : ab ? ab[1].trim() : ti ? txt(ti).split(/\s[|–-]\s/)[0].replace(/\s+(SME\s+)?IPO\b.*$/i, '').trim() : null;
  if (full && (full.length > 70 || full.length < 3)) full = null;
  return {
    full,
    gmp: num(t, /IPO GMP Today:\s*₹\s*(-?[\d,.]+)/i) ?? num(t, /GMP Today\D{0,40}?₹\s*(-?[\d,.]+)/i), lot: num(t, /Lot Size\s*([\d,]+)/i),
    gmpPct: num(t, /GMP percentage\s*(-?[\d.]+)\s*%/i),
    upper: num(t, /Upper price band\s*₹\s*([\d,.]+)/i) ?? num(t, /Price band\s*₹\s*[\d,.]+\s*[-–]\s*₹?\s*([\d,.]+)/i) ?? num(t, /priced at ₹\s*[\d,.]+\s*[–-]\s*₹?\s*([\d,.]+)/i),
    sub: num(t, /\bTotal\s+([\d.]+)\s*x\b/),
    qib: num(t, /Qualified Institutional Buyers \(QIBs\)\s*([\d.]+)\s*x/i),
    nii: num(t, /Non-Institutional Investors \(NIIs\)\s*([\d.]+)\s*x/i),
    ret: num(t, /Retail Individual Investors \(RIIs\)\s*([\d.]+)\s*x/i),
    pe: num(t, /P\/E Post IPO\D{0,200}?([\d.]+)/i),
    roe: num(t, /\bROE\D{0,160}?([\d.]+)\s*%/),
    de: num(t, /Debt \/ Equity\D{0,160}?([\d.]+)/i),
    rev: tri(t, /\bRevenue\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/), pat: tri(t, /Profit After Tax\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/),
    nw: tri(t, /Net Worth\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/), debt: tri(t, /Total Borrowing\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/),
    patm: num(t, /PAT Margin\D{0,160}?([\d.]+)\s*%/), pb: num(t, /Price \/ Book\D{0,160}?([\d.]+)/i), mcap: num(t, /Market Cap\D{0,200}?₹\s*([\d,.]+)/), issue: num(t, /Issue size\s*₹\s*([\d,.]+)\s*Cr/i),
    strengths: heads(t.match(/Strengths and Risks.*?Strengths(.*?)Risks/)?.[1]), risks: heads(t.match(/Strengths and Risks.*?Risks(.*?)(?:Contact Information|$)/)?.[1]),
    dates: d ? d[1] + ' to ' + d[2] : null, status
  };
}

const titleCase = s => s.split('-').map(x => x.length <= 4 ? x.toUpperCase() : x[0].toUpperCase() + x.slice(1)).join(' ');
const NAV = new Set(['current', 'upcoming', 'listed']);
async function lineupIpoji() {
  const src = { open: ['ipo/current-ipo', 'sme-ipo/current-ipo'], upcoming: ['ipo/upcoming-ipo', 'sme-ipo/upcoming-ipo'], closed: ['ipo/listed-ipo', 'sme-ipo/listed-ipo'] };
  const n = new Date(Date.now() + 19800000), today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const dd = s => { const t = Date.parse(/\d{4}/.test(s) ? s : s + ', ' + n.getUTCFullYear()); return isNaN(t) ? null : Math.round((t - today) / 864e5); };
  const DR = /([A-Z][a-z]{2} \d{1,2}(?:, \d{4})?)\s*(?:[–-]|to)\s*([A-Z][a-z]{2} \d{1,2}(?:, \d{4})?)/;
  const out = {};
  await Promise.all(Object.entries(src).map(async ([k, ps]) => {
    const hs = await Promise.all(ps.map(p => get('https://www.ipoji.com/' + p).catch(() => '')));
    const seen = new Set(), items = [];
    hs.forEach(h => { for (const m of h.matchAll(/<a[^>]+href="(?:https:\/\/www\.ipoji\.com)?(\/(sme-)?ipo\/([a-z0-9-]+)-ipo)"[^>]*>([\s\S]*?)<\/a>/g)) {
      if (seen.has(m[1]) || NAV.has(m[3])) continue; seen.add(m[1]);
      const at = txt(m[4]); let nm = at.replace(/\s+IPO\b.*$/i, '').trim();
      if (nm.length < 3 || nm.length > 60 || /\d{2,}/.test(nm)) nm = titleCase(m[3]);
      const dm = at.match(DR) || txt(h.slice(m.index + m[0].length, m.index + m[0].length + 250)).match(DR);
      let flag = null, dates = null;
      if (dm) { dates = dm[1] + ' to ' + dm[2]; const o = dd(dm[1]), c = dd(dm[2]); flag = c === 0 ? 'Closes today' : c === 1 ? 'Closes tomorrow' : o === 0 ? 'Opens today' : o === 1 ? 'Opens tomorrow' : null; }
      items.push({ name: nm, sme: !!m[2], dates, flag });
    } });
    out[k] = items.slice(0, 30);
  }));
  return out;
}

const stat = (o, c) => { const n = Date.now() + 19800000; return Date.parse(o) > n ? 'Upcoming' : n < Date.parse(c) + 864e5 ? 'Open now' : 'Bidding closed'; };
async function watchIndex() {
  const h = await get('https://ipowatch.in/');
  return [...new Set([...h.matchAll(/href="https:\/\/ipowatch\.in\/([a-z0-9-]+-ipo)\/"/g)].map(m => m[1]))];
}
async function watchPage(slug) {
  const t = txt(await get(`https://ipowatch.in/${slug}/`));
  const i = t.indexOf('Company Financials'), v = t.indexOf('Company Valuation');
  const fin = i >= 0 ? t.slice(i, v > i ? v : i + 900) : '';
  const rows = [...fin.matchAll(/((?:[A-Z][a-z]{2} )?20\d\d)\s*₹\s*([\d,.]+)\s*₹\s*([\d,.]+)\s*₹\s*(-?[\d,.]+)\s*₹\s*([\d,.]+)/g)].slice(-3);
  const col = k => rows.length ? rows.map(r => parseFloat(r[k].replace(/,/g, ''))).reverse() : null;
  const vt = v >= 0 ? t.slice(v, v + 900) : '';
  const dm = t.match(/IPO Open Date\s*([A-Za-z]+ \d{1,2}, \d{4})\s*IPO Close Date\s*([A-Za-z]+ \d{1,2}, \d{4})/);
  return {
    upper: num(t, /IPO Price Band\s*₹?\s*[\d,.]+\s*(?:to|-|–)\s*₹?\s*([\d,.]+)/i), lot: num(t, /market lot is\s*([\d,]+)\s*shares/i), issue: num(t, /Issue Size\s*Approx\s*₹\s*([\d,.]+)\s*Crores/i),
    rev: col(2), pat: col(4), assets: col(5),
    roe: num(vt, /ROE:?\s*([\d.]+)\s*%/), patm: num(vt, /PAT Margin:?\s*([\d.]+)\s*%/), de: num(vt, /Debt to equity ratio:?\s*([\d.]+)/i), eps: num(vt, /Earning Per Share \(EPS\):?\s*₹\s*([\d.]+)/i), pe: num(vt, /P\/E Ratio:?\s*([\d.]+)/i), nav: num(vt, /Net Asset Value \(NAV\):?\s*₹\s*([\d.]+)/i),
    open: dm && dm[1], close: dm && dm[2]
  };
}
async function watchSub(slug) {
  const t = txt(await get(`https://ipowatch.in/${slug}-subscription-status/`));
  const f = re => num(t, re);
  return { qib: f(/QIB[\s\S]{0,120}?(\d+(?:\.\d+)?)\s*x\b/i), nii: f(/\bNII[\s\S]{0,120}?(\d+(?:\.\d+)?)\s*x\b/), ret: f(/Retail[\s\S]{0,120}?(\d+(?:\.\d+)?)\s*x\b/i), sub: f(/\bTotal[\s\S]{0,80}?(\d+(?:\.\d+)?)\s*x\b/i) };
}
const DASH = '[-–—‑‒−~]';
const SUF = /\s*\([^()]*\)/g;
const band = s => { const m = String(s || '').replace(/[₹,]/g, ' ').match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*(?:' + DASH + '|to)\\s*(\\d+(?:\\.\\d+)?)', 'i')) || String(s || '').replace(/[₹,]/g, ' ').match(/^\s*(\d+(?:\.\d+)?)\s*$/); if (!m) return null; const lo = +m[1], hi = +(m[2] ?? m[1]); return hi > 0 ? { price: lo === hi ? String(lo) : lo + '–' + hi, upper: hi } : null; };
const cell = s => { const n = parseFloat(String(s || '').replace(/[₹,\s]|cr\.?/gi, '')); return isNaN(n) ? null : n; };
async function premium() {
  const h = await get('https://www.ipopremium.in/');
  const n = new Date(Date.now() + 19800000), today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const dd = s => { const t = pd(s); return isNaN(t) ? null : Math.round((t - today) / 864e5); };
  const rows = [], seen = new Set();
  for (const tb of h.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const trs = [...tb[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(x => x[1]);
    const cellsOf = r => [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x => txt(x[1]));
    const hd = trs.map(cellsOf).find(c => c.some(x => /company/i.test(x))) || [];
    const ix = re => hd.findIndex(x => re.test(x));
    const col = { name: ix(/company/i), type: ix(/^type/i), gmp: ix(/gmp/i), open: ix(/^open/i), close: ix(/^close/i), price: ix(/price/i), lot: ix(/^lot/i), issue: ix(/issue/i), allot: ix(/allot/i), listing: ix(/listing/i) };
    for (const r of trs) {
      const a = r.match(/href="([^"]*\/view\/ipo\/[^"]+)"/); if (!a) continue;
      let c = cellsOf(r); if (c.length < 5) continue;
      const g = k => (col[k] >= 0 && col[k] < c.length ? c[col[k]] : null);
      if (col.name < 0) Object.assign(col, { name: 0, type: 1, gmp: 2, open: 3, close: 4, price: 5, listing: 6 });
      let open = g('open'), close = g('close');
      if (open && !close) { const m = open.match(/([A-Za-z]{3,9} \d{1,2}(?:, \d{4})?)\s*(?:[-–—]|to)\s*([A-Za-z]{3,9} \d{1,2}(?:, \d{4})?)/); if (m) { open = m[1]; close = m[2]; } }
      const yr = n.getUTCFullYear(), fy = s => (s && !/\d{4}/.test(s) ? s + ', ' + yr : s);
      open = fy(open); close = fy(close);
      const raw = g('name') || '', name = raw.replace(SUF, '').replace(/\s+/g, ' ').trim(), ex = (raw.match(/NSE\s*SME|BSE\s*SME|Mainboard/i) || [])[0];
      const key0 = a[1].split('/').pop(); if (seen.has(key0)) continue; seen.add(key0);
      const b = band(g('price')), o = dd(open), cl = dd(close);
      const status = o == null || o > 0 ? 'upcoming' : cl >= 0 ? 'open' : 'closed';
      const flag = status === 'closed' ? null : status === 'open' ? (cl === 0 ? 'Closes today' : cl === 1 ? 'Closes tomorrow' : o === 0 ? 'Opens today' : null) : o === 1 ? 'Opens tomorrow' : o === 0 ? 'Opens today' : null;
      const gm = cell(g('gmp')), tent = /tentative/i.test(raw);
      rows.push({ name, url: new URL(a[1], 'https://www.ipopremium.in/').href, key: (name + ' ' + key0).toLowerCase(), type: /sme/i.test(g('type') || '') || /SME/i.test(ex || '') ? 'SME' : 'Mainboard', exch: ex ? ex.replace(/mainboard/i, 'Mainboard').replace(/\s+/, ' ').toUpperCase().replace('MAINBOARD', 'Mainboard') : null, gmp: gm, open, close, price: b && b.price, upper: b && b.upper, lot: cell(g('lot')), issue: cell(g('issue')), allotRaw: g('allot'), listing: g('listing'), status, flag: flag || (tent && status === 'upcoming' ? 'Tentative dates' : null) });
    }
  }
  return rows;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const allot = c => { const t = pd(c); if (isNaN(t)) return null; const d = new Date(t + 864e5); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
async function ipojiCards() {
  const pages = ['', 'ipo/current-ipo', 'sme-ipo/current-ipo', 'ipo/upcoming-ipo', 'sme-ipo/upcoming-ipo', 'ipo/listed-ipo', 'sme-ipo/listed-ipo'];
  const hs = await Promise.all(pages.map(p => get('https://www.ipoji.com/' + p).catch(() => '')));
  const out = new Map();
  hs.forEach(h => {
    const hits = [...h.matchAll(/<a[^>]+href="(?:https:\/\/www\.ipoji\.com)?\/(?:sme-)?ipo\/([a-z0-9-]+)-ipo"[^>]*>([\s\S]*?)<\/a>/g)].filter(m => !NAV.has(m[1]));
    const first = new Map(), label = new Map();
    hits.forEach(m => {
      if (!first.has(m[1])) first.set(m[1], m.index);
      const a = txt(m[2]);
      if (a.length > 2 && a.length < 60 && !/\d{2}|^(view|apply|check allotment)$/i.test(a) && a.length > (label.get(m[1]) || '').length) label.set(m[1], a);
    });
    const order = [...first.entries()].sort((a, b) => a[1] - b[1]);
    order.forEach(([slug, at], i) => {
      if (out.has(slug)) return;
      const t = txt(h.slice(at, Math.min(order[i + 1] ? order[i + 1][1] : at + 1400, at + 1400)));
      const dm = t.match(/([A-Z][a-z]{2} \d{1,2}, \d{4})\s*[–-]\s*([A-Z][a-z]{2} \d{1,2}, \d{4})/);
      const pm = t.match(/(?:Offer|Issue) Price\s*₹\s*([\d,.]+)(?:\s*[-–—]\s*₹?\s*([\d,.]+))?/);
      out.set(slug, { slug, name: label.get(slug) || titleCase(slug), type: /\bSME\b/.test(t) ? 'SME' : 'Mainboard', open: dm && dm[1], close: dm && dm[2],
        price: pm ? (pm[2] && pm[2] !== pm[1] ? `${pm[1]}–${pm[2]}` : pm[1]) : null, upper: pm ? parseFloat((pm[2] || pm[1]).replace(/,/g, '')) : null,
        lot: num(t, /Lot Size\s*([\d,]+)/i), issue: num(t, /Issue Size\s*₹\s*(?:[\d,.]+\s*[-–]\s*)?([\d,.]+)\s*Cr/i), sub: num(t, /Subscription\s*([\d.]+)\s*x/i),
        label: (t.match(/\b(Live|Allotment Awaited|Allotment Out|Upcoming|Listed)\b/) || [])[1] || null });
    });
  });
  return [...out.values()];
}
async function lineup() {
  const [rows, cards] = await Promise.all([premium().catch(() => []), ipojiCards().catch(() => [])]);
  const toks = s => s.toLowerCase().split(/[^a-z0-9]+/).filter(x => x && !STOP.has(x));
  if (rows.length) {
    const used = new Map();
    cards.forEach(c => { const t = toks(c.slug); const r = t.length && rows.filter(x => t.every(y => x.key.includes(y))).sort((a, b) => a.key.length - b.key.length)[0]; if (r && !used.has(r)) used.set(r, c); });
    const items = rows.map(r => { const c = used.get(r) || {}; const { key, ...o } = r; return { ...o, price: o.price ?? c.price ?? null, upper: o.upper ?? c.upper ?? null, lot: o.lot ?? c.lot ?? null, issue: o.issue ?? c.issue ?? null, issueApprox: false, sub: c.sub ?? null, allot: o.allotRaw || allot(r.close), allotRaw: undefined }; });
    return { src: cards.length ? 'IPO Premium and IPO Ji' : 'IPO Premium', items: await enrich(items) };
  }
  const n = new Date(Date.now() + 19800000), today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const dd = s => Math.round((pd(s) - today) / 864e5);
  return { src: 'IPO Ji', items: cards.filter(c => c.open).map(c => { const o = dd(c.open), cl = dd(c.close), status = o > 0 ? 'upcoming' : cl >= 0 ? 'open' : 'closed'; return { name: c.name, type: c.type, exch: null, status, flag: status === 'open' ? (cl === 0 ? 'Closes today' : cl === 1 ? 'Closes tomorrow' : null) : o === 1 ? 'Opens tomorrow' : null, gmp: null, open: c.open, close: c.close, price: c.price, upper: c.upper, lot: c.lot, issue: c.issue, sub: c.sub, listing: null, allot: allot(c.close) }; }) };
}

// IPO Premium's list page fills Lot / Issue Size with JavaScript, so the raw HTML has no values for them.
// The per-IPO detail page does: "Lot Size 13 shares", "Price Band ₹1,066–1,118 ₹0.00 cr issue" and
// "Total Issue Size 27,00,00,000 shares (aggregating up to ₹* Cr)". When the site shows ₹0.00 cr or ₹* Cr
// (amount not published yet) we estimate it as total shares x upper price band and mark it approximate.
function premDetail(t) {
  const pos = v => (v != null && v > 0 ? v : null);
  const lot = pos(num(t, /Lot Size\s*([\d,]+)\s*shares/i));
  const bm = t.match(/Price Band\s*₹\s*([\d,.]+)\s*[–-]\s*₹?\s*([\d,.]+)/i), hi = bm ? parseFloat(bm[2].replace(/,/g, '')) : null;
  let issue = pos(num(t, /₹\s*([\d,.]+)\s*cr\s*issue/i)), approx = false;
  if (issue == null) {
    const sh = pos(num(t, /Total Issue Size\s*([\d,]+)\s*shares/i)) ?? pos(num(t, /(?:Fresh Issue|Offer for Sale)\s*([\d,]+)\s*shares/i));
    if (sh && hi > 0) { issue = Math.round(sh * hi / 1e5) / 100; approx = true; }
  }
  return { lot, issue, issueApprox: approx };
}
async function premPage(url) {
  const t = txt(await get(url)), i = t.indexOf('Subscription Details'), s = i >= 0 ? t.slice(i, i + 1500) : t;
  const row = l => { const m = s.match(new RegExp(l + '\\s+[\\d,]+\\s+[\\d,]+\\s+([\\d.]+)', 'i')); return m ? parseFloat(m[1]) : null; };
  const d = premDetail(t);
  return { qib: row('QIBs?'), nii: row('(?:\\bHNIs?|\\bNII)'), ret: row('(?:Individual|Retail)'), sub: row('Total'), lot: d.lot, issue: d.issue, issueApprox: d.issueApprox || undefined };
}
// Fetch each IPO's detail page (open and upcoming first) to fill Lot and Issue Size. Capped to stay inside
// Cloudflare's subrequest limit (50 on the free plan).
async function enrich(items) {
  const rank = { open: 0, upcoming: 1, closed: 2 };
  const todo = items.filter(i => i.url).sort((a, b) => rank[a.status] - rank[b.status]).slice(0, 32);
  await Promise.all(todo.map(async i => {
    try {
      const d = premDetail(txt(await get(i.url)));
      if (d.lot != null) i.lot = d.lot;
      if (d.issue != null && !d.issueApprox) { i.issue = d.issue; i.issueApprox = false; }
      else if (i.issue == null && d.issue != null) { i.issue = d.issue; i.issueApprox = true; }
    } catch (e) {}
  }));
  return items;
}
const slug = s => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\b(ltd|limited|pvt|private|ipo)\b\.?/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '-');
async function gmpFrom(url, re) { return num(txt(await get(url)), re); }

const rss = async (u, key) => [...(await get(u)).matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>/g)]
  .map(m => ({ title: txt(m[1]), url: txt(m[2]), date: m[3].slice(5, 16) })).filter(n => n.title.toLowerCase().includes(key));
async function news(name, key) {
  const q = name.replace(/\b(ltd|limited)\b\.?/gi, '').trim() + ' IPO';
  const g = 'https://news.google.com/rss/search?hl=en-IN&gl=IN&ceid=IN:en&q=';
  const r = await Promise.allSettled([rss(g + encodeURIComponent(q), key), rss(g + encodeURIComponent(q + ' review subscribe or avoid'), key), rss('https://www.bing.com/news/search?format=rss&q=' + encodeURIComponent(q), key)]);
  const seen = new Set(), out = [];
  r.forEach(x => x.status === 'fulfilled' && x.value.forEach(n => { const k = n.title.toLowerCase().slice(0, 50); if (!seen.has(k)) { seen.add(k); out.push(n); } }));
  if (!out.length && r.every(x => x.status === 'rejected')) throw new Error('news down');
  return out.slice(0, 10);
}

const cagr = a => a && a[0] > 0 && a[2] > 0 ? (Math.pow(a[0] / a[2], .5) - 1) * 100 : null;
const pillar = () => ({ s: 50, pts: [], has: false, add(v, t, g) { this.s += v; this.has = true; this.pts.push({ t, g }); } });
const median = a => { a = [...a].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };

async function research(name, paths, rows = [], widx = []) {
  const t = tokens(name);
  const lm = paths.filter(p => t.every(x => p.includes(x))).sort((a, b) => a.length - b.length)[0];
  const pr = rows.filter(r => t.every(x => r.key.includes(x))).sort((a, b) => a.key.length - b.key.length)[0];
  const g = slug(pr ? pr.name : name);
  const path = lm || `/ipo/${g}-ipo`, base = lm ? lm.split('/').pop().replace(/-ipo$/, '') : g;
  const ws = widx.filter(s => t.every(x => s.includes(x))).sort((a, b) => a.length - b.length)[0] || `${g}-ipo`;
  const alt = path.startsWith('/sme-ipo/') ? path.replace('/sme-ipo/', '/ipo/') : path.replace('/ipo/', '/sme-ipo/');
  const ji0 = async () => { let e0; for (const u of [path, alt]) { try { const o = parseIpoji(await get('https://www.ipoji.com' + u)); if (Object.values(o).some(v => typeof v === 'number' || Array.isArray(v))) return o; e0 = new Error('page had no readable data'); } catch (e) { e0 = e; } } throw e0; };
  const [ji, w, wi, nw, wp, wsub, pp] = await Promise.allSettled([ji0(),
    gmpFrom(`https://ipowatch.in/${ws}-gmp-grey-market-premium/`, /IPO GMP is\s*₹\s*(-?[\d.]+)/i),
    gmpFrom(`https://www.ipoinfo.ai/ipo-gmp/${base}`, /GMP today:\s*\+?₹\s*(-?[\d.]+)/i), news(name, t[0]), watchPage(ws), watchSub(ws), pr ? premPage(pr.url) : Promise.reject(new Error('no match'))]);
  const p0 = ji.status === 'fulfilled' ? ji.value : {};
  const clean = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null));
  const ppv = clean(pp.value);
  if (ppv.issueApprox && (p0.issue != null || (wp.value && wp.value.issue != null))) { delete ppv.issue; delete ppv.issueApprox; }  // keep a published issue size over an estimate
  const p = { ...clean(wp.value), ...clean(wsub.value), ...clean(p0), ...ppv };
  const up0 = p.upper ?? (pr && pr.upper);
  if (p.pe == null && p.eps && up0) { p.pe = +(up0 / p.eps).toFixed(1); p.approx = true; }
  if (p.pb == null && p.nav && up0) { p.pb = +(up0 / p.nav).toFixed(2); p.approx = true; }
  const items = nw.status === 'fulfilled' ? nw.value : [];
  const ok = x => x.status === 'fulfilled' && x.value != null;
  const gl = [p.gmp, ok(w) ? w.value : null, ok(wi) ? wi.value : null, pr ? pr.gmp : null].filter(v => v != null);
  const gmp = gl.length ? median(gl) : null, spread = gl.length > 1 ? Math.max(...gl) - Math.min(...gl) : 0;
  const upper = p.upper ?? (pr && pr.upper) ?? null;
  const gmpPct = gmp != null && upper ? +(gmp / upper * 100).toFixed(1) : p.gmpPct ?? null;
  // Gather what each source returned, then show the comparison and the value used.
  const raw = { ipoji: clean(p0), watch: { ...clean(wp.value), ...clean(wsub.value), ...(ok(w) ? { gmp: w.value } : {}) }, premium: pr ? { ...clean({ gmp: pr.gmp, upper: pr.upper }), ...clean(pp.value) } : {}, ipoinfo: ok(wi) ? { gmp: wi.value } : {} };
  const SRC = ['ipoji', 'watch', 'premium', 'ipoinfo'];
  const cover = Object.fromEntries(SRC.map(s => [s, Object.values(raw[s]).filter(v => typeof v === 'number' || Array.isArray(v)).length]));
  const why = (r, ok2, n) => r.status === 'rejected' ? 'failed (' + String((r.reason && r.reason.message) || r.reason).slice(0, 40) + ')' : n;
  const has = (re) => items.filter(i => re.test(i.title)).length;
  const pos = has(/\b(subscribe|apply|positive|strong|bumper|robust|bullish|premium|oversubscribed|surge|jump)/i), neg = has(/\b(avoid|skip|weak|tepid|muted|discount|risk|cautious|neutral|flat|slump)/i);
  const sb = has(/\bsubscribe\b/i), av = has(/\b(avoid|skip)\b/i);
  const checked = [
    { site: 'IPO Ji', ok: ji.status === 'fulfilled' && cover.ipoji > 0, note: why(ji, 0, cover.ipoji + ' values') },
    { site: 'IPO Watch', ok: cover.watch > 0, note: why(wp, 0, cover.watch + ' values') },
    { site: 'IPO Premium', ok: !!pr && cover.premium > 0, note: pr ? why(pp, 0, cover.premium + ' values') : rows.length ? 'not in lineup' : 'lineup unavailable' },
    { site: 'IPOInfo', ok: ok(wi), note: why(wi, 0, ok(wi) ? '1 value' : 'no GMP') },
    { site: 'News', ok: items.length > 0, note: why(nw, 0, items.length + ' headlines') }];

  const F = pillar(), V = pillar(), D = pillar(), S = pillar();
  const rc = cagr(p.rev), pc = cagr(p.pat);
  if (rc != null) F.add(rc >= 25 ? 15 : rc >= 10 ? 8 : rc < 0 ? -15 : 0, `Revenue grew about ${rc.toFixed(0)}% a year (₹${p.rev[2]} Cr to ₹${p.rev[0]} Cr)`, rc >= 10 ? true : rc < 0 ? false : null);
  if (pc != null) F.add(pc >= 25 ? 15 : pc >= 10 ? 8 : pc < 0 ? -15 : 0, `Profit grew about ${pc.toFixed(0)}% a year (₹${p.pat[2]} Cr to ₹${p.pat[0]} Cr)`, pc >= 10 ? true : pc < 0 ? false : null);
  if (p.patm != null) F.add(p.patm >= 10 ? 8 : p.patm >= 5 ? 3 : p.patm < 3 ? -8 : 0, `Profit margin ${p.patm}%`, p.patm >= 8 ? true : p.patm < 3 ? false : null);
  if (p.roe != null) F.add(p.roe >= 20 ? 8 : p.roe < 10 ? -8 : 0, `Return on equity ${p.roe}%`, p.roe >= 15 ? true : p.roe < 10 ? false : null);
  if (p.de != null) F.add(p.de <= .5 ? 5 : p.de > 1 ? -10 : 0, `Debt to equity ${p.de}`, p.de <= .5 ? true : p.de > 1 ? false : null);
  if (p.pe != null) V.add(p.pe <= 15 ? 30 : p.pe <= 25 ? 15 : p.pe <= 40 ? 0 : -25, `P/E ${p.approx ? 'is about ' : 'after IPO is '}${p.pe}${p.pe <= 25 ? ', fairly priced' : p.pe > 40 ? ', expensive' : ''}`, p.pe <= 25 ? true : p.pe > 40 ? false : null);
  if (p.pb != null) V.add(p.pb <= 3 ? 8 : p.pb > 8 ? -10 : 0, `Price to book ${p.pb}`, p.pb <= 3 ? true : p.pb > 8 ? false : null);
  if (p.pe != null && pc > 0) { const g = p.pe / pc; V.add(g <= 1 ? 10 : g >= 2.5 ? -8 : 0, `P/E is ${g.toFixed(1)}x the profit growth rate${g <= 1 ? ', cheap for its growth' : ''}`, g <= 1 ? true : g >= 2.5 ? false : null); }
  if (gmpPct != null) D.add(clamp(gmpPct * 1.2, -40, 40), `GMP ₹${gmp} (${gmpPct}%)${gl.length > 1 ? ' across ' + gl.length + ' sources' : ''}${spread > Math.max(5, gmp * .25) ? ', sources disagree' : ''}`, gmpPct >= 10 ? true : gmpPct <= 0 ? false : null);
  if (p.sub != null) D.add(p.sub >= 50 ? 15 : p.sub >= 10 ? 10 : p.sub >= 2 ? 5 : p.sub < 1 ? -10 : 0, `Subscribed ${p.sub}x overall`, p.sub >= 10 ? true : p.sub < 1 ? false : null);
  if (p.qib != null && p.qib >= 20) D.add(5, `Big institutions bid ${p.qib}x`, true);
  if (items.length) S.add(clamp((pos - neg) * 8, -20, 20), `News tone: ${pos} positive vs ${neg} cautious headlines`, pos > neg ? true : neg > pos ? false : null);
  if (sb + av) S.add(clamp((sb - av) * 8, -20, 20), `Review headlines: ${sb} say subscribe, ${av} say avoid`, sb > av ? true : av > sb ? false : null);
  const pl = { fin: [F, .30], val: [V, .20], dem: [D, .35], sen: [S, .15] }, act = Object.values(pl).filter(([x]) => x.has);
  const score = act.length ? Math.round(clamp(act.reduce((a, [x, k]) => a + clamp(x.s, 0, 100) * k, 0) / act.reduce((a, [, k]) => a + k, 0), 0, 100)) : 50;
  const call = !act.length ? 'No data' : score >= 65 ? 'Apply' : score >= 45 ? 'Maybe' : 'Skip';
  const all = act.flatMap(([x]) => x.pts), good = all.filter(x => x.g === true), bad = all.filter(x => x.g === false);
  const verdict = !act.length ? 'Nothing found. Check the spelling against the exact name on IPO Ji.' : `${call === 'Apply' ? 'Data signals are mostly strong' : call === 'Maybe' ? 'Data signals are mixed' : 'Data signals are mostly weak'}. ${good[0] ? 'Strongest point: ' + good[0].t + '. ' : ''}${bad[0] ? 'Weakest point: ' + bad[0].t + '.' : 'No major weak points in the data found.'}`;
  const out = {}; Object.entries(pl).forEach(([k, [x]]) => out[k] = { score: x.has ? Math.round(clamp(x.s, 0, 100)) : null, pts: x.pts });
  const pages = [{ title: 'IPO Ji: financials, GMP, subscription', url: 'https://www.ipoji.com' + path }, { title: 'IPO Watch: IPO details', url: `https://ipowatch.in/${ws}/` }, { title: 'IPO Watch: GMP history', url: `https://ipowatch.in/${ws}-gmp-grey-market-premium/` }, { title: 'IPOInfo: GMP', url: `https://www.ipoinfo.ai/ipo-gmp/${base}` }, { title: 'Chittorgarh: search', url: 'https://www.chittorgarh.com/search/?q=' + encodeURIComponent(name) }];
  return { name: (pr && pr.name) || p.full || name, query: name, score, call, verdict, confidence: act.length >= 4 ? 'High' : act.length >= 3 ? 'Medium' : 'Low', ...p, gmp, gmpPct, upper, status: p.status || (p.open ? stat(p.open, p.close) : null) || (pr && { open: 'Open now', upcoming: 'Upcoming', closed: 'Bidding closed' }[pr.status]) || null, dates: p.dates || (p.open ? p.open + ' to ' + p.close : null) || (pr && pr.open ? pr.open + ' to ' + pr.close : null), pillars: out, news: items, checked, pages };
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...H, 'access-control-allow-headers': '*' } });
    const u = new URL(req.url);
    if (u.pathname === '/api/lineup') {
      // Cache the enriched lineup for 10 minutes so the ~30 detail-page reads do not run on every visit.
      const ck = new Request('https://cache.ipo-checker.local/lineup-v2'), cache = caches.default;
      if (!u.searchParams.has('refresh')) { const hit = await cache.match(ck); if (hit) return new Response(hit.body, { headers: { ...H, 'cache-control': 'public, max-age=600', 'x-cache': 'hit' } }); }
      const data = await lineup().catch(() => ({ items: [] }));
      const res = new Response(JSON.stringify(data), { headers: { ...H, 'cache-control': 'public, max-age=600' } });
      if (data.items && data.items.length) ctx.waitUntil(cache.put(ck, res.clone()));
      return res;
    }
    if (u.pathname !== '/api/research') return new Response(JSON.stringify({ ok: true, usage: '/api/research?names=A|B|C' }), { headers: H });
    const names = (u.searchParams.get('names') || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 5);
    const [paths, rows, widx] = await Promise.all([listing().catch(() => []), premium().catch(() => []), watchIndex().catch(() => [])]);
    const data = await Promise.all(names.map(n => research(n, paths, rows, widx).catch(e => ({ name: n, score: 0, call: 'No data', verdict: 'Something went wrong.', pillars: {}, news: [], checked: [], pages: [], error: String(e) }))));
    return new Response(JSON.stringify(data), { headers: H });
  }
};
