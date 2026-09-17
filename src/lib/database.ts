import { Pool } from "pg";

export type PersistedListingSummary = {
    slug: string;
    title: string;
    priceSgdCents: number;
    condition: string;
    location: string;
    compatibilityStatus: string;
    compatibilitySummary: string;
    manufacturer: string;
    model: string;
    generation: string;
};

let pool: Pool | undefined;

export function isDatabaseConfigured() {
    return Boolean(process.env.DATABASE_URL);
}

function getPool() {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
    pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    return pool;
}

export type RelevantChunk = {
    id: string;
    content: string;
    citation: string | null;
    source: "vector" | "fts";
};

export async function getRelevantChunks(options: { queryVector?: number[]; queryText: string; limit?: number }): Promise<RelevantChunk[]> {
    const limit = Math.min(Math.max(options.limit ?? 3, 1), 5);
    const chunks: RelevantChunk[] = [];
    const seen = new Set<string>();
    const pool = getPool();

    if (options.queryVector && options.queryVector.length > 0) {
        const dimension = await pool.query<{ dimension: number | null }>("SELECT embedding_dimension AS dimension FROM document_chunks WHERE embedding IS NOT NULL LIMIT 1").catch(() => ({ rows: [{ dimension: null }] }));
        const storedDimension = dimension.rows[0]?.dimension ?? null;
        if (storedDimension === null || storedDimension === options.queryVector.length) {
            const vectorLiteral = `[${options.queryVector.join(",")}]`;
            const vectorRows = await pool.query<{ id: string; content: string; citation_label: string | null }>(
                `SELECT id::text AS id, content, citation_label
                 FROM document_chunks
                 WHERE embedding IS NOT NULL
                 ORDER BY embedding <=> $1::vector
                 LIMIT $2`,
                [vectorLiteral, limit],
            ).catch(() => ({ rows: [] as { id: string; content: string; citation_label: string | null }[] }));
            for (const row of vectorRows.rows) {
                if (seen.has(row.id)) continue;
                seen.add(row.id);
                chunks.push({ id: row.id, content: row.content, citation: row.citation_label, source: "vector" });
            }
        }
    }

    const ftsRows = await pool.query<{ id: string; content: string; citation_label: string | null }>(
        `SELECT id::text AS id, content, citation_label
         FROM document_chunks
         WHERE search_vector @@ plainto_tsquery('english', $1)
         ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
         LIMIT $2`,
        [options.queryText.slice(0, 500), limit],
    ).catch(() => ({ rows: [] as { id: string; content: string; citation_label: string | null }[] }));
    for (const row of ftsRows.rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        chunks.push({ id: row.id, content: row.content, citation: row.citation_label, source: "fts" });
    }

    return chunks.slice(0, limit);
}

export async function getPublishedListingSummaries(): Promise<PersistedListingSummary[]> {
    const result = await getPool().query<PersistedListingSummary>(`
        SELECT
            listing.public_slug AS "slug",
            listing.title,
            listing.price_sgd_cents AS "priceSgdCents",
            listing.condition,
            listing.location,
            listing.compatibility_status AS "compatibilityStatus",
            listing.compatibility_summary AS "compatibilitySummary",
            manufacturer.name AS manufacturer,
            product.model,
            product.generation
        FROM marketplace_listings AS listing
        JOIN products AS product ON product.id = listing.product_id
        JOIN manufacturers AS manufacturer ON manufacturer.id = product.manufacturer_id
        WHERE listing.state = 'published'
        ORDER BY listing.created_at DESC
    `);
    return result.rows;
}