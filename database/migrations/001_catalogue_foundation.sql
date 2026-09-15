CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE source_tier AS ENUM ('manufacturer', 'official_support', 'trusted_distributor', 'verified_inspection', 'seller_statement', 'inference');
CREATE TYPE review_status AS ENUM ('pending_review', 'approved', 'rejected', 'superseded');
CREATE TYPE listing_state AS ENUM ('draft', 'published', 'reserved', 'sold', 'withdrawn');
CREATE TYPE port_direction AS ENUM ('input', 'output', 'bidirectional');
CREATE TYPE signal_kind AS ENUM ('microphone', 'instrument', 'line', 'speaker', 'headphone', 'midi', 'usb', 'digital', 'power', 'unknown');

CREATE TABLE manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    website_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id UUID NOT NULL REFERENCES manufacturers(id),
    category_id UUID NOT NULL REFERENCES product_categories(id),
    model TEXT NOT NULL,
    generation TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL UNIQUE,
    part_number TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (manufacturer_id, model, generation)
);

CREATE TABLE product_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    normalised_alias TEXT NOT NULL,
    alias_type TEXT NOT NULL DEFAULT 'common_name',
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
    UNIQUE (product_id, normalised_alias)
);

CREATE INDEX product_aliases_trgm_idx ON product_aliases USING GIN (normalised_alias gin_trgm_ops);

CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    source_tier source_tier NOT NULL,
    permission_status TEXT NOT NULL DEFAULT 'pending_review',
    rights_status TEXT NOT NULL DEFAULT 'internal_index_only',
    robots_reviewed_at TIMESTAMPTZ,
    terms_reviewed_at TIMESTAMPTZ,
    requests_per_second NUMERIC(4,2) NOT NULL DEFAULT 0.25 CHECK (requests_per_second > 0),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id),
    canonical_url TEXT NOT NULL,
    title TEXT,
    document_type TEXT,
    current_version_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, canonical_url)
);

CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    object_storage_key TEXT,
    mime_type TEXT,
    etag TEXT,
    last_modified TEXT,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    parser_version TEXT,
    processing_status TEXT NOT NULL DEFAULT 'seeded',
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (document_id, content_hash)
);

ALTER TABLE documents
    ADD CONSTRAINT documents_current_version_fk
    FOREIGN KEY (current_version_id) REFERENCES document_versions(id)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE product_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    document_version_id UUID REFERENCES document_versions(id),
    claim TEXT NOT NULL,
    source_tier source_tier NOT NULL,
    source_url TEXT,
    page_reference TEXT,
    confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    review_status review_status NOT NULL DEFAULT 'pending_review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, document_version_id, claim)
);

CREATE TABLE product_ports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    connector TEXT NOT NULL,
    direction port_direction NOT NULL,
    signal signal_kind NOT NULL DEFAULT 'unknown',
    connector_gender TEXT,
    channel_count SMALLINT,
    is_balanced BOOLEAN,
    evidence_id UUID REFERENCES product_evidence(id),
    review_status review_status NOT NULL DEFAULT 'pending_review'
);

CREATE TABLE product_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_name TEXT NOT NULL,
    value JSONB NOT NULL,
    unit TEXT,
    evidence_id UUID REFERENCES product_evidence(id),
    confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    review_status review_status NOT NULL DEFAULT 'pending_review',
    valid_from DATE,
    valid_until DATE,
    UNIQUE (product_id, attribute_name, value)
);

CREATE TABLE product_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    requirement_type TEXT NOT NULL,
    value JSONB NOT NULL,
    evidence_id UUID REFERENCES product_evidence(id),
    confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    review_status review_status NOT NULL DEFAULT 'pending_review'
);

CREATE TABLE marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_slug TEXT NOT NULL UNIQUE,
    product_id UUID NOT NULL REFERENCES products(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    condition TEXT NOT NULL,
    price_sgd_cents INTEGER NOT NULL CHECK (price_sgd_cents >= 0),
    location TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    seller_initials TEXT NOT NULL,
    seller_rating NUMERIC(2,1) NOT NULL CHECK (seller_rating >= 0 AND seller_rating <= 5),
    image_url TEXT,
    image_position TEXT,
    compatibility_status TEXT NOT NULL,
    compatibility_summary TEXT NOT NULL,
    published_label TEXT,
    state listing_state NOT NULL DEFAULT 'published',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE listing_included_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'accessory',
    UNIQUE (listing_id, item_name)
);

CREATE TABLE listing_disclosures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    disclosure_type TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE compatibility_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    rule_version INTEGER NOT NULL DEFAULT 1,
    definition JSONB NOT NULL,
    explanation_template TEXT NOT NULL,
    review_status review_status NOT NULL DEFAULT 'pending_review',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, rule_version)
);

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    heading_path TEXT[],
    content TEXT NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    token_count INTEGER,
    topics TEXT[],
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    embedding VECTOR(1536),
    embedding_model TEXT,
    embedding_dimension SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_version_id, chunk_index)
);

CREATE INDEX document_chunks_fts_idx ON document_chunks USING GIN (search_vector);
CREATE INDEX document_chunks_topics_idx ON document_chunks USING GIN (topics);
CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE product_document_links (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    match_confidence NUMERIC(4,3) NOT NULL CHECK (match_confidence >= 0 AND match_confidence <= 1),
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_status review_status NOT NULL DEFAULT 'pending_review',
    PRIMARY KEY (product_id, document_id)
);