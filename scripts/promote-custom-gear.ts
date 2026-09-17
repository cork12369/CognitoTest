import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { requestEmbeddings } from "../src/lib/openrouter";
import { chunkSections, contentHash } from "./ingest-lib";

const databaseUrl = process.env.DATABASE_URL;
const approve = process.argv.includes("--approve");
const reviewer = process.argv.find((arg) => arg.startsWith("--reviewer="))?.split("=")[1] ?? "";
const fileArg = process.argv.find((arg) => arg.startsWith("--file="))?.split("=")[1] ?? "";

if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Start Docker and add the local connection string to .env.local.");
}
if (!approve || !reviewer || !fileArg) {
    throw new Error("Usage: npm run db:promote-custom -- --approve --reviewer=\"Your Name\" --file=./vetted-custom-gear.json");
}

const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || "openai/text-embedding-3-small";
const client = new Client({ connectionString: databaseUrl });

type VettedEntry = { label: string; category?: string; detail?: string };

async function promote() {
    const raw = await readFile(fileArg, "utf8");
    const entries = JSON.parse(raw) as unknown;
    if (!Array.isArray(entries) || entries.length === 0) throw new Error("Vetted file must be a non-empty JSON array.");
    const vetted = entries
        .filter((entry): entry is VettedEntry => typeof entry === "object" && entry !== null && typeof (entry as VettedEntry).label === "string")
        .map((entry) => ({ label: entry.label.trim().slice(0, 120), category: (entry.category ?? "Other").slice(0, 40), detail: (entry.detail ?? "").trim().slice(0, 300) }))
        .filter((entry) => entry.label.length > 0)
        .slice(0, 25);
    if (vetted.length === 0) throw new Error("No valid entries found in vetted file.");

    await client.connect();
    const source = await client.query<{ id: string }>(
        `INSERT INTO sources (name, base_url, source_tier, permission_status, rights_status, enabled, configuration)
         VALUES ('Community library entries', 'https://looply.local/community-library', 'seller_statement', 'curator_approved', 'demo_only', FALSE, $1::jsonb)
         ON CONFLICT (name) DO UPDATE SET configuration = EXCLUDED.configuration
         RETURNING id`,
        [JSON.stringify({ reviewer, approved_at: new Date().toISOString() })],
    );

    for (const entry of vetted) {
        const canonical = `https://looply.local/community-library/${contentHash(entry.label).slice(0, 16)}`;
        const document = await client.query<{ id: string }>(
            `INSERT INTO documents (source_id, canonical_url, title, document_type)
             VALUES ($1, $2, $3, 'community_library_entry')
             ON CONFLICT (source_id, canonical_url) DO UPDATE SET title = EXCLUDED.title
             RETURNING id`,
            [source.rows[0].id, canonical, entry.label],
        );
        const body = `${entry.label} (${entry.category}). ${entry.detail || "Community-contributed niche gear entry."} Treat as unverified: connection details are not confirmed by manufacturer documentation.`;
        const version = await client.query<{ id: string }>(
            `INSERT INTO document_versions (document_id, content_hash, parser_version, processing_status)
             VALUES ($1, $2, 'promote-v1', 'curated')
             ON CONFLICT (document_id, content_hash) DO UPDATE SET processing_status = 'curated'
             RETURNING id`,
            [document.rows[0].id, contentHash(body)],
        );
        await client.query("UPDATE documents SET current_version_id = $1 WHERE id = $2", [version.rows[0].id, document.rows[0].id]);

        const citation = `Community library entry — unverified (reviewed by ${reviewer})`;
        const chunks = chunkSections([{ heading: entry.label, body }], citation).slice(0, 3);
        const vectors = await requestEmbeddings(chunks.map((chunk) => chunk.content)).catch(() => null);
        for (let index = 0; index < chunks.length; index += 1) {
            await client.query(
                `INSERT INTO document_chunks (document_version_id, chunk_index, heading_path, content, token_count, topics, metadata, citation_label, embedding, embedding_model, embedding_dimension)
                 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::vector, $10, $11)
                 ON CONFLICT (document_version_id, chunk_index) DO UPDATE SET content = EXCLUDED.content, citation_label = EXCLUDED.citation_label`,
                [
                    version.rows[0].id,
                    index,
                    chunks[index].headingPath,
                    chunks[index].content,
                    Math.ceil(chunks[index].content.length / 4),
                    chunks[index].topics,
                    JSON.stringify({ reviewer, category: entry.category }),
                    citation,
                    vectors?.[index] ? `[${vectors[index].join(",")}]` : null,
                    vectors?.[index] ? EMBEDDING_MODEL : null,
                    vectors?.[index] ? vectors[index].length : null,
                ],
            );
        }
        console.log(`Promoted: ${entry.label}`);
    }
    console.log(`Promoted ${vetted.length} communitiy entry(ies) as seller_statement evidence. Mirror matching kb-community-* guides into src/lib/retrieval.ts.`);
}

promote()
    .finally(() => client.end())
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
