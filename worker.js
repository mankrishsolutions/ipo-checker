/**
 * IPO PULSE - CLOUDFLARE WORKER
 *
 * Required Worker secret:
 *   OPENAI_API_KEY
 *
 * Optional Worker variables:
 *   ALLOWED_ORIGIN = https://yourusername.github.io
 *   OPENAI_MODEL   = gpt-5.5
 *
 * The browser never receives OPENAI_API_KEY.
 */

const DEFAULT_MODEL = "gpt-5.5";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST." }, 405, env);
    }

    try {
      const body = await request.json();
      const companies = Array.isArray(body.companies)
        ? body.companies.map(x => String(x).trim()).filter(Boolean).slice(0, 5)
        : [];
      const budget = Number(body.budget || 0);

      if (!companies.length) return json({ error: "No company names supplied." }, 400, env);
      if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY is not configured in the Worker." }, 500, env);

      const prompt = buildPrompt(companies, budget);
      const model = env.OPENAI_MODEL || DEFAULT_MODEL;

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model,
          tools: [{ type: "web_search" }],
          tool_choice: "required",
          input: prompt
        })
      });

      const raw = await response.text();
      if (!response.ok) {
        return json({ error: `OpenAI API error: ${raw.slice(0, 800)}` }, response.status, env);
      }

      const apiData = JSON.parse(raw);
      const text = extractOutputText(apiData);
      if (!text) return json({ error: "The research model returned no text." }, 502, env);

      const parsed = extractJson(text);
      if (!parsed) {
        return json({ error: "The research response was not valid JSON.", raw: text.slice(0, 2000) }, 502, env);
      }

      parsed.budget = budget;
      parsed.generated_at = new Date().toISOString();
      return json(parsed, 200, env);
    } catch (err) {
      return json({ error: err.message || "Worker error." }, 500, env);
    }
  }
};

function buildPrompt(companies, budget) {
  return `
You are an Indian IPO research analyst. Perform CURRENT WEB RESEARCH for these upcoming IPO names:
${companies.map((x,i)=>`${i+1}. ${x}`).join("\n")}

Today's date is ${new Date().toISOString().slice(0,10)}.
${budget > 0 ? `The user's available capital is ₹${budget.toLocaleString("en-IN")}.` : ""}

IMPORTANT:
- Search the live web extensively before answering.
- Identify the correct Indian company/IPO if the supplied name is abbreviated or ambiguous.
- Prefer primary sources: NSE, BSE, SEBI, company/RHP/DRHP documents, registrar/exchange information.
- Also search reputable financial media and IPO research sites for GMP, subscription and analyst commentary.
- GMP is unofficial. Clearly distinguish it from official IPO information.
- Do NOT invent missing numbers. Use "Not found" when current information cannot be verified.
- Do not treat analyst opinions as facts.
- Do not claim certainty about listing gains or returns.
- Give an evidence-based comparison and an application sequence, but phrase it as research guidance rather than a guaranteed outcome.
- If subscription is not open yet, say so and do not fabricate a subscription number.
- Include source URLs that were actually used.

Return ONLY valid JSON, with no markdown and no text outside JSON, using exactly this structure:

{
  "ipos": [
    {
      "company": "string",
      "exchange": "string",
      "issue_dates": "string",
      "issue_size": "string",
      "price_band": "string",
      "lot_size": "string",
      "minimum_investment": "string",
      "gmp": "string",
      "subscription": "string",
      "listing_signal": "Strong | Moderate | Weak | Not enough data",
      "overall_signal": "Strong | Moderate | Mixed | Weak | Not enough data",
      "fundamentals": "short factual summary",
      "valuation": "short factual comparison/summary",
      "application_note": "short practical note",
      "priority_reason": "why its position appears where it does, based on evidence",
      "positives": ["...","...","..."],
      "concerns": ["...","...","..."],
      "signals": {
        "listing": 0,
        "fundamentals": 0,
        "valuation": 0,
        "demand": 0,
        "analysts": 0,
        "risk_comfort": 0
      },
      "sources": [
        {"title":"source name","url":"https://actual-source-url"}
      ]
    }
  ]
}

For signals, use 0-100 as a visual summary of the evidence found, not as a prediction of returns. Do not manufacture a score when evidence is absent; use 0 and explain the lack of data.
Order the IPOs by a research-based application sequence. This is NOT a prediction of which IPO will make money.
`;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const parts = [];
  for (const item of (data.output || [])) {
    for (const c of (item.content || [])) {
      if (typeof c.text === "string") parts.push(c.text);
    }
  }
  return parts.join("\n");
}

function extractJson(text) {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  try { return JSON.parse(s); } catch {}
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch {}
  }
  return null;
}

function corsHeaders(env) {
  const requested = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": requested,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env)
    }
  });
}
