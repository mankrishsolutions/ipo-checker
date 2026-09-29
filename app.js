/* =========================
   IPO PULSE - FRONTEND
   =========================
   Change only WORKER_URL below after deploying the Cloudflare Worker.
*/
const CONFIG = {
  WORKER_URL: "PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE"
};

const $ = (id) => document.getElementById(id);
const companiesEl = $("companies");
const budgetEl = $("budget");
const hero = $("hero"), loading = $("loading"), results = $("results"), errorBox = $("error");

$("demoBtn").addEventListener("click", () => {
  companiesEl.value = "Moneyview\nOrient Cables\nA-One Steels";
  budgetEl.value = "15000";
});

$("newSearchBtn").addEventListener("click", () => {
  results.classList.add("hidden");
  hero.classList.remove("hidden");
  window.scrollTo({top:0, behavior:"smooth"});
});

$("analyzeBtn").addEventListener("click", analyze);

async function analyze() {
  const companies = companiesEl.value.split(/\n|,/).map(x => x.trim()).filter(Boolean);
  const budget = Number(budgetEl.value || 0);

  if (!companies.length) return showError("Please enter at least one company name.");
  if (companies.length > 5) return showError("Please keep the list to a maximum of 5 IPOs.");
  if (!CONFIG.WORKER_URL || CONFIG.WORKER_URL.includes("PASTE_YOUR")) {
    return showError("First deploy the Cloudflare Worker and paste its URL into app.js → CONFIG.WORKER_URL.");
  }

  errorBox.classList.add("hidden");
  hero.classList.add("hidden");
  results.classList.add("hidden");
  loading.classList.remove("hidden");
  $("loadingText").textContent = `Researching ${companies.length} IPO${companies.length > 1 ? "s" : ""} using live web search.`;
  window.scrollTo({top:0, behavior:"smooth"});

  try {
    const res = await fetch(CONFIG.WORKER_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ companies, budget })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Worker returned an error.");
    renderReport(data);
  } catch (err) {
    loading.classList.add("hidden");
    hero.classList.remove("hidden");
    showError(err.message || "Something went wrong.");
  }
}

function renderReport(data) {
  loading.classList.add("hidden");
  results.classList.remove("hidden");
  $("updatedAt").textContent = `Research timestamp: ${new Date().toLocaleString("en-IN")}`;

  const budget = Number(data.budget || 0);
  const items = Array.isArray(data.ipos) ? data.ipos : [];

  if (budget) {
    const usable = items.filter(x => x.minimum_investment && !String(x.minimum_investment).toLowerCase().includes("n/a"));
    $("budgetBanner").classList.remove("hidden");
    $("budgetBanner").innerHTML = `<strong>₹${formatNumber(budget)}</strong> available capital · The sequence shown is an evidence-based research order, not a guarantee of returns.`;
  } else {
    $("budgetBanner").classList.add("hidden");
  }

  $("summaryGrid").innerHTML = items.map((x,i) => `
    <div class="summary-card">
      <div class="rank">RESEARCH SLOT ${i+1}</div>
      <h4>${esc(x.company)}</h4>
      <div class="summary-line"><span>GMP</span><b>${esc(x.gmp || "Not found")}</b></div>
      <div class="summary-line"><span>Subscription</span><b>${esc(x.subscription || "Not found")}</b></div>
      <div class="summary-line"><span>Listing signal</span><b>${esc(x.listing_signal || "—")}</b></div>
    </div>`).join("");

  $("cards").innerHTML = items.map((x,i) => renderCard(x,i)).join("");
  window.scrollTo({top:0, behavior:"smooth"});
}

function renderCard(x,i) {
  const scores = x.signals || {};
  const signal = x.overall_signal || "Mixed";
  const signalClass = /weak|high risk/i.test(signal) ? "risk" : "";
  const sources = (x.sources || []).slice(0,8).map(s => {
    const url = safeUrl(s.url);
    return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${esc(s.title || "Source")}</a>` : "";
  }).join("");

  const positives = (x.positives || []).map(v => `<li>${esc(v)}</li>`).join("");
  const concerns = (x.concerns || []).map(v => `<li>${esc(v)}</li>`).join("");

  return `<article class="ipo-card">
    <div class="card-top">
      <div>
        <div class="company">${esc(x.company)}</div>
        <div class="meta">${esc(x.exchange || "India IPO")} · ${esc(x.issue_dates || "Dates not found")} · ${esc(x.issue_size || "Issue size n/a")}</div>
      </div>
      <div class="signal ${signalClass}">${esc(signal).toUpperCase()}</div>
    </div>

    <div class="metrics">
      ${metric("GMP", x.gmp)}
      ${metric("Price band", x.price_band)}
      ${metric("Lot size", x.lot_size)}
      ${metric("Min. investment", x.minimum_investment)}
      ${metric("Subscription", x.subscription)}
    </div>

    <div class="bars">
      ${bar("Listing signals", scores.listing)}
      ${bar("Fundamentals", scores.fundamentals)}
      ${bar("Valuation", scores.valuation)}
      ${bar("Demand", scores.demand)}
      ${bar("Analyst view", scores.analysts)}
      ${bar("Risk comfort", scores.risk_comfort)}
    </div>

    <div class="card-columns">
      <div class="info-box"><h5>Why it stands out</h5><ul>${positives || "<li>No strong positive signal found.</li>"}</ul></div>
      <div class="info-box risk"><h5>Watch-outs</h5><ul>${concerns || "<li>No major concern found in the searched material.</li>"}</ul></div>
    </div>

    <div class="card-columns" style="margin-top:15px">
      <div class="info-box"><h5>Fundamentals & valuation</h5><ul>
        <li>${esc(x.fundamentals || "Not enough current information found.")}</li>
        <li>${esc(x.valuation || "Not enough current information found.")}</li>
      </ul></div>
      <div class="info-box"><h5>Application notes</h5><ul>
        <li>${esc(x.application_note || "Check official IPO documents before applying.")}</li>
        <li>${esc(x.priority_reason || "No priority explanation returned.")}</li>
      </ul></div>
    </div>

    <div class="source-list">${sources}</div>
  </article>`;
}

function metric(label, value) {
  return `<div class="metric"><label>${label}</label><strong>${esc(value || "—")}</strong></div>`;
}

function bar(label, value) {
  let n = Number(value);
  if (!Number.isFinite(n)) n = 0;
  n = Math.max(0, Math.min(100, n));
  return `<div class="bar-row"><span>${label}</span><div class="bar-bg"><div class="bar-fill" style="width:${n}%"></div></div><b>${n}</b></div>`;
}

function showError(msg) {
  errorBox.classList.remove("hidden");
  $("errorText").textContent = msg;
  errorBox.scrollIntoView({behavior:"smooth", block:"center"});
}

function formatNumber(n){ return Number(n).toLocaleString("en-IN"); }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function safeUrl(v){
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ""; }
  catch { return ""; }
}
