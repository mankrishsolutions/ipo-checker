// Change this if your worker URL differs.
const WORKER = 'https://ipos.mankrishsolutions.workers.dev';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, p = '', s = '') => v == null ? 'n/a' : p + v + s;
const DISC = '<b>Research only, not advice.</b> This is not a suggestion to apply or not to apply for any IPO. Scores only summarise data found on public websites, which can be wrong, delayed or incomplete. Verify on the source pages and speak to a SEBI-registered advisor before investing.';
let names = [];

function drawChips() {
  $('#chips').innerHTML = names.map((n, i) => `<span class="chip">${esc(n)}<button data-i="${i}" aria-label="Remove ${esc(n)}">×</button></span>`).join('');
}
function add(v) { v = v.trim(); if (v && names.length < 5 && !names.includes(v)) { names.push(v); drawChips(); } }
$('#name').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(e.target.value); e.target.value = ''; } });
$('#chips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { names.splice(+b.dataset.i, 1); drawChips(); drawLine(); } });
const body = document.body, open = v => body.classList.toggle('open', v);
$('#menu').addEventListener('click', () => open(!body.classList.contains('open')));
$('#scrim').addEventListener('click', () => open(false));
$('#edge').addEventListener('mouseenter', () => open(true));
$('#drawer').addEventListener('mouseleave', () => open(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });
document.querySelectorAll('.nav').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.nav,.view').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); $('#' + b.dataset.view).classList.add('on');
  if (b.dataset.view === 'history') drawHistory();
  open(false); scrollTo(0, 0);
}));

const KC = [['#B5D4F4', '#042C53'], ['#CECBF6', '#26215C'], ['#9FE1CB', '#04342C'], ['#F4C0D1', '#4B1528'], ['#FAC775', '#412402'], ['#C0DD97', '#173404']];
const PC = [['dem', 'Market demand', '#1D9E75', '#04342C'], ['fin', 'Financials', '#378ADD', '#042C53'], ['val', 'Valuation', '#EF9F27', '#412402'], ['sen', 'News and reviews', '#D4537E', '#4B1528']];
const BAND = { Apply: '#CFF54A', Maybe: '#FFCFA8', Skip: '#FFB3DE', 'No data': '#E6E1F8' };
let R = [], tab = 'all';
const short = n => n.replace(/\b(ltd|limited)\b\.?/gi, '').trim();

const FS = [['Revenue', 'rev', '#378ADD'], ['Profit', 'pat', '#1D9E75'], ['Net worth', 'nw', '#7F77DD']];
let fq = 0;
function chart(d, q = 0) {
  const a = d[FS[q][1]];
  if (!a) return `<p class="sub">${FS[q][0]} history was not found for this company.</p>`;
  const s = [...a].reverse(), m = Math.max(...s), col = FS[q][2];
  let o = `<svg viewBox="0 0 600 160" width="100%" role="img"><title>${FS[q][0]} over three years</title>`;
  ['Year −2', 'Year −1', 'Latest'].forEach((l, y) => {
    const h = Math.max(8, s[y] / m * 100), x = 70 + y * 190, g = y && s[y - 1] > 0 ? (s[y] / s[y - 1] - 1) * 100 : null;
    o += `<rect x="${x}" y="${125 - h}" width="90" height="${h}" rx="8" fill="${col}"/><text x="${x + 45}" y="${118 - h}" text-anchor="middle" font-size="14" font-weight="700" fill="#17133B">₹${Math.round(s[y] * 10) / 10} Cr</text><text x="${x + 45}" y="148" text-anchor="middle" font-size="12" fill="#6B6890">${l}</text>`;
    if (g != null && h > 28) o += `<text x="${x + 45}" y="${125 - h + 18}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${g >= 0 ? '+' : ''}${g.toFixed(0)}%</text>`;
  });
  return o + '</svg>';
}

