// Cloudflare Worker: reads public IPO pages (IPO Ji, IPO Watch) + Google News headlines. No API keys.
const H = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'en-IN,en;q=0.9' };
const txt = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!\[CDATA\[|\]\]>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&lt;|&gt;/g, ' ').replace(/\s+/g, ' ').trim();
const get = async u => { const r = await fetch(u, { headers: UA, cf: { cacheTtl: 300, cacheEverything: true } }); if (!r.ok) throw new Error(r.status); return r.text(); };
const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/,/g, '')) : null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const STOP = new Set(['ltd', 'limited', 'pvt', 'private', 'ipo', 'india', 'the', 'and', 'of']);
const tokens = n => { const t = n.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)); return t.length ? t : n.toLowerCase().split(/\s+/).filter(Boolean); };

async function listing() {
  const pages = [...(pr ? [{ title: 'IPO Premium: GMP and dates', url: pr.url }] : []), 'ipo/current-ipo', 'ipo/upcoming-ipo', 'ipo/listed-ipo', 'sme-ipo/current-ipo', 'sme-ipo/upcoming-ipo'];
  const hs = await Promise.all(pages.map(p => get('https://www.ipoji.com/' + p).catch(() => '')));
  const set = new Set();
  hs.forEach(h => { for (const m of h.matchAll(/href="(?:https:\/\/www\.ipoji\.com)?(\/(?:sme-)?ipo\/[a-z0-9-]+-ipo)"/g)) set.add(m[1]); });
  return [...set];
}

