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
        if (check) {
            const ruleCheck = checkBuildFallback(goal, owned, assignments);
            const hasPhantomRuleIssue = ruleCheck.issues.some((issue) => issue.severity === "block" && /48v|phantom/i.test(issue.message));
            const hasXlrCableRuleIssue = ruleCheck.issues.some((issue) => /xlr cable/i.test(issue.message));
            let issues = check.issues;
            let suggestions = check.suggestions;
            let swaps = check.swaps;
            if (!hasPhantomRuleIssue) {
                issues = issues.filter((issue) => !((issue.severity === "warn" || issue.severity === "block") && /48v|phantom/i.test(issue.message)));
                suggestions = suggestions.filter((suggestion) => !/48v|phantom/i.test(suggestion));
                swaps = swaps.filter((swap) => !/48v|phantom/i.test(swap.reason));
            }
            if (!hasXlrCableRuleIssue) {
                issues = issues.filter((issue) => !((issue.severity === "warn" || issue.severity === "block") && /xlr cable/i.test(issue.message)));
                suggestions = suggestions.filter((suggestion) => !/xlr cable/i.test(suggestion));
                swaps = swaps.filter((swap) => !/xlr cable/i.test(swap.reason));
            }
            const status = issues.some((issue) => issue.severity === "block") ? "blocked" : issues.some((issue) => issue.severity === "warn") ? "attention" : "ready";
            return NextResponse.json({ ...check, issues, suggestions, swaps, status, source: "model" });
        }
    } catch {
        // The deterministic rule engine below keeps Loop Check usable without the gateway.
    }
    return NextResponse.json({ ...checkBuildFallback(goal, owned, assignments), source: "catalogue fallback" });
}
