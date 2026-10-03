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
$('#chips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { names.splice(+b.dataset.i, 1); drawChips(); } });
document.querySelectorAll('.nav').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.nav,.view').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); $('#' + b.dataset.view).classList.add('on');
  if (b.dataset.view === 'history') drawHistory();
  scrollTo(0, 0);
}));

const PILLARS = [['dem', 'Market demand', 'var(--lime)'], ['fin', 'Financials', 'var(--sky)'], ['val', 'Valuation', 'var(--peach)'], ['sen', 'News and reviews', 'var(--pink)']];
const FIN = [['Revenue', 'rev'], ['Profit after tax', 'pat'], ['Net worth', 'nw'], ['Borrowings', 'debt']];

function card(d) {
  const c = d.call.replace(' ', ''), pl = d.pillars || {};
  const bars = PILLARS.map(([k, l, col]) => { const s = pl[k] && pl[k].score; return `<div class="bar" style="--c:${col}"><span>${l}</span><div><i style="width:${s ?? 0}%"></i></div><b>${s ?? '–'}</b></div>`; }).join('');
  const pts = PILLARS.flatMap(([k]) => (pl[k] && pl[k].pts) || []);
  const li = x => `<li class="${x.g === true ? 't' : x.g === false ? 'f' : ''}">${esc(x.t)}</li>`;
  const fin = d.rev || d.pat ? `<h4>Company financials (₹ Cr)</h4><div class="tw"><table><tr><th></th><th>Latest FY</th><th>Prev FY</th><th>Year before</th></tr>${FIN.filter(f => d[f[1]]).map(f => `<tr><td>${f[0]}</td>${d[f[1]].map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</table></div>` : '';
  const list = (t, a) => a && a.length ? `<div><h4>${t}</h4><ul class="srcs">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  const news = d.news && d.news.length ? `<h4>Latest news and analyst views</h4><ul class="srcs">${d.news.map(n => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a> <small>${esc(n.date)}</small></li>`).join('')}</ul>` : '';
  const closed = d.status === 'Bidding closed' ? '<p class="sub">Bidding has closed, so read this as a listing-day view rather than an application call.</p>' : '';
  return `<article class="card"><div class="head"><h3>${esc(d.name)}</h3><div class="ring" style="--s:${d.score}"><span>${d.score}</span></div></div>
    <p class="verdict ${c}">${esc(d.verdict)}</p>
    <div class="meta">${d.status ? `<span>${esc(d.status)}</span>` : ''}${d.dates ? `<span>${esc(d.dates)}</span>` : ''}<span>Confidence: ${d.confidence || 'Low'}</span>${d.issue ? `<span>Issue ₹${d.issue} Cr</span>` : ''}</div>${closed}
    <div class="bars">${bars}</div>
    <div class="stats">
      <div class="stat"><small>GMP</small><b>${fmt(d.gmp, '₹')}${d.gmpPct != null ? ' (' + d.gmpPct + '%)' : ''}</b></div>
      <div class="stat"><small>Upper price band</small><b>${fmt(d.upper, '₹')}</b></div>
      <div class="stat"><small>Subscribed</small><b>${fmt(d.sub, '', 'x')}</b></div>
      <div class="stat"><small>QIB · NII · Retail</small><b>${[d.qib, d.nii, d.ret].map(v => fmt(v, '', 'x')).join(' · ')}</b></div>
      <div class="stat"><small>P/E · P/B</small><b>${fmt(d.pe)} · ${fmt(d.pb)}</b></div>
      <div class="stat"><small>ROE · Debt/Equity</small><b>${fmt(d.roe, '', '%')} · ${fmt(d.de)}</b></div>
    </div>
    ${pts.length ? `<h4>Reasons behind the score</h4><ul class="pts">${pts.map(li).join('')}</ul>` : ''}
    ${fin}
    <div class="two">${list('Strengths', d.strengths)}${list('Risks', d.risks)}</div>
    ${news}
    <h4>Open the source pages</h4><ul class="srcs">${(d.pages || []).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>
    <p class="chk">${(d.checked || []).map(x => `<span class="${x.ok ? 'ok' : 'no'}">${x.ok ? '✓' : '✗'} ${esc(x.site)}</span>`).join('')}</p>
    ${d.error ? `<p class="sub">Error: ${esc(d.error)}</p>` : ''}</article>`;
}

function render(data) {
  data.sort((a, b) => b.score - a.score);
  const pod = data.map((d, i) => `<li class="${d.call.replace(' ', '')}"><span class="n">#${i + 1}</span><span class="nm">${esc(d.name)}<small>${d.status ? esc(d.status) : 'Status unknown'}</small></span><div class="ring" style="--s:${d.score}"><span>${d.score}</span></div></li>`).join('');
  $('#out').innerHTML = `<p class="disc">${DISC}</p><h2>Ranked by research score</h2><ol class="podium">${pod}</ol><h2>The full picture</h2><div class="cards">${data.map(card).join('')}</div><p class="disc">${DISC}</p>`;
  try {
    const h = JSON.parse(localStorage.getItem('ipo_hist') || '[]');
    h.unshift({ t: new Date().toLocaleString(), r: data.map(d => ({ name: d.name, score: d.score, call: d.call })) });
    localStorage.setItem('ipo_hist', JSON.stringify(h.slice(0, 20)));
  } catch (e) {}
}

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
