import { NextRequest, NextResponse } from "next/server";
import { fallbackSearch, requestModel, systemSearchPrompt } from "@/lib/ai";
import { listings } from "@/lib/catalogue";

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 500) : "";
    if (!query) return NextResponse.json({ error: "A search query is required." }, { status: 400 });

    try {
        const modelResult = await requestModel([{ role: "system", content: systemSearchPrompt }, { role: "user", content: query }]);
        const ids = Array.isArray(modelResult?.listingIds) ? modelResult.listingIds.filter((id): id is string => typeof id === "string" && listings.some((listing) => listing.id === id)).slice(0, 6) : [];
        if (ids.length > 0) return NextResponse.json({ listingIds: ids, rationale: typeof modelResult?.rationale === "string" ? modelResult.rationale.slice(0, 500) : "Matched to structured catalogue facts.", source: "model" });
    } catch {
        // Deterministic catalogue search keeps the demo usable when the optional gateway is unavailable.
    }
    return NextResponse.json(fallbackSearch(query));
}