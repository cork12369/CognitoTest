CREATE TYPE ingest_doc_type AS ENUM ('manual', 'support_page', 'spec_sheet', 'seeded_record', 'community_entry');

CREATE TABLE ingest_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    source_tier source_tier NOT NULL DEFAULT 'manufacturer',
    allowed_paths TEXT[] NOT NULL DEFAULT '{}',
    disallowed_paths TEXT[] NOT NULL DEFAULT '{}',
    sitemap_url TEXT,
    seed_urls TEXT[] NOT NULL DEFAULT '{}',
    robots_ok BOOLEAN NOT NULL DEFAULT FALSE,
    robots_checked_at TIMESTAMPTZ,
    terms_reviewed_at TIMESTAMPTZ,
    rate_limit_rps NUMERIC(4,2) NOT NULL DEFAULT 0.25 CHECK (rate_limit_rps > 0),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ingest_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingest_source_id UUID NOT NULL REFERENCES ingest_sources(id) ON DELETE CASCADE,
    discovered_url TEXT NOT NULL UNIQUE,
    canonical_url TEXT NOT NULL,
    title TEXT,
    doc_type ingest_doc_type NOT NULL DEFAULT 'support_page',
    raw_storage_key TEXT,
    content_hash TEXT,
    fetch_status TEXT NOT NULL DEFAULT 'pending',
    robots_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS ingest_document_id UUID REFERENCES ingest_documents(id) ON DELETE SET NULL;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS citation_label TEXT;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS ingest_document_id UUID REFERENCES ingest_documents(id) ON DELETE SET NULL;

INSERT INTO ingest_sources (name, base_url, source_tier, allowed_paths, seed_urls, enabled, notes)
VALUES (
    'Seeded catalogue records',
    'https://looply.local/seeded-catalogue',
    'inference',
    ARRAY['/seeded-catalogue'],
    ARRAY[]::TEXT[],
    FALSE,
    'Curated in-code catalogue records mirrored into Postgres by scripts/seed-catalogue.ts. Enable only for local ingestion dry-runs.'
)
ON CONFLICT (name) DO NOTHING;
