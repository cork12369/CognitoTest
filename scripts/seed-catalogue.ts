import { Client } from "pg";
import { listings } from "../src/lib/catalogue";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Run the migration first and add the local connection string to .env.local.");
}

const client = new Client({ connectionString: databaseUrl });

const slugify = (value: string) => value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function classifyPort(label: string) {
    const normalised = label.toLowerCase();
    if (normalised.includes("xlr")) return { connector: "XLR", signal: normalised.includes("input") ? "microphone" : "line", direction: normalised.includes("output") ? "output" : "input" };
    if (normalised.includes("usb")) return { connector: normalised.includes("usb-c") ? "USB-C" : "USB-B", signal: "usb", direction: "bidirectional" };
    if (normalised.includes("midi")) return { connector: normalised.includes("5-pin") ? "DIN-5" : "TRS", signal: "midi", direction: normalised.includes("out") ? "output" : normalised.includes("in") ? "input" : "bidirectional" };
    if (normalised.includes("headphone")) return { connector: normalised.includes("3.5") ? "3.5 mm TRS" : "¼ in TRS", signal: "headphone", direction: "output" };
    if (normalised.includes("power") || normalised.includes("iec")) return { connector: normalised.includes("iec") ? "IEC" : "Power", signal: "power", direction: "input" };
    if (normalised.includes("output")) return { connector: normalised.includes("trs") ? "TRS" : "¼ in", signal: "line", direction: "output" };
    return { connector: normalised.includes("trs") ? "TRS" : "Unknown", signal: "unknown", direction: "bidirectional" };
}

async function getId(table: "manufacturers" | "product_categories", name: string) {
    const slug = slugify(name);
    const result = await client.query<{ id: string }>(
        `INSERT INTO ${table} (name, slug) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
         RETURNING id`,
        [name, slug],
    );
    return result.rows[0].id;
}

async function seed() {
    await client.connect();
    const source = await client.query<{ id: string }>("SELECT id FROM sources WHERE name = $1", ["Looply seeded demo catalogue"]);
    if (!source.rows[0]) throw new Error("Seed source missing. Run db:migrate before db:seed.");

    await client.query("BEGIN");
    try {
        for (const listing of listings) {
            const manufacturerId = await getId("manufacturers", listing.brand);
            const categoryId = await getId("product_categories", listing.category);
            const product = await client.query<{ id: string }>(
                `INSERT INTO products (manufacturer_id, category_id, model, generation, slug)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (manufacturer_id, model, generation)
                 DO UPDATE SET category_id = EXCLUDED.category_id, updated_at = NOW()
                 RETURNING id`,
                [manufacturerId, categoryId, listing.model, listing.generation, listing.id],
            );
            const productId = product.rows[0].id;

            await client.query(
                `INSERT INTO product_aliases (product_id, alias, normalised_alias, alias_type)
                 VALUES ($1, $2, $3, 'seed_title'), ($1, $4, $5, 'model')
                 ON CONFLICT (product_id, normalised_alias) DO NOTHING`,
                [productId, listing.title, slugify(listing.title), listing.model, slugify(listing.model)],
            );

            const document = await client.query<{ id: string }>(
                `INSERT INTO documents (source_id, canonical_url, title, document_type)
                 VALUES ($1, $2, $3, 'seeded_catalogue_record')
                 ON CONFLICT (source_id, canonical_url) DO UPDATE SET title = EXCLUDED.title
                 RETURNING id`,
                [source.rows[0].id, `https://looply.local/seeded-catalogue/${listing.id}`, listing.title],
            );
            const version = await client.query<{ id: string }>(
                `INSERT INTO document_versions (document_id, content_hash, parser_version, processing_status)
                 VALUES ($1, md5($2), 'seed-v1', 'seeded')
                 ON CONFLICT (document_id, content_hash) DO UPDATE SET is_current = TRUE
                 RETURNING id`,
                [document.rows[0].id, `${listing.title}|${listing.description}|${listing.facts.join("|")}`],
            );
            await client.query("UPDATE documents SET current_version_id = $1 WHERE id = $2", [version.rows[0].id, document.rows[0].id]);

            const evidence = await client.query<{ id: string }>(
                `INSERT INTO product_evidence (product_id, document_version_id, claim, source_tier, source_url, confidence, review_status)
                 VALUES ($1, $2, $3, 'inference', $4, 0.750, 'pending_review')
                 ON CONFLICT DO NOTHING
                 RETURNING id`,
                [productId, version.rows[0].id, listing.evidence, `https://looply.local/seeded-catalogue/${listing.id}`],
            );
            const evidenceId = evidence.rows[0]?.id ?? (await client.query<{ id: string }>("SELECT id FROM product_evidence WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1", [productId])).rows[0].id;

            await client.query("DELETE FROM product_ports WHERE product_id = $1", [productId]);
            for (const label of listing.ports) {
                const port = classifyPort(label);
                await client.query(
                    `INSERT INTO product_ports (product_id, label, connector, direction, signal, evidence_id, review_status)
                     VALUES ($1, $2, $3, $4::port_direction, $5::signal_kind, $6, 'pending_review')`,
                    [productId, label, port.connector, port.direction, port.signal, evidenceId],
                );
            }

            for (const fact of listing.facts) {
                await client.query(
                    `INSERT INTO product_capabilities (product_id, attribute_name, value, evidence_id, confidence, review_status)
                     VALUES ($1, $2, $3::jsonb, $4, 0.750, 'pending_review')
                     ON CONFLICT (product_id, attribute_name, value) DO NOTHING`,
                    [productId, `seeded_fact:${slugify(fact)}`, JSON.stringify({ statement: fact }), evidenceId],
                );
            }

            await client.query(
                `INSERT INTO marketplace_listings (
                    public_slug, product_id, title, description, condition, price_sgd_cents, location,
                    seller_name, seller_initials, seller_rating, image_url, image_position,
                    compatibility_status, compatibility_summary, published_label
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                 ON CONFLICT (public_slug) DO UPDATE SET
                    product_id = EXCLUDED.product_id, title = EXCLUDED.title, description = EXCLUDED.description,
                    condition = EXCLUDED.condition, price_sgd_cents = EXCLUDED.price_sgd_cents,
                    location = EXCLUDED.location, seller_name = EXCLUDED.seller_name,
                    seller_initials = EXCLUDED.seller_initials, seller_rating = EXCLUDED.seller_rating,
                    image_url = EXCLUDED.image_url, image_position = EXCLUDED.image_position,
                    compatibility_status = EXCLUDED.compatibility_status,
                    compatibility_summary = EXCLUDED.compatibility_summary,
                    published_label = EXCLUDED.published_label, updated_at = NOW()
                 RETURNING id`,
                [listing.id, productId, listing.title, listing.description, listing.condition, listing.price * 100, listing.location, listing.seller, listing.sellerInitials, listing.sellerRating, listing.image, listing.imagePosition ?? null, listing.compatibility, listing.compatibilitySummary, listing.published],
            );
        }
        await client.query("COMMIT");
        console.log(`Seeded ${listings.length} canonical products and marketplace listings.`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
}

seed()
    .finally(() => client.end())
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });