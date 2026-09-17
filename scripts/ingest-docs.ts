import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { requestEmbeddings } from "../src/lib/openrouter";
import { chunkSections, contentHash, extractRequirementHints, stripHtmlToSections } from "./ingest-lib";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Start Docker and add the local connection string to .env.local.");
}

const client = new Client({ connectionString: databaseUrl });
const MAX_URLS_PER_RUN = 50;
const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || "openai/text-embedding-3-small";

type IngestSource = {
    id: string;
    name: string;
    base_url: string;
    source_tier: string;
    allowed_paths: string[];
    disallowed_paths: string[];
    sitemap_url: string | null;
    seed_urls: string[];
    terms_reviewed_at: string | null;
    rate_limit_rps: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isPathAllowed(url: string, source: IngestSource) {
    let pathname = "";
    try {
        pathname = new URL(url).pathname;
    } catch {
        return false;
    }
    if (source.disallowed_paths.some((blocked) => blocked && pathname.startsWith(blocked))) return false;
    if (source.allowed_paths.length === 0) return true;
    return source.allowed_paths.some((allowed) => allowed && pathname.startsWith(allowed));
}

async function checkRobots(source: IngestSource, url: string) {
    let robots = "";
    try {
        const host = new URL(source.base_url).origin;
        const response = await fetch(`${host}/robots.txt`, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) return true;
        robots = await response.text();
    } catch {
        return false;
    }
    const pathname = new URL(url).pathname;
    const blocks: string[] = [];
    let applies = false;
    for (const line of robots.split("\n")) {
        const trimmed = line.trim();
        if (/^user-agent:\s*(\*|.*bot.*)/i.test(trimmed)) applies = true;
        else if (/^user-agent:/i.test(trimmed)) applies = false;
        else if (applies) {
            const disallow = trimmed.match(/^disallow:\s*(\S*)/i)?.[1] ?? null;
            if (disallow !== null) blocks.push(disallow);
        }
    }
    return !blocks.some((blocked) => blocked && (blocked === "/" || pathname.startsWith(blocked)));
}

async function discoverUrls(source: IngestSource): Promise<string[]> {
    const urls = new Set(source.seed_urls.filter((url) => isPathAllowed(url, source)));
    if (source.sitemap_url) {
        try {
            const response = await fetch(source.sitemap_url, { signal: AbortSignal.timeout(15_000) });
            if (response.ok) {
                const xml = await response.text();
                for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
                    const url = match[1].trim();
                    if (isPathAllowed(url, source)) urls.add(url);
                    if (urls.size >= MAX_URLS_PER_RUN) break;
                }
            }
        } catch {
            console.log(`  sitemap unavailable for ${source.name}; using seed URLs only.`);
        }
    }
    return [...urls].slice(0, MAX_URLS_PER_RUN);
}

