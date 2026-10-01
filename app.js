/* =========================================================
   IPO PULSE - FRONTEND
   Compatible with ZERO-API Cloudflare Worker
   ========================================================= */

const CONFIG = {
  WORKER_URL: "https://ipos.mankrishsolutions.workers.dev"
};


const $ = (id) =>
  document.getElementById(id);


const companiesEl =
  $("companies");

const budgetEl =
  $("budget");

const hero =
  $("hero");

const loading =
  $("loading");

const results =
  $("results");

const errorBox =
  $("error");


// =========================================================
// DEMO
// =========================================================

$("demoBtn").addEventListener(
  "click",
  () => {

    companiesEl.value =
      "TNA Solutions\nVishal Nirmiti";

    budgetEl.value =
      "15000";

  }
);


// =========================================================
// NEW SEARCH
// =========================================================

$("newSearchBtn").addEventListener(
  "click",
  () => {

    results.classList.add(
      "hidden"
    );

    hero.classList.remove(
      "hidden"
    );

    errorBox.classList.add(
      "hidden"
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }
);


// =========================================================
// ANALYZE BUTTON
// =========================================================

$("analyzeBtn").addEventListener(
  "click",
  analyze
);


// =========================================================
// ANALYZE
// =========================================================

async function analyze() {

  const companies =
    companiesEl.value
      .split(/\n|,/)
      .map(x => x.trim())
      .filter(Boolean);


  const budget =
    Number(
      budgetEl.value || 0
    );


  if (!companies.length) {

    return showError(
      "Please enter at least one company name."
    );

  }


  if (companies.length > 5) {

    return showError(
      "Please keep the list to a maximum of 5 IPOs."
    );

  }


  if (
    !CONFIG.WORKER_URL ||
    CONFIG.WORKER_URL.includes(
      "PASTE_YOUR"
    )
  ) {

    return showError(
      "Cloudflare Worker URL is not configured."
    );

  }


  errorBox.classList.add(
    "hidden"
  );

  hero.classList.add(
    "hidden"
  );

  results.classList.add(
    "hidden"
  );

  loading.classList.remove(
    "hidden"
  );


  $("loadingText").textContent =
    `Researching ${companies.length} IPO${
      companies.length > 1 ? "s" : ""
    } using live web research.`;


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  try {

    const response =
      await fetch(
        CONFIG.WORKER_URL,
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              companies,

              budget

            })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Worker returned an error."
      );

    }


    renderReport(
      data,
      budget
    );


  }

  catch (error) {

    loading.classList.add(
      "hidden"
    );

    hero.classList.remove(
      "hidden"
    );

    showError(
      error.message ||
      "Something went wrong."
    );

  }

}


// =========================================================
// RENDER REPORT
// =========================================================

