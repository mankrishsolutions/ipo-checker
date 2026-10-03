// Cloudflare Worker: reads public IPO pages (IPO Ji, IPO Watch) + Google News headlines. No API keys.
const H = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'accept-language': 'en-IN,en;q=0.9' };
const txt = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!\[CDATA\[|\]\]>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&lt;|&gt;/g, ' ').replace(/\s+/g, ' ').trim();
const get = async u => { const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(r.status); return r.text(); };
const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace(/,/g, '')) : null; };
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

function parseIpoji(h) {
  const t = txt(h);
  const d = t.match(/IPO Dates\s*([A-Za-z]+ \d+, \d{4})\s*[–-]\s*([A-Za-z]+ \d+, \d{4})/);
  let status = null;
  if (d) { const now = Date.now(), o = Date.parse(d[1]), c = Date.parse(d[2]) + 864e5; status = now < o ? 'Upcoming' : now < c ? 'Open now' : 'Bidding closed'; }
  return {
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
    dates: d ? d[1] + ' to ' + d[2] : null, status
  };
}

async function watchGmp(base) {
  const t = txt(await get(`https://ipowatch.in/${base}-ipo-gmp-grey-market-premium/`));
  return num(t, /IPO GMP is\s*₹\s*(-?[\d.]+)/i) ?? num(t, /GMP is\s*₹\s*(-?[\d.]+)/i);
}

async function news(name, key) {
  const q = name.replace(/\b(ltd|limited)\b\.?/gi, '').trim() + ' IPO';
  const x = await get('https://news.google.com/rss/search?hl=en-IN&gl=IN&ceid=IN:en&q=' + encodeURIComponent(q));
  return [...x.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>/g)]
    .map(m => ({ title: txt(m[1]), url: txt(m[2]), date: m[3].slice(5, 16) }))
    .filter(n => n.title.toLowerCase().includes(key)).slice(0, 8);
}

async function research(name, paths) {
  const t = tokens(name);
  const path = paths.filter(p => t.every(w => p.includes(w))).sort((a, b) => a.length - b.length)[0] || `/ipo/${t.join('-')}-ipo`;
  const base = path.split('/').pop().replace(/-ipo$/, '');
  const [ji, w, nw] = await Promise.allSettled([get('https://www.ipoji.com' + path).then(parseIpoji), watchGmp(base), news(name, t[0])]);
  const checked = [{ site: 'IPO Ji', ok: ji.status === 'fulfilled' && ji.value.gmp != null || ji.status === 'fulfilled' && ji.value.sub != null }, { site: 'IPO Watch', ok: w.status === 'fulfilled' && w.value != null }, { site: 'Google News', ok: nw.status === 'fulfilled' && nw.value.length > 0 }];
  const p = ji.status === 'fulfilled' ? ji.value : {};
  const items = nw.status === 'fulfilled' ? nw.value : [];
  const gmps = [p.gmp, w.status === 'fulfilled' ? w.value : null].filter(v => v != null);
  const gmp = gmps.length ? gmps[0] : null;
  const gmpPct = p.gmpPct ?? (gmp != null && p.upper ? +(gmp / p.upper * 100).toFixed(1) : null);
  const pos = items.filter(i => /\b(subscribe|apply|positive|strong|bumper|robust|bullish|premium|oversubscribed|surge|jump)/i.test(i.title)).length;
  const neg = items.filter(i => /\b(avoid|skip|weak|tepid|muted|discount|risk|cautious|neutral|flat|slump)/i.test(i.title)).length;

  let s = 50, why = [], sig = 0;
  if (gmpPct != null) { s += clamp(gmpPct, -25, 30); sig++; why.push(`GMP ₹${gmp} (${gmpPct}%): ${gmpPct >= 20 ? 'strong' : gmpPct >= 8 ? 'decent' : gmpPct > 0 ? 'weak' : 'no premium'}`); }
  if (p.sub != null) { s += p.sub >= 50 ? 15 : p.sub >= 10 ? 10 : p.sub >= 2 ? 5 : p.sub < 1 ? -10 : 0; sig++; why.push(`Subscribed ${p.sub}x overall: ${p.sub >= 50 ? 'very heavy demand' : p.sub >= 10 ? 'strong demand' : p.sub >= 2 ? 'ok demand' : 'weak demand'}`); }
  if (p.pe != null) { s += p.pe <= 20 ? 5 : p.pe >= 40 ? -5 : 0; sig++; why.push(`P/E ${p.pe}: ${p.pe <= 20 ? 'reasonably priced' : p.pe >= 40 ? 'expensive' : 'fair'}`); }
  if (p.roe != null) { s += p.roe >= 20 ? 5 : 0; why.push(`ROE ${p.roe}%`); }
  if (p.de != null && p.de > 1) { s -= 5; why.push(`Debt/equity ${p.de}: high`); }
  if (items.length) { s += clamp((pos - neg) * 2, -10, 10); sig++; why.push(`News tone: ${pos} positive vs ${neg} cautious headlines`); }
  s = Math.round(clamp(s, 0, 100));
  const call = !sig ? 'No data' : s >= 65 ? 'Apply' : s >= 45 ? 'Maybe' : 'Skip';
  const pages = [{ title: 'IPO Ji: ' + name, url: 'https://www.ipoji.com' + path }, { title: 'IPO Watch GMP history', url: `https://ipowatch.in/${base}-ipo-gmp-grey-market-premium/` }, { title: 'Chittorgarh IPO search', url: 'https://www.chittorgarh.com/search/?q=' + encodeURIComponent(name) }];
  return { name, score: s, call, ...p, gmp, gmpPct, pos, neg, why, news: items, checked, pages };
}

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...H, 'access-control-allow-headers': '*' } });
    const u = new URL(req.url);
    if (u.pathname !== '/api/research') return new Response(JSON.stringify({ ok: true, usage: '/api/research?names=A|B|C' }), { headers: H });
    const names = (u.searchParams.get('names') || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 5);
    const paths = await listing().catch(() => []);
    const data = await Promise.all(names.map(n => research(n, paths).catch(e => ({ name: n, score: 0, call: 'No data', why: [], news: [], checked: [], pages: [], error: String(e) }))));
    return new Response(JSON.stringify(data), { headers: H });
  }
};
