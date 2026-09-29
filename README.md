# IPO Pulse — Lightweight IPO Research App

## Frontend
Files:
- index.html
- style.css
- app.js

Host these on GitHub Pages, IIS, or any static web host.

In `app.js`, replace:
`PASTE_YOUR_CLOUDFLARE_WORKER_URL_HERE`
with your deployed Worker URL.

## Cloudflare Worker
Files:
- worker.js
- wrangler.jsonc
- .gitignore

The Worker keeps the OpenAI API key secret and uses OpenAI Responses API web search.

### Dashboard setup
1. Create a Cloudflare Worker named `ipo-pulse-worker`.
2. Deploy `worker.js`.
3. In Worker Settings → Variables and Secrets, add:
   - Secret: `OPENAI_API_KEY`
   - Variable: `OPENAI_MODEL` = `gpt-5.5`
   - Variable: `ALLOWED_ORIGIN` = your GitHub Pages URL
4. Deploy.
5. Copy the Worker URL into `app.js`.

### Important
Never put the OpenAI API key in `app.js`, `index.html`, or a public GitHub repository.

The research output is informational. GMP is unofficial and may change quickly. Always verify official IPO documents and exchange/registrar information before applying.
