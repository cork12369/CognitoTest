# Looply

Looply is a public, responsive candidate-assessment demo for an AI-enabled marketplace for used home-recording equipment in Singapore.

## What is included

- Mobile-first browse experience with 18 structured seeded listings
- Public item-detail pages with ports, included/missing accessories, compatibility cues, and source context
- Natural-language catalogue search
- Grounded listing/catalogue Q&A with explicit unknowns
- PC-part-picker-style Loop Builder with adaptive slots, drag-and-drop cart, and automatic Loop Check evaluation
- Hybrid RAG retrieval: in-memory listing + knowledge-base index merged with Postgres pgvector/full-text chunks carrying citation labels
- Registry-gated TypeScript documentation-ingestion pipeline with provenance, versioning, and review-queued fact extraction
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

## Local PostgreSQL database

Looply ships with a portable PostgreSQL + pgvector foundation in [`compose.yaml`](./compose.yaml). It stores canonical product generations separately from individual marketplace listings, with source/evidence, ports, capabilities, requirements, document versions, chunks, and compatibility-rule tables ready for the documentation-ingestion pipeline.

### Start locally

1. Start **Docker Desktop** and wait until it reports that the engine is running.
2. Confirm `.env.local` includes the local `DATABASE_URL` from `.env.example`.
3. Create the database, apply all SQL migrations, seed the 18 demo audio-equipment records, and verify row counts:

```bash
npm run db:setup
```

The command expects 18 canonical products and 18 marketplace listings. Individual commands are also available:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:verify
```

### Ingest manufacturer documentation

1. Approve a source in the `ingest_sources` registry table: set `enabled = TRUE`, `terms_reviewed_at`, `allowed_paths`, and a `sitemap_url` or `seed_urls`. The pipeline fails closed — unapproved sources, missing terms review, robots denials, auth challenges, and CAPTCHAs are all skipped with a log line.
2. Run the ingestion pipeline (raw files land in gitignored `data/raw/`, chunks carry citation labels, facts enter review queues):

```bash
npm run db:ingest
```

3. Promote vetted niche-gear entries (exported as JSON from the browser `looply:custom-gear:v1` key) into `seller_statement` chunks. The script refuses to run without explicit approval:

```bash
npm run db:promote-custom -- --approve --reviewer="Your Name" --file=./vetted-custom-gear.json
```

### Deploy to a private VPS

- Copy `compose.yaml`, `database/migrations/`, and the application code to the VPS.
- Set a strong `POSTGRES_PASSWORD` and a non-public `DATABASE_URL` in the VPS environment; do not use the local development password outside your machine.
- Keep PostgreSQL off the public internet: do not publish port `5432` unless you have a specific private-network requirement.
- Run `docker compose up -d postgres`, followed by `npm run db:migrate`, `npm run db:seed`, and `npm run db:verify` from the deployed application directory.
- Back up the PostgreSQL volume before moving on to manual/PDF ingestion.

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