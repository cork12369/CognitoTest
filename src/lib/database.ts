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