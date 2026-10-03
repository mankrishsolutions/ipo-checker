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
  const rank = data.map((d, i) => `<li><span class="n">${i + 1}</span><span class="nm">${esc(d.name)}</span><span class="badge ${d.call.replace(' ', '')}">${d.call}</span><div class="score" style="--s:${d.score}"><span>${d.score}</span></div></li>`).join('');
  const cards = data.map(d => `<article class="card"><h3>${esc(d.name)}<span class="badge ${d.call.replace(' ', '')}">${d.call}</span></h3>
    <div class="stats">
      <div class="stat"><small>GMP</small><b>${fmt(d.gmp, '₹')}${d.gmpPct != null ? ' (' + d.gmpPct + '%)' : ''}</b></div>
      <div class="stat"><small>Upper price band</small><b>${fmt(d.upper, '₹')}</b></div>
      <div class="stat"><small>Subscription</small><b>${fmt(d.sub, '', 'x')}</b></div>
      <div class="stat"><small>Positive vs cautious mentions</small><b>${d.pos ?? 0} / ${d.neg ?? 0}</b></div>
    </div>
    ${d.sources.length ? `<ul class="srcs">${d.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>` : '<p class="sub">No pages found. Check the spelling or try the full registered name.</p>'}
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