function renderReport(
  data,
  budget
) {

  loading.classList.add(
    "hidden"
  );


  results.classList.remove(
    "hidden"
  );


  $("updatedAt").textContent =
    `Research timestamp: ${
      new Date().toLocaleString(
        "en-IN"
      )
    }`;


  /*
   * NEW WORKER FORMAT:
   *
   * data.results
   *
   * OLD FRONTEND FORMAT:
   *
   * data.ipos
   *
   * We now support the new format.
   */

  const rawItems =
    Array.isArray(
      data.results
    )
      ? data.results
      : (
          Array.isArray(data.ipos)
            ? data.ipos
            : []
        );


  const items =
    rawItems
      .filter(
        x =>
          x &&
          !x.error
      )
      .map(
        normalizeIPO
      );


  // ------------------------------------------------------
  // NO RESULTS
  // ------------------------------------------------------

  if (!items.length) {

    $("summaryGrid").innerHTML = "";

    $("cards").innerHTML = `

      <div class="info-box">

        <h5>No IPO report returned</h5>

        <p>
          The Worker responded successfully,
          but no usable IPO result was returned.
        </p>

      </div>

    `;

    $("budgetBanner").classList.add(
      "hidden"
    );

    return;

  }


  // ------------------------------------------------------
  // BUDGET
  // ------------------------------------------------------

  if (budget > 0) {

    $("budgetBanner")
      .classList.remove(
        "hidden"
      );


    $("budgetBanner").innerHTML = `

      <strong>
        ₹${formatNumber(budget)}
      </strong>

      available capital ·

      The displayed information is
      based on current public web research,
      not a guarantee of returns.

    `;

  }

  else {

    $("budgetBanner")
      .classList.add(
        "hidden"
      );

  }


  // ------------------------------------------------------
  // SUMMARY CARDS
  // ------------------------------------------------------

  $("summaryGrid").innerHTML =

    items
      .map(
        (x, i) => `

          <div class="summary-card">

            <div class="rank">
              RESEARCH SLOT ${i + 1}
            </div>

            <h4>
              ${esc(x.company)}
            </h4>

            <div class="summary-line">

              <span>GMP</span>

              <b>
                ${esc(
                  x.gmp ||
                  "Not found"
                )}
              </b>

            </div>


            <div class="summary-line">

              <span>
                Subscription
              </span>

              <b>
                ${esc(
                  x.subscription ||
                  "Not found"
                )}
              </b>

            </div>


            <div class="summary-line">

              <span>
                Listing signal
              </span>

              <b>
                ${esc(
                  x.listing_signal ||
                  "—"
                )}
              </b>

            </div>

          </div>

        `
      )
      .join("");


  // ------------------------------------------------------
  // DETAIL CARDS
  // ------------------------------------------------------

  $("cards").innerHTML =

    items
      .map(
        (x, i) =>
          renderCard(
            x,
            i
          )
      )
      .join("");


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// =========================================================
// NORMALIZE NEW WORKER RESPONSE
// =========================================================

function normalizeIPO(
  x
) {

  // ------------------------------------------------------
  // GMP
  // ------------------------------------------------------

  let gmpText =
    "Not found";


  if (
    x.gmp &&
    typeof x.gmp === "object"
  ) {

    const value =
      x.gmp.value;


    const percent =
      x.gmp.percent;


    if (
      value !== null &&
      value !== undefined
    ) {

      gmpText =
        `₹${formatNumber(value)}`;

      if (
        percent !== null &&
        percent !== undefined
      ) {

        gmpText +=
          ` (${percent}%)`;

      }

    }

  }

  else if (x.gmp) {

    gmpText =
      String(x.gmp);

  }


  // ------------------------------------------------------
  // PRICE BAND
  // ------------------------------------------------------

  let priceBand =
    "Not found";


  if (
    x.price_band &&
    typeof x.price_band === "object"
  ) {

    const low =
      x.price_band.low;

    const high =
      x.price_band.high;


    if (
      low !== null &&
      low !== undefined &&
      high !== null &&
      high !== undefined
    ) {

      priceBand =
        `₹${formatNumber(low)} – ₹${formatNumber(high)}`;

    }

  }

  else if (x.price_band) {

    priceBand =
      String(x.price_band);

  }


  // ------------------------------------------------------
  // DATES
  // ------------------------------------------------------

  let dates =
    "Dates not found";


  if (
    x.issue_dates &&
    typeof x.issue_dates === "object"
  ) {

    const parts = [];


    if (x.issue_dates.open) {

      parts.push(
        `Open: ${x.issue_dates.open}`
      );

    }


    if (x.issue_dates.close) {

      parts.push(
        `Close: ${x.issue_dates.close}`
      );

    }


    if (x.issue_dates.listing) {

      parts.push(
        `Listing: ${x.issue_dates.listing}`
      );

    }


    if (parts.length) {

      dates =
        parts.join(" · ");

    }

  }

  else if (x.issue_dates) {

    dates =
      String(x.issue_dates);

  }


  // ------------------------------------------------------
  // SUBSCRIPTION
  // ------------------------------------------------------

  let subscription =
    "Not found";


  if (
    x.subscription &&
    typeof x.subscription === "object"
  ) {

    const parts = [];


    if (
      x.subscription.total !== null &&
      x.subscription.total !== undefined
    ) {

      parts.push(
        `Total ${x.subscription.total}x`
      );

    }


    if (
      x.subscription.retail !== null &&
      x.subscription.retail !== undefined
    ) {

      parts.push(
        `Retail ${x.subscription.retail}x`
      );

    }


    if (
      x.subscription.nii !== null &&
      x.subscription.nii !== undefined
    ) {

      parts.push(
        `NII ${x.subscription.nii}x`
      );

    }


    if (
      x.subscription.qib !== null &&
      x.subscription.qib !== undefined
    ) {

      parts.push(
        `QIB ${x.subscription.qib}x`
      );

    }


    if (parts.length) {

      subscription =
        parts.join(" · ");

    }

  }

  else if (x.subscription) {

    subscription =
      String(x.subscription);

  }


  // ------------------------------------------------------
  // FUNDAMENTALS
  // ------------------------------------------------------

  let fundamentals =
    "Not enough current information found.";


  if (
    x.fundamentals &&
    typeof x.fundamentals === "object"
  ) {

    fundamentals =
      x.fundamentals.status ||
      fundamentals;

  }

  else if (x.fundamentals) {

    fundamentals =
      String(x.fundamentals);

  }


  // ------------------------------------------------------
  // VALUATION
  // ------------------------------------------------------

  let valuation =
    "Not enough current information found.";


  if (
    x.valuation &&
    typeof x.valuation === "object"
  ) {

    valuation =
      x.valuation.status ||
      valuation;

  }

  else if (x.valuation) {

    valuation =
      String(x.valuation);

  }


  // ------------------------------------------------------
  // SIGNAL SCORES
  // ------------------------------------------------------

  const originalSignals =
    x.signals || {};


  const signals = {

    listing:
      signalToNumber(
        originalSignals.listing
      ),


    fundamentals:
      signalToNumber(
        originalSignals.fundamentals
      ),


    valuation:
      signalToNumber(
        originalSignals.valuation
      ),


    demand:
      signalToNumber(
        originalSignals.demand
      ),


    analysts:
      signalToNumber(
        originalSignals.analysts
      ),


    risk_comfort:
      signalToNumber(
        originalSignals.risk_comfort
      )

  };


  // ------------------------------------------------------
  // RETURN NORMALIZED OBJECT
  // ------------------------------------------------------

  return {

    company:
      x.company || "Unknown IPO",


    exchange:
      x.exchange ||
      "India IPO",


    issue_dates:
      dates,


    issue_size:
      x.issue_size ||
      "Not found",


    price_band:
      priceBand,


    lot_size:
      x.lot_size !== null &&
      x.lot_size !== undefined

        ? x.lot_size

        : "Not found",


    minimum_investment:
      formatInvestment(
        x.minimum_investment
      ),


    gmp:
      gmpText,


    subscription:
      subscription,


    listing_signal:
      x.listing_signal ||
      "Not enough data",


    overall_signal:
      x.overall_signal ||
      x.listing_signal ||
      "Not enough data",


    fundamentals:
      fundamentals,


    valuation:
      valuation,


    application_note:
      x.application_note ||
      "Check official IPO documents before applying.",


    priority_reason:
      x.priority_reason ||
      "No priority explanation returned.",


    positives:
      Array.isArray(x.positives)
        ? x.positives
        : [],


    concerns:
      Array.isArray(x.concerns)
        ? x.concerns
        : [],


    signals:


      signals,


    sources:
      Array.isArray(x.sources)
        ? x.sources
        : []

  };

}


// =========================================================
// FORMAT INVESTMENT
// =========================================================

function formatInvestment(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return "Not found";

  }


  const n =
    Number(value);


  if (
    Number.isFinite(n)
  ) {

    return (
      "₹" +
      formatNumber(n)
    );

  }


  return String(value);

}


