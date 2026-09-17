import { NextRequest, NextResponse } from "next/server";
import { checkBuildFallback, ownedSummary, sanitizeAssignments, sanitizeCheck, sanitizeOwned } from "@/lib/builder";
import { requestModel, systemBuilderCheckPrompt } from "@/lib/ai";
import { findListing } from "@/lib/catalogue";
import { retrievalContext, retrieveContext } from "@/lib/retrieval";

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({})) as { goal?: unknown; owned?: unknown; assignments?: unknown };
    const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 500) : "";
    const owned = sanitizeOwned(body.owned);
    const assignments = sanitizeAssignments(body.assignments);

    try {
        const assignedListings = assignments.map((assignment) => (assignment.listingId ? findListing(assignment.listingId) : undefined)).filter((listing): listing is NonNullable<typeof listing> => Boolean(listing));
        const query = [goal || "home recording setup", ownedSummary(owned), assignedListings.map((listing) => listing.title).join(", ")].join("\n").slice(0, 700);
        const documents = await retrieveContext(query, { limit: 5, requiredListings: assignedListings });
        if (!documents) throw new Error("Embedding retrieval unavailable");
        const modelResult = await requestModel([
            { role: "system", content: systemBuilderCheckPrompt(retrievalContext(documents)) },
            { role: "user", content: JSON.stringify({ goal, owned: ownedSummary(owned), assignments }).slice(0, 2000) },
        ]);
        const check = sanitizeCheck(modelResult);
        if (check) return NextResponse.json({ ...check, source: "model" });
    } catch {
        // The deterministic rule engine below keeps Loop Check usable without the gateway.
    }
    return NextResponse.json({ ...checkBuildFallback(goal, owned, assignments), source: "catalogue fallback" });
}