function company(d) {
  const pl = d.pillars || {}, kp = [['GMP', fmt(d.gmp, '₹') + (d.gmpPct != null ? ` (${d.gmpPct}%)` : '')], ['Price band', fmt(d.upper, '₹')], ['Subscribed', fmt(d.sub, '', 'x')], ['QIB · NII · Retail', [d.qib, d.nii, d.ret].map(v => fmt(v, '', 'x')).join(' · ')], ['P/E · P/B', `${fmt(d.pe)} · ${fmt(d.pb)}`], ['ROE · D/E', `${fmt(d.roe, '', '%')} · ${fmt(d.de)}`]];
  const pts = PC.flatMap(p => (pl[p[0]] && pl[p[0]].pts) || []);
  const list = (a, ic) => (a && a.length ? a.map(x => `<div class="l">${ic} ${esc(x)}</div>`).join('') : '<div class="l">Not found.</div>');
  return `<div class="ph"><div><h2>${esc(d.name)}</h2><small>${[d.status, d.dates, 'Confidence: ' + (d.confidence || 'Low'), d.issue ? 'Issue ₹' + d.issue + ' Cr' : ''].filter(Boolean).map(esc).join(' · ')}</small></div><div class="pill">Score ${d.score}/100</div></div>
  <p class="verdict">${esc(d.verdict)}${d.status === 'Bidding closed' ? ' Bidding has closed, so read this as a listing-day view.' : ''}</p>
  <div class="kpis">${kp.map((k, i) => `<div class="k" style="background:${KC[i][0]};color:${KC[i][1]}"><small>${k[0]}</small><b>${esc(k[1])}</b></div>`).join('')}</div>
  <div class="c sbox"><h3>Score breakdown</h3><div class="sb">${PC.map(p => { const v = pl[p[0]] && pl[p[0]].score; return `<div class="sr"><span>${p[1]}</span><div><i style="width:${v ?? 0}%;background:${p[2]}"></i></div><b>${v ?? '–'}</b></div>`; }).join('')}</div></div>
  <div class="c fin"><div class="fh"><h3>Financials, last 3 years (₹ Cr)</h3><div class="ftabs">${FS.map((f, i) => `<button class="ft${i === fq ? ' on' : ''}" data-f="${i}" style="--c:${f[2]}">${f[0]}</button>`).join('')}</div></div><div id="fchart">${chart(d, fq)}</div></div>
  <div class="grid2"><div class="c good"><h3>Strengths</h3>${list(d.strengths, '✓')}</div><div class="c bad"><h3>Risks</h3>${list(d.risks, '✗')}</div></div>
  <div class="grid">${pts.length ? `<div class="c"><h3>Reasons behind the score</h3><ul class="pts">${pts.map(x => `<li class="${x.g === true ? 't' : x.g === false ? 'f' : ''}">${esc(x.t)}</li>`).join('')}</ul></div>` : ''}
  <div class="c"><h3>Latest news and analyst views</h3>${d.news && d.news.length ? `<ul class="srcs">${d.news.map(n => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a> <small>${esc(n.date)}</small></li>`).join('')}</ul>` : '<p class="sub">No recent headlines found.</p>'}</div>
  <div class="c"><h3>Source pages</h3><ul class="srcs">${(d.pages || []).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>
  <p class="chk">${(d.checked || []).map(x => `<span class="${x.ok ? 'ok' : 'no'}">${x.ok ? '✓' : '✗'} ${esc(x.site)}</span>`).join('')}</p></div></div>
  ${d.error ? `<p class="sub">Error: ${esc(d.error)}</p>` : ''}`;
}

function overview() {
  return `<h2>Ranked by research score</h2><ol class="pod">${R.map((d, i) => `<li data-t="${i}" style="--c:${BAND[d.call] || BAND['No data']}"><span class="n big">#${i + 1}</span><span class="nm">${esc(short(d.name))}<small>${esc(d.status || 'Tap for details')}</small></span><div class="ring" style="--s:${d.score}"><span>${d.score}</span></div></li>`).join('')}</ol>`;
}

function draw() {
  const t = R.map((d, i) => `<button class="tab${tab === String(i) ? ' on' : ''}" data-t="${i}">${esc(short(d.name))} · ${d.score}</button>`).join('');
  $('#out').innerHTML = `<div class="tabs"><button class="tab${tab === 'all' ? ' on' : ''}" data-t="all">Overview</button>${t}<button class="tab add" data-t="add">+ Add</button></div>${tab === 'all' ? overview() : company(R[+tab])}`;
}

function render(data) {
  R = data.sort((a, b) => b.score - a.score); tab = R.length > 1 ? 'all' : '0'; draw();
  $('#check').classList.add('done'); $('#check').classList.remove('edit'); document.body.classList.add('done');
  try {
    const h = JSON.parse(localStorage.getItem('ipo_hist') || '[]');
    h.unshift({ t: new Date().toLocaleString(), r: R.map(d => ({ name: d.name, score: d.score, call: d.call })) });
    localStorage.setItem('ipo_hist', JSON.stringify(h.slice(0, 20)));
  } catch (e) {}
}

$('#out').addEventListener('click', e => {
  const f = e.target.closest('[data-f]');
  if (f) { fq = +f.dataset.f; document.querySelectorAll('.ft').forEach(x => x.classList.toggle('on', x === f)); $('#fchart').innerHTML = chart(R[+tab], fq); return; }
  const b = e.target.closest('[data-t]'); if (!b) return;
  if (b.dataset.t === 'add') { $('#check').classList.add('edit'); $('#name').focus(); scrollTo({ top: 0, behavior: 'smooth' }); return; }
  tab = b.dataset.t; draw(); $('#out').scrollIntoView({ behavior: 'smooth' });
});

function drawHistory() {
  let h = [];
  try { h = JSON.parse(localStorage.getItem('ipo_hist') || '[]'); } catch (e) {}
  $('#hist').innerHTML = h.length ? h.map(x => `<div class="hist"><small>${esc(x.t)}</small><br>${x.r.map((d, i) => `${i + 1}. ${esc(d.name)}: ${d.score}/100`).join('<br>')}</div>`).join('') : '<p class="sub">Nothing yet. Run a check first.</p>';
}

$('#go').addEventListener('click', async () => {
  add($('#name').value); $('#name').value = '';
  if (!names.length) { $('#msg').textContent = 'Add at least one company name first.'; return; }
  const btn = $('#go'); btn.disabled = true; $('#out').innerHTML = '';
  $('#msg').textContent = 'Reading IPO pages, financials and news. This takes about 10 seconds.';
  try {
    const r = await fetch(`${WORKER}/api/research?names=${encodeURIComponent(names.join('|'))}`);
    if (!r.ok) throw new Error('Worker returned ' + r.status);
    render(await r.json()); $('#msg').textContent = '';
  } catch (e) {
    $('#msg').textContent = 'Could not reach the worker (' + e.message + '). Check that it is deployed and the WORKER URL in app.js is correct.';
  }
  btn.disabled = false;
});

$('#new').addEventListener('click', () => {
  names = []; drawChips(); drawLine(); R = []; $('#out').innerHTML = ''; $('#msg').textContent = '';
  $('#check').classList.remove('done', 'edit'); document.body.classList.remove('done');
  document.querySelector('.nav[data-view="check"]').click(); $('#name').focus();
});
$('#tip').innerHTML = DISC;
$('#info').addEventListener('click', e => { e.stopPropagation(); $('#infow').classList.toggle('show'); });
document.addEventListener('click', () => $('#infow').classList.remove('show'));

let L = null, lf = 'all', lm = 'all';
const ST = [['all', 'All', '#8A87A8'], ['open', 'Open', '#1D9E75'], ['upcoming', 'Upcoming', '#EF9F27'], ['closed', 'Closed', '#E24B4A']];
const MT = [['all', 'All'], ['Mainboard', 'Mainboard'], ['SME', 'SME']];
const dshort = s => (s ? s.replace(/, \d{4}/g, '') : '');
function lrow(r) {
  const pct = r.gmp != null && r.upper ? (r.gmp / r.upper * 100).toFixed(1) : null;
  return `<button class="lr ${r.status}${names.includes(r.name) ? ' added' : ''}" data-n="${esc(r.name)}"><span class="ln"><b>${esc(r.name)}</b><em>${esc(r.exch || r.type)}</em>${r.flag ? `<em class="fl">${esc(r.flag)}</em>` : ''}</span><span class="lg2">${r.gmp != null ? '₹' + r.gmp : '–'}${pct ? `<small>${pct > 0 ? '+' : ''}${pct}%</small>` : ''}</span><span>${r.open ? dshort(r.open) + ' – ' + dshort(r.close) : '–'}</span><span>${r.price ? '₹' + esc(r.price) : '–'}</span><span>${r.listing ? dshort(r.listing) : '–'}</span></button>`;
}
function drawLine() {
  const el = $('#line'); if (!el) return;
  if (!L || !L.items || !L.items.length) { el.innerHTML = '<p class="hint">The live IPO lineup could not be loaded. You can still type any company name.</p>'; return; }
  const q = $('#name').value.trim().toLowerCase(), base = L.items.filter(i => lm === 'all' || i.type === lm);
  const rows = q ? L.items.filter(i => i.name.toLowerCase().includes(q)) : base.filter(i => lf === 'all' || i.status === lf);
  const cnt = k => base.filter(i => k === 'all' || i.status === k).length;
  el.innerHTML = `<div class="lbar"><div class="lt">${ST.map(([k, l, c]) => `<button class="tab${lf === k ? ' on' : ''}" data-lf="${k}"><i style="background:${c}"></i>${l} · ${cnt(k)}</button>`).join('')}</div><div class="seg">${MT.map(([k, l]) => `<button class="${lm === k ? 'on' : ''}" data-lm="${k}">${l}</button>`).join('')}</div></div>
  <div class="ltab"><div class="lh"><span>Company</span><span>GMP</span><span>Open – Close</span><span>Price</span><span>Listing</span></div>${rows.length ? rows.map(lrow).join('') : '<p class="hint" style="padding:10px">Nothing matches. Press Enter to add what you typed.</p>'}</div><p class="hint">Tap a company to add it to your search, then press Check IPOs. Source: ${esc(L.src || 'IPO sites')}.</p>`;
}
async function loadLine() { try { const r = await fetch(WORKER + '/api/lineup'); L = await r.json(); } catch (e) { L = null; } drawLine(); }
$('#line').addEventListener('click', e => {
  const f = e.target.closest('[data-lf]'); if (f) { lf = f.dataset.lf; $('#name').value = ''; drawLine(); return; }
  const m = e.target.closest('[data-lm]'); if (m) { lm = m.dataset.lm; drawLine(); return; }
  const s = e.target.closest('[data-n]'); if (s) { add(s.dataset.n); $('#name').value = ''; drawLine(); }
});
$('#name').addEventListener('input', drawLine);
loadLine();
