# Looply

A public second-hand marketplace demo for used home-recording gear in Singapore, built for the CognitioLabs FDE build assessment.

## What is included

- Mobile-first browse experience with 18 seeded listings, plus item pages showing ports, included and missing accessories, compatibility cues, and source context
- Natural-language catalogue search
- Listing and catalogue Q&A with explicit unknowns
- Loop Builder: a PC-part-picker-style rig planner with adaptive slots, a drag-and-drop cart, and automatic Loop Check evaluation
- Hybrid RAG retrieval: an in-memory listing and knowledge-base index merged with Postgres pgvector and full-text chunks that carry citation labels
- A registry-gated TypeScript ingestion pipeline with provenance, versioning, and review-queued fact extraction
- Server-side chat and embedding calls through the CognitioLabs gateway, with deterministic catalogue fallbacks
- A public /notes page covering scope, AI usage, limitations, and decisions

## Product naming

- Loop Builder: visual rig builder
- My Gear: saved equipment inventory, feeding the builder cart
- Loop Check: compatibility result
- My Loop: the current setup, shown on the builder page
- Smart Swap: alternative recommendations
- Looply Assist: the AI guide

Shared Loop (public setup pages) and Loop Kits (seller bundles) are roadmap names only; this demo does not include them.

## Local setup

```bash
npm install
cp .env.example .env.local   # copy on Windows
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local PostgreSQL database

Looply ships a portable Postgres + pgvector setup in [`compose.yaml`](./compose.yaml). It stores canonical product generations separately from individual marketplace listings, with supporting tables for sources, ports, capabilities, requirements, document versions, chunks, and compatibility rules.

### Start locally

1. Start **Docker Desktop** and wait until it reports the engine is running.
2. Confirm `.env.local` includes the local `DATABASE_URL` from `.env.example`.
3. Create the database, apply the migrations, seed the 18 demo records, and verify row counts:

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

1. Approve a source in the `ingest_sources` registry table: set `enabled = TRUE`, `terms_reviewed_at`, `allowed_paths`, and a `sitemap_url` or `seed_urls`. The pipeline fails closed. Unapproved sources, missing terms review, robots denials, auth challenges, and CAPTCHAs are all skipped with a log line.
2. Run the ingestion pipeline. Raw files land in gitignored `data/raw/`, chunks carry citation labels, and facts enter review queues:

```bash
npm run db:ingest
```

3. Promote vetted niche-gear entries (exported as JSON from the browser `looply:custom-gear:v1` key) into `seller_statement` chunks. The script refuses to run without explicit approval:

```bash
npm run db:promote-custom -- --approve --reviewer="Your Name" --file=./vetted-custom-gear.json
```

### Deploy to a private VPS

- Copy `compose.yaml`, `database/migrations/`, and the application code to the VPS.
- Set a strong `POSTGRES_PASSWORD` and a non-public `DATABASE_URL` in the VPS environment. Do not use the local development password outside your machine.
- Keep PostgreSQL off the public internet. Do not publish port `5432` unless you have a specific private-network requirement.
- Run `docker compose up -d postgres`, followed by `npm run db:migrate`, `npm run db:seed`, and `npm run db:verify` from the deployed application directory.
- Back up the PostgreSQL volume before moving on to manual or PDF ingestion.

## Chat and embedding configuration

The demo never sends credentials to the browser. Add these values to `.env.local` (or your deployment provider's server-side environment):

```env
CLASSGW_BASE_URL=https://174.138.16.223/openrouter/v1
CLASSGW_KEY=...
AI_MODEL=openai/gpt-4o-mini
AI_EMBEDDING_MODEL=openai/text-embedding-3-small
```

`CLASSGW_KEY` covers both chat and embeddings. On the first model-backed request, Looply embeds its seeded listings and compact connection knowledge base with `openai/text-embedding-3-small`, caches the vectors for the server process, and retrieves only the closest records before sending them to `openai/gpt-4o-mini`. Model output is constrained to retrieved context and validated before it reaches the UI. If embedding or chat access is absent or fails, the same routes use deterministic seeded-catalogue fallbacks and label the source accordingly.

## Verification

```bash
npm run lint
npm run build
```

To check the deployed site, open it in a private browser window at phone width and try browse, one listing detail page, natural-language search, Q&A, and `/notes`.

## Intentional demo boundaries

All listings, seller details, prices, conditions, locations, compatibility summaries, and transactions are illustrative. Payments, accounts, logistics, and messaging do not exist in this demo, and nothing here guarantees condition, safety, authenticity, or compatibility.
