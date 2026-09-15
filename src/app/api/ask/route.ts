import { NextRequest, NextResponse } from "next/server";
import { fallbackAnswer, requestModel, systemQuestionPrompt } from "@/lib/ai";
import { findListing } from "@/lib/catalogue";
import { retrievalContext, retrieveContext } from "@/lib/retrieval";

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const listingId = typeof body.listingId === "string" ? body.listingId : "";
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 700) : "";
    const comparisonId = typeof body.comparisonId === "string" ? body.comparisonId : undefined;
    const listing = findListing(listingId);
    const comparison = comparisonId ? findListing(comparisonId) : undefined;
    if (!listing || !question) return NextResponse.json({ error: "A valid listing and question are required." }, { status: 400 });

    try {
        const documents = await retrieveContext(question, { limit: 5, requiredListings: comparison ? [listing, comparison] : [listing] });
        if (!documents) throw new Error("Embedding retrieval unavailable");
        const modelResult = await requestModel([{ role: "system", content: systemQuestionPrompt(retrievalContext(documents)) }, { role: "user", content: question }]);
        if (typeof modelResult?.answer === "string") {
            return NextResponse.json({ answer: modelResult.answer.slice(0, 1000), knownFacts: Array.isArray(modelResult.knownFacts) ? modelResult.knownFacts.filter((fact): fact is string => typeof fact === "string").slice(0, 5) : [], unknowns: typeof modelResult.unknowns === "string" ? modelResult.unknowns.slice(0, 700) : "The catalogue only establishes the listed product facts.", source: "model" });
        }
    } catch {
        // The fallback is intentionally limited to seeded facts.
    }
    return NextResponse.json({ ...fallbackAnswer(listing, question, comparison), source: "catalogue fallback" });
}