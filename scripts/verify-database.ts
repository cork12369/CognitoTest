import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Add it to .env.local before running db:verify.");
}

const client = new Client({ connectionString: databaseUrl });

async function verify() {
    await client.connect();
    const result = await client.query<{
        manufacturers: string;
        products: string;
        listings: string;
        ports: string;
        capabilities: string;
        evidence: string;
        migrations: string;
    }>(`
        SELECT
            (SELECT count(*) FROM manufacturers)::text AS manufacturers,
            (SELECT count(*) FROM products)::text AS products,
            (SELECT count(*) FROM marketplace_listings)::text AS listings,
            (SELECT count(*) FROM product_ports)::text AS ports,
            (SELECT count(*) FROM product_capabilities)::text AS capabilities,
            (SELECT count(*) FROM product_evidence)::text AS evidence,
            (SELECT count(*) FROM schema_migrations)::text AS migrations
    `);
    const counts = result.rows[0];
    console.table(counts);
    if (Number(counts.products) !== 18 || Number(counts.listings) !== 18) {
        throw new Error(`Expected 18 seeded products/listings; received ${counts.products} products and ${counts.listings} listings.`);
    }
    console.log("Looply database verification passed.");
}

verify()
    .finally(() => client.end())
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });