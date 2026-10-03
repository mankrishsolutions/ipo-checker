// Change this if your worker URL differs.
const WORKER = 'https://ipos.mankrishsolutions.workers.dev';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let names = [];

function drawChips() {
  $('#chips').innerHTML = names.map((n, i) => `<span class="chip">${esc(n)}<button data-i="${i}" aria-label="Remove ${esc(n)}">×</button></span>`).join('');
}
function add(v) {
  v = v.trim();
  if (v && names.length < 5 && !names.includes(v)) { names.push(v); drawChips(); }
}
$('#name').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(e.target.value); e.target.value = ''; }
});
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b) { names.splice(+b.dataset.i, 1); drawChips(); }
});
document.querySelectorAll('.nav').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.nav,.view').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); $('#' + b.dataset.view).classList.add('on');
  if (b.dataset.view === 'history') drawHistory();
}));

const fmt = (v, p = '', s = '') => v == null ? 'n/a' : p + v + s;

function render(data) {
  data.sort((a, b) => b.score - a.score);
  const cls = d => d.call.replace(' ', '');
  const rank = data.map((d, i) => `<li><span class="n">${i + 1}</span><span class="nm">${esc(d.name)}${d.status ? `<small>${esc(d.status)}${d.dates ? ' · ' + esc(d.dates) : ''}</small>` : ''}</span><span class="badge ${cls(d)}">${d.call}</span><div class="score" style="--s:${d.score}"><span>${d.score}</span></div></li>`).join('');
  const st = (l, v) => `<div class="stat"><small>${l}</small><b>${v}</b></div>`;
  const cards = data.map(d => `<article class="card"><h3>${esc(d.name)}<span class="badge ${cls(d)}">${d.call}</span></h3>
    <div class="stats">
      ${st('GMP', fmt(d.gmp, '₹') + (d.gmpPct != null ? ' (' + d.gmpPct + '%)' : ''))}
      ${st('Upper price band', fmt(d.upper, '₹'))}
      ${st('Subscription (total)', fmt(d.sub, '', 'x'))}
      ${st('QIB / NII / Retail', [d.qib, d.nii, d.ret].map(v => fmt(v, '', 'x')).join(' / '))}
      ${st('P/E (post IPO)', fmt(d.pe))}
      ${st('ROE · Debt/Equity', fmt(d.roe, '', '%') + ' · ' + fmt(d.de))}
    </div>
    ${d.why && d.why.length ? `<h4>Why this score</h4><ul class="srcs">${d.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
    ${d.news && d.news.length ? `<h4>Latest news and analyst views</h4><ul class="srcs">${d.news.map(n => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a> <small>${esc(n.date)}</small></li>`).join('')}</ul>` : ''}
    <h4>Open the source pages</h4><ul class="srcs">${(d.pages || []).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>
    <p class="chk">${(d.checked || []).map(c => `<span class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'} ${esc(c.site)}</span>`).join('')}</p>
    ${d.error ? `<p class="sub">Error: ${esc(d.error)}</p>` : ''}
  </article>`).join('');
  $('#out').innerHTML = `<h2>Apply in this order</h2><ol class="rank">${rank}</ol><h2>The details</h2><div class="cards">${cards}</div>`;
  try {
    const h = JSON.parse(localStorage.getItem('ipo_hist') || '[]');
    h.unshift({ t: new Date().toLocaleString(), r: data.map(d => ({ name: d.name, score: d.score, call: d.call })) });
    localStorage.setItem('ipo_hist', JSON.stringify(h.slice(0, 20)));
  } catch (e) {}
}

function drawHistory() {
  let h = [];
  try { h = JSON.parse(localStorage.getItem('ipo_hist') || '[]'); } catch (e) {}
  $('#hist').innerHTML = h.length ? h.map(x => `<div class="hist"><small>${esc(x.t)}</small><br>${x.r.map((d, i) => `${i + 1}. ${esc(d.name)}: ${d.call} (${d.score})`).join('<br>')}</div>`).join('') : '<p class="sub">Nothing yet. Run a check first.</p>';
}

$('#go').addEventListener('click', async () => {
  add($('#name').value); $('#name').value = '';
  if (!names.length) { $('#msg').textContent = 'Add at least one company name first.'; return; }
  const btn = $('#go'); btn.disabled = true; $('#out').innerHTML = '';
  $('#msg').textContent = 'Searching the web for GMP, subscription and reviews. This takes about 10 seconds.';
  try {
    const r = await fetch(`${WORKER}/api/research?names=${encodeURIComponent(names.join('|'))}`);
    if (!r.ok) throw new Error('Worker returned ' + r.status);
    render(await r.json()); $('#msg').textContent = '';
  } catch (e) {
    $('#msg').textContent = 'Could not reach the worker (' + e.message + '). Check that it is deployed and the WORKER URL in app.js is correct.';
  }
  btn.disabled = false;
});