// =========================================================
// QUALITATIVE SIGNAL → VISUAL BAR
// =========================================================

function signalToNumber(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return 0;

  }


  if (
    typeof value === "number"
  ) {

    return value;

  }


  const text =
    String(value)
      .toLowerCase();


  if (
    text.includes("strong")
  ) {

    return 85;

  }


  if (
    text.includes("positive")
  ) {

    return 70;

  }


  if (
    text.includes("moderate")
  ) {

    return 60;

  }


  if (
    text.includes("available")
  ) {

    return 55;

  }


  if (
    text.includes("data available")
  ) {

    return 55;

  }


  if (
    text.includes("weak")
  ) {

    return 30;

  }


  if (
    text.includes("risk")
  ) {

    return 40;

  }


  if (
    text.includes("review")
  ) {

    return 40;

  }


  if (
    text.includes("unknown") ||
    text.includes("not available") ||
    text.includes("needs extraction") ||
    text.includes("required")
  ) {

    return 0;

  }


  return 0;

}


// =========================================================
// RENDER CARD
// =========================================================

function renderCard(
  x,
  i
) {

  const scores =
    x.signals || {};


  const signal =
    x.overall_signal ||
    "Not enough data";


  const signalClass =
    /weak|high risk/i.test(
      signal
    )
      ? "risk"
      : "";


  const sources =
    (x.sources || [])
      .slice(0, 8)
      .map(

        source => {

          const url =
            safeUrl(
              source.url
            );


          if (!url) {
            return "";
          }


          return `

            <a
              href="${url}"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${esc(
                source.title ||
                source.name ||
                "Source"
              )}
            </a>

          `;

        }

      )
      .join("");


  const positives =
    (x.positives || [])
      .map(
        value =>
          `<li>${esc(value)}</li>`
      )
      .join("");


  const concerns =
    (x.concerns || [])
      .map(
        value =>
          `<li>${esc(value)}</li>`
      )
      .join("");


  return `

    <article class="ipo-card">

      <div class="card-top">

        <div>

          <div class="company">
            ${esc(x.company)}
          </div>

          <div class="meta">

            ${esc(
              x.exchange ||
              "India IPO"
            )}

            ·

            ${esc(
              x.issue_dates ||
              "Dates not found"
            )}

            ·

            ${esc(
              x.issue_size ||
              "Issue size n/a"
            )}

          </div>

        </div>


        <div
          class="signal ${signalClass}"
        >
          ${esc(
            signal
          ).toUpperCase()}
        </div>

      </div>


      <div class="metrics">

        ${metric(
          "GMP",
          x.gmp
        )}

        ${metric(
          "Price band",
          x.price_band
        )}

        ${metric(
          "Lot size",
          x.lot_size
        )}

        ${metric(
          "Min. investment",
          x.minimum_investment
        )}

        ${metric(
          "Subscription",
          x.subscription
        )}

      </div>


      <div class="bars">

        ${bar(
          "Listing signals",
          scores.listing
        )}

        ${bar(
          "Fundamentals",
          scores.fundamentals
        )}

        ${bar(
          "Valuation",
          scores.valuation
        )}

        ${bar(
          "Demand",
          scores.demand
        )}

        ${bar(
          "Analyst view",
          scores.analysts
        )}

        ${bar(
          "Risk comfort",
          scores.risk_comfort
        )}

      </div>


      <div class="card-columns">

        <div class="info-box">

          <h5>
            Why it stands out
          </h5>

          <ul>

            ${
              positives ||
              "<li>No strong positive signal found.</li>"
            }

          </ul>

        </div>


        <div class="info-box risk">

          <h5>
            Watch-outs
          </h5>

          <ul>

            ${
              concerns ||
              "<li>No major concern found in the searched material.</li>"
            }

          </ul>

        </div>

      </div>


      <div
        class="card-columns"
        style="margin-top:15px"
      >

        <div class="info-box">

          <h5>
            Fundamentals & valuation
          </h5>

          <ul>

            <li>
              ${esc(
                x.fundamentals ||
                "Not enough current information found."
              )}
            </li>

            <li>
              ${esc(
                x.valuation ||
                "Not enough current information found."
              )}
            </li>

          </ul>

        </div>


        <div class="info-box">

          <h5>
            Application notes
          </h5>

          <ul>

            <li>
              ${esc(
                x.application_note ||
                "Check official IPO documents before applying."
              )}
            </li>

            <li>
              ${esc(
                x.priority_reason ||
                "No priority explanation returned."
              )}
            </li>

          </ul>

        </div>

      </div>


      <div class="source-list">

        ${sources}

      </div>

    </article>

  `;

}