const tri = (t, re) => { const m = t.match(re); return m ? [1, 2, 3].map(i => parseFloat(m[i].replace(/,/g, ''))) : null; };
const heads = s => s ? [...s.matchAll(/([A-Z][\w&,'\/ -]{4,70}?):\s/g)].map(m => m[1].trim()).slice(0, 4) : [];
function parseIpoji(h) {
  const t = txt(h);
  const d = t.match(/IPO Dates\s*([A-Za-z]+ \d+, \d{4})\s*[–-]\s*([A-Za-z]+ \d+, \d{4})/);
  let status = null;
  if (d) { const now = Date.now(), o = Date.parse(d[1]), c = Date.parse(d[2]) + 864e5; status = now < o ? 'Upcoming' : now < c ? 'Open now' : 'Bidding closed'; }
  const ab = t.match(/About\s+([A-Z][A-Za-z0-9&.,'() -]{2,60}?\s(?:Limited|Ltd\.?))/);
  const ti = (h.match(/<title>\s*([^<]+?)\s*<\/title>/i) || [])[1];
  let full = ab ? ab[1].trim() : ti ? txt(ti).split(/\s[|–-]\s/)[0].replace(/\s+(SME\s+)?IPO\b.*$/i, '').trim() : null;
  if (full && (full.length > 70 || full.length < 3)) full = null;
  return {
    full,
    gmp: num(t, /IPO GMP Today:\s*₹\s*(-?[\d,.]+)/i),
    gmpPct: num(t, /GMP percentage\s*(-?[\d.]+)\s*%/i),
    upper: num(t, /Upper price band\s*₹\s*([\d,.]+)/i) ?? num(t, /Price band\s*₹\s*[\d,.]+\s*[-–]\s*₹?\s*([\d,.]+)/i),
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

const SUF = /\s*\((?:Mainboard|NSE SME|BSE SME|Tentative date)\)/gi;
async function premium() {
  const h = await get('https://www.ipopremium.in/');
  const n = new Date(Date.now() + 19800000), today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const dd = s => { const t = Date.parse(s); return isNaN(t) ? null : Math.round((t - today) / 864e5); };
  const rows = [];
  for (const m of h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const a = m[1].match(/href="([^"]*\/view\/ipo\/[^"]+)"/); if (!a) continue;
    const c = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(x => txt(x[1]));
    if (c.length < 7) continue;
    const name = c[0].replace(SUF, '').trim(), ex = (c[0].match(/\((NSE SME|BSE SME|Mainboard)\)/i) || [])[1];
    const o = dd(c[3]), cl = dd(c[4]), pr = c[5].match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/), up = pr ? +pr[2] : 0;
    const status = o == null || o > 0 ? 'upcoming' : cl >= 0 ? 'open' : 'closed';
    const flag = status === 'closed' ? null : status === 'open' ? (cl === 0 ? 'Closes today' : cl === 1 ? 'Closes tomorrow' : o === 0 ? 'Opens today' : null) : o === 1 ? 'Opens tomorrow' : null;
    const g = parseFloat(c[2]);
    rows.push({ name, url: a[1], key: (name + ' ' + a[1].split('/').pop()).toLowerCase(), type: c[1].trim() === 'SME' ? 'SME' : 'Mainboard', exch: ex ? ex.replace(/mainboard/i, 'Mainboard') : null, gmp: isNaN(g) ? null : g, open: c[3], close: c[4], price: up ? `${pr[1]}–${pr[2]}` : null, upper: up || null, listing: c[6], status, flag });
  }
  return rows;
}
async function lineup() {
  const rows = await premium().catch(() => []);
  if (rows.length) return { src: 'IPO Premium', items: rows.map(({ key, ...r }) => r) };
  const o = await lineupIpoji();
  return { src: 'IPO Ji', items: Object.entries(o).flatMap(([k, a]) => a.map(i => { const [op, cl] = (i.dates || '').split(' to '); return { name: i.name, type: i.sme ? 'SME' : 'Mainboard', status: k, open: op || null, close: cl || null, flag: i.flag, gmp: null, price: null, listing: null }; })) };
}

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

async function research(name, paths, rows = []) {
  const t = tokens(name);
  const path = paths.filter(p => t.every(w => p.includes(w))).sort((a, b) => a.length - b.length)[0] || `/ipo/${t.join('-')}-ipo`;
  const base = path.split('/').pop().replace(/-ipo$/, '');
  const pr = rows.filter(r => t.every(x => r.key.includes(x))).sort((a, b) => a.key.length - b.key.length)[0];
  const [ji, w, wi, nw] = await Promise.allSettled([get('https://www.ipoji.com' + path).then(parseIpoji),
    gmpFrom(`https://ipowatch.in/${base}-ipo-gmp-grey-market-premium/`, /IPO GMP is\s*₹\s*(-?[\d.]+)/i),
    gmpFrom(`https://www.ipoinfo.ai/ipo-gmp/${base}`, /GMP today:\s*\+?₹\s*(-?[\d.]+)/i), news(name, t[0])]);
  const p = ji.status === 'fulfilled' ? ji.value : {};
  const items = nw.status === 'fulfilled' ? nw.value : [];
  const ok = x => x.status === 'fulfilled' && x.value != null;
  const gl = [p.gmp, ok(w) ? w.value : null, ok(wi) ? wi.value : null, pr ? pr.gmp : null].filter(v => v != null);
  const gmp = gl.length ? median(gl) : null, spread = gl.length > 1 ? Math.max(...gl) - Math.min(...gl) : 0;
  const upper = p.upper ?? (pr && pr.upper) ?? null;
  const gmpPct = gmp != null && upper ? +(gmp / upper * 100).toFixed(1) : p.gmpPct ?? null;
  const has = (re) => items.filter(i => re.test(i.title)).length;
  const pos = has(/\b(subscribe|apply|positive|strong|bumper|robust|bullish|premium|oversubscribed|surge|jump)/i), neg = has(/\b(avoid|skip|weak|tepid|muted|discount|risk|cautious|neutral|flat|slump)/i);
  const sb = has(/\bsubscribe\b/i), av = has(/\b(avoid|skip)\b/i);
  const checked = [{ site: 'IPO Ji', ok: ji.status === 'fulfilled' && (p.gmp != null || p.sub != null || p.rev != null) }, { site: 'IPO Premium', ok: !!pr }, { site: 'IPO Watch', ok: ok(w) }, { site: 'IPOInfo', ok: ok(wi) }, { site: 'News', ok: items.length > 0 }];

  const F = pillar(), V = pillar(), D = pillar(), S = pillar();
  const rc = cagr(p.rev), pc = cagr(p.pat);
  if (rc != null) F.add(rc >= 25 ? 15 : rc >= 10 ? 8 : rc < 0 ? -15 : 0, `Revenue grew about ${rc.toFixed(0)}% a year (₹${p.rev[2]} Cr to ₹${p.rev[0]} Cr)`, rc >= 10 ? true : rc < 0 ? false : null);
  if (pc != null) F.add(pc >= 25 ? 15 : pc >= 10 ? 8 : pc < 0 ? -15 : 0, `Profit grew about ${pc.toFixed(0)}% a year (₹${p.pat[2]} Cr to ₹${p.pat[0]} Cr)`, pc >= 10 ? true : pc < 0 ? false : null);
  if (p.patm != null) F.add(p.patm >= 10 ? 8 : p.patm >= 5 ? 3 : p.patm < 3 ? -8 : 0, `Profit margin ${p.patm}%`, p.patm >= 8 ? true : p.patm < 3 ? false : null);
  if (p.roe != null) F.add(p.roe >= 20 ? 8 : p.roe < 10 ? -8 : 0, `Return on equity ${p.roe}%`, p.roe >= 15 ? true : p.roe < 10 ? false : null);
  if (p.de != null) F.add(p.de <= .5 ? 5 : p.de > 1 ? -10 : 0, `Debt to equity ${p.de}`, p.de <= .5 ? true : p.de > 1 ? false : null);
  if (p.pe != null) V.add(p.pe <= 15 ? 30 : p.pe <= 25 ? 15 : p.pe <= 40 ? 0 : -25, `P/E after IPO is ${p.pe}${p.pe <= 25 ? ', fairly priced' : p.pe > 40 ? ', expensive' : ''}`, p.pe <= 25 ? true : p.pe > 40 ? false : null);
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
  const pages = [{ title: 'IPO Ji: financials, GMP, subscription', url: 'https://www.ipoji.com' + path }, { title: 'IPO Watch: GMP history', url: `https://ipowatch.in/${base}-ipo-gmp-grey-market-premium/` }, { title: 'IPOInfo: GMP', url: `https://www.ipoinfo.ai/ipo-gmp/${base}` }, { title: 'Chittorgarh: search', url: 'https://www.chittorgarh.com/search/?q=' + encodeURIComponent(name) }];
  return { name: (pr && pr.name) || p.full || name, query: name, score, call, verdict, confidence: act.length >= 4 ? 'High' : act.length >= 3 ? 'Medium' : 'Low', ...p, gmp, gmpPct, upper, status: p.status || (pr && { open: 'Open now', upcoming: 'Upcoming', closed: 'Bidding closed' }[pr.status]) || null, dates: p.dates || (pr && pr.open ? pr.open + ' to ' + pr.close : null), pillars: out, news: items, checked, pages };
}

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...H, 'access-control-allow-headers': '*' } });
    const u = new URL(req.url);
    if (u.pathname === '/api/lineup') return new Response(JSON.stringify(await lineup().catch(() => ({ open: [], upcoming: [], closed: [] }))), { headers: { ...H, 'cache-control': 'public, max-age=600' } });
    if (u.pathname !== '/api/research') return new Response(JSON.stringify({ ok: true, usage: '/api/research?names=A|B|C' }), { headers: H });
    const names = (u.searchParams.get('names') || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 5);
    const [paths, rows] = await Promise.all([listing().catch(() => []), premium().catch(() => [])]);
    const data = await Promise.all(names.map(n => research(n, paths, rows).catch(e => ({ name: n, score: 0, call: 'No data', verdict: 'Something went wrong.', pillars: {}, news: [], checked: [], pages: [], error: String(e) }))));
    return new Response(JSON.stringify(data), { headers: H });
  }
};
