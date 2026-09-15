# Looply

Looply is a public, responsive candidate-assessment demo for an AI-enabled marketplace for used home-recording equipment in Singapore.

## What is included

- Mobile-first browse experience with 12 structured seeded listings
- Public item-detail pages with ports, included/missing accessories, compatibility cues, and source context
- Natural-language catalogue search
- Grounded listing/catalogue Q&A with explicit unknowns
- Server-side OpenAI-compatible gateway integration, plus deterministic catalogue fallbacks
- A required public [`/notes`](http://localhost:3000/notes) page documenting scope, AI, limitations, and decisions

## Product naming

- **Loop Builder** — visual rig builder
- **My Gear** — saved equipment inventory (also called Gear Locker)
- **Loop Check** — compatibility result
- **My Loop** — complete setup
- **Smart Swap** — alternative recommendations
- **Shared Loop** — public setup page
- **Loop Kits** — seller bundles
- **Looply Assist** — AI assistant

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## OpenRouter chat + embedding configuration

The demo never sends credentials to the browser. Add these values to `.env.local` (or your deployment provider’s server-side environment settings):

```env
CLASSGW_BASE_URL=https://174.138.16.223/openrouter/v1
CLASSGW_KEY=...
AI_GATEWAY_CONSOLE_PASSWORD=...
AI_MODEL=openai/gpt-4o-mini
AI_EMBEDDING_MODEL=openai/text-embedding-3-small
```

`CLASSGW_KEY` is used for both OpenRouter chat and embeddings. On the first model-backed request, Looply embeds its seeded listing records and compact connection knowledge base with `openai/text-embedding-3-small`, caches the vectors for the server process, and retrieves only the closest records before sending them to `openai/gpt-4o-mini`. Model output is constrained to retrieved context and validated before it reaches the UI. If embedding or chat access is absent or fails, the same routes use deterministic seeded-catalogue fallbacks and label the source accordingly.

## Verification

```bash
npm run lint
npm run build
```

Before submission, test the deployed URL in a private browser window at a phone-width viewport, including browse, one listing detail page, natural-language search, Q&A, and `/notes`.

## Intentional demo boundaries

All listings, seller details, prices, conditions, locations, compatibility summaries, and transactions are illustrative. There are no real payments, user accounts, logistics, messaging, or guarantees of condition, safety, authenticity, or compatibility.