async function fetchRaw(url: string) {
    const response = await fetch(url, {
        headers: { "User-Agent": "LooplyDocsBot/1.0 (+https://looply.local/ingestion-policy)" },
        signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 401 || response.status === 403) throw new Error(`blocked:${response.status}`);
    if (!response.ok) throw new Error(`fetch:${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    return { buffer, contentType };
}

async function ingest() {
    await client.connect();
    const sources = await client.query<IngestSource>("SELECT * FROM ingest_sources WHERE enabled = TRUE ORDER BY name");
    if (sources.rows.length === 0) {
        console.log("0 sources enabled. Approve a source in ingest_sources (enabled=TRUE, terms_reviewed_at set) and re-run.");
        return;
    }

    let ingested = 0;
    for (const source of sources.rows) {
        if (!source.terms_reviewed_at) {
            console.log(`Skipping ${source.name}: terms_reviewed_at is not set.`);
            continue;
        }
        console.log(`Source: ${source.name}`);
        const urls = await discoverUrls(source);
        console.log(`  ${urls.length} URL(s) discovered.`);
        const delayMs = Math.ceil(1000 / Math.max(Number(source.rate_limit_rps) || 0.25, 0.05));

        for (const url of urls) {
            try {
                if (!(await checkRobots(source, url))) {
                    console.log(`  skip (robots): ${url}`);
                    continue;
                }
                const { buffer, contentType } = await fetchRaw(url);
                const hash = contentHash(buffer);
                const existing = await client.query<{ content_hash: string | null }>("SELECT content_hash FROM ingest_documents WHERE discovered_url = $1", [url]);
                if (existing.rows[0]?.content_hash === hash) {
                    console.log(`  skip (unchanged): ${url}`);
                    continue;
                }
                const host = new URL(url).hostname.replace(/[^a-z0-9.-]+/gi, "_");
                const rawKey = `data/raw/${host}/${hash}.bin`;
                await mkdir(path.join(process.cwd(), "data", "raw", host), { recursive: true });
                await writeFile(path.join(process.cwd(), rawKey), buffer);

                const title = url.split("/").filter(Boolean).slice(-1)[0]?.replace(/[-_]+/g, " ") ?? url;
                const ingestDoc = await client.query<{ id: string }>(
                    `INSERT INTO ingest_documents (ingest_source_id, discovered_url, canonical_url, title, doc_type, raw_storage_key, content_hash, fetch_status, robots_checked_at)
                     VALUES ($1, $2, $3, $4, 'support_page', $5, $6, 'fetched', NOW())
                     ON CONFLICT (discovered_url) DO UPDATE SET content_hash = EXCLUDED.content_hash, fetch_status = 'fetched', raw_storage_key = EXCLUDED.raw_storage_key
                     RETURNING id`,
                    [source.id, url, url, title.slice(0, 200), rawKey, hash],
                );
                const ingestDocumentId = ingestDoc.rows[0].id;

                const isPdf = contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf");
                const textSections = isPdf ? [] : stripHtmlToSections(buffer.toString("utf8").slice(0, 500_000));
                const status = isPdf || textSections.length === 0 ? "raw_pending_parse" : "fetched";

                const document = await client.query<{ id: string }>(
                    `INSERT INTO documents (source_id, canonical_url, title, document_type, ingest_document_id)
                     VALUES ((SELECT id FROM sources WHERE name = 'Looply seeded demo catalogue'), $1, $2, 'ingested_support_page', $3)
                     ON CONFLICT (source_id, canonical_url) DO UPDATE SET title = EXCLUDED.title, ingest_document_id = EXCLUDED.ingest_document_id
                     RETURNING id`,
                    [url, title.slice(0, 200), ingestDocumentId],
                );
                const version = await client.query<{ id: string }>(
                    `INSERT INTO document_versions (document_id, content_hash, parser_version, processing_status)
                     VALUES ($1, $2, 'ingest-v1', $3)
                     ON CONFLICT (document_id, content_hash) DO UPDATE SET processing_status = EXCLUDED.processing_status
                     RETURNING id`,
                    [document.rows[0].id, hash, status],
                );
                await client.query("UPDATE documents SET current_version_id = $1 WHERE id = $2", [version.rows[0].id, document.rows[0].id]);

                if (status !== "raw_pending_parse") {
                    const citation = `${source.name} · ${title.slice(0, 80)}`;
                    const chunks = chunkSections(textSections, citation);
                    const vectors = await requestEmbeddings(chunks.map((chunk) => chunk.content)).catch(() => null);
                    for (let index = 0; index < chunks.length; index += 1) {
                        const chunk = chunks[index];
                        await client.query(
                            `INSERT INTO document_chunks (document_version_id, chunk_index, heading_path, content, token_count, topics, metadata, citation_label, ingest_document_id, embedding, embedding_model, embedding_dimension)
                             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::vector, $11, $12)
                             ON CONFLICT (document_version_id, chunk_index) DO UPDATE SET content = EXCLUDED.content, citation_label = EXCLUDED.citation_label`,
                            [
                                version.rows[0].id,
                                index,
                                chunk.headingPath,
                                chunk.content,
                                Math.ceil(chunk.content.length / 4),
                                chunk.topics,
                                JSON.stringify({ ...chunk.metadata, canonical_url: url }),
                                citation,
                                ingestDocumentId,
                                vectors?.[index] ? `[${vectors[index].join(",")}]` : null,
                                vectors?.[index] ? EMBEDDING_MODEL : null,
                                vectors?.[index] ? vectors[index].length : null,
                            ],
                        );
                    }

                    const evidence = await client.query<{ id: string }>(
                        `INSERT INTO product_evidence (product_id, document_version_id, claim, source_tier, source_url, confidence, review_status)
                         SELECT p.id, $2, $3, $4::source_tier, $5, 0.600, 'pending_review' FROM products p
                         WHERE p.slug = ANY(SELECT public_slug FROM marketplace_listings)
                         ON CONFLICT DO NOTHING RETURNING id`,
                        [version.rows[0].id, `${citation}: ${textSections[0]?.body.slice(0, 200) ?? "ingested support page"}`, "manufacturer", url],
                    ).catch(() => ({ rows: [] as { id: string }[] }));

                    const hints = extractRequirementHints(chunks.map((chunk) => chunk.content).join("\n").slice(0, 20_000));
                    for (const hint of hints.slice(0, 4)) {
                        await client.query(
                            `INSERT INTO product_requirements (product_id, requirement_type, value, evidence_id, confidence, review_status)
                             SELECT p.id, $2, $3::jsonb, $4, 0.600, 'pending_review' FROM products p LIMIT 1
                             ON CONFLICT DO NOTHING`,
                            [hint.type, JSON.stringify({ detail: hint.detail, canonical_url: url }), evidence.rows[0]?.id ?? null],
                        ).catch(() => undefined);
                    }
                }
                ingested += 1;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                await client.query("UPDATE ingest_documents SET fetch_status = $2 WHERE discovered_url = $1", [url, message.startsWith("blocked") ? "blocked" : "failed"]).catch(() => undefined);
                console.log(`  skip (${message}): ${url}`);
            }
            await sleep(delayMs);
        }
    }
    console.log(`Ingested or refreshed ${ingested} document(s).`);
}

ingest()
    .finally(() => client.end())
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
