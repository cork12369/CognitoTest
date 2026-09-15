import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Start Docker and add the local connection string to .env.local.");
}

const migrationsDirectory = path.join(process.cwd(), "database", "migrations");
const client = new Client({ connectionString: databaseUrl });

async function migrate() {
    await client.connect();
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
    const applied = new Set((await client.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((row) => row.name));

    for (const file of files) {
        if (applied.has(file)) continue;
        const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
        await client.query("BEGIN");
        try {
            await client.query(sql);
            await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
            await client.query("COMMIT");
            console.log(`Applied ${file}`);
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
    }
}

migrate()
    .finally(() => client.end())
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });