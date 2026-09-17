import { NextRequest, NextResponse } from "next/server";
import { ownedSummary, sanitizeOwned, sanitizeSlots, suggestSlotsFallback } from "@/lib/builder";
import { requestModel, systemBuilderSlotsPrompt } from "@/lib/ai";
import { retrievalContext, retrieveContext } from "@/lib/retrieval";

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 500) : "";
    const owned = sanitizeOwned((body as { owned?: unknown }).owned);

    try {
        const query = [goal || "home recording setup", ownedSummary(owned)].join("\n").slice(0, 600);
        const documents = await retrieveContext(query, { limit: 6 });
        if (!documents) throw new Error("Embedding retrieval unavailable");
        const summary = ownedSummary(owned);
        const modelResult = await requestModel([
            { role: "system", content: systemBuilderSlotsPrompt(retrievalContext(documents), summary) },
            { role: "user", content: goal || "Suggest a starter home-recording setup." },
        ]);
        const slots = sanitizeSlots(modelResult);
        if (slots) return NextResponse.json({ slots, source: "model" });
    } catch {
        // Deterministic slot inference keeps the builder usable without the gateway.
    }
    return NextResponse.json({ slots: suggestSlotsFallback(goal, owned), source: "catalogue fallback" });
}