// =========================================================
// METRIC
// =========================================================

function metric(
  label,
  value
) {

  return `

    <div class="metric">

      <label>
        ${esc(label)}
      </label>

      <strong>
        ${esc(
          value ||
          "—"
        )}
      </strong>

    </div>

  `;

}


// =========================================================
// PROGRESS BAR
// =========================================================

function bar(
  label,
  value
) {

  let n =
    Number(value);


  if (
    !Number.isFinite(n)
  ) {

    n = 0;

  }


  n =
    Math.max(
      0,
      Math.min(
        100,
        n
      )
    );


  return `

    <div class="bar-row">

      <span>
        ${esc(label)}
      </span>

      <div class="bar-bg">

        <div
          class="bar-fill"
          style="width:${n}%"
        ></div>

      </div>

      <b>
        ${n}
      </b>

    </div>

  `;

}


// =========================================================
// ERROR
// =========================================================

function showError(
  message
) {

  errorBox.classList.remove(
    "hidden"
  );


  $("errorText").textContent =
    message;


  errorBox.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

}


// =========================================================
// HELPERS
// =========================================================

function formatNumber(
  value
) {

  const n =
    Number(value);


  if (
    !Number.isFinite(n)
  ) {

    return String(value);

  }


  return n.toLocaleString(
    "en-IN"
  );

}


function esc(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /[&<>"']/g,
      character => ({

        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        '"':
          "&quot;",

        "'":
          "&#039;"

      }[character])
    );

}


function safeUrl(
  value
) {

  try {

    const url =
      new URL(value);


    if (
      /^https?:$/.test(
        url.protocol
      )
    ) {

      return url.href;

    }

  }

  catch {

    return "";

  }


  return "";

}
