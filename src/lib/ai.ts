import { catalogueContext, listings, type Listing } from "./catalogue";

type ModelMessage = { role: "system" | "user"; content: string };

export async function requestModel(messages: ModelMessage[]) {
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    const baseUrl = process.env.AI_GATEWAY_BASE_URL;
    const model = process.env.AI_MODEL;

    if (!apiKey || !baseUrl || !model) return null;

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.15, response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) throw new Error(`Model request failed with ${response.status}`);
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Model returned no message content");
    return JSON.parse(content) as Record<string, unknown>;
}

const searchableWords = (text: string) => text.toLowerCase().replace(/[^a-z0-9+]+/g, " ").split(" ").filter((word) => word.length > 2);

export function fallbackSearch(query: string) {
    const words = searchableWords(query);
    const budget = Number(query.match(/(?:under|below|less than|budget of)\s*(?:s\$|\$)?(\d+)/i)?.[1]);
    const ranked = listings
        .map((listing) => {
            const haystack = `${listing.title} ${listing.category} ${listing.description} ${listing.tags.join(" ")} ${listing.facts.join(" ")} ${listing.ports.join(" ")} ${listing.compatibilitySummary}`.toLowerCase();
            let score = words.reduce((total, word) => total + (haystack.includes(word) ? 2 : 0), 0);
            if (!Number.isNaN(budget) && listing.price <= budget) score += 3;
            if (/vocal|sing|voice|podcast|microphone|mic/.test(query.toLowerCase()) && (listing.category === "Microphones" || listing.category === "Audio interfaces" || listing.category === "Accessories")) score += 3;
            if (/midi|keyboard|controller/.test(query.toLowerCase()) && listing.category === "MIDI controllers") score += 5;
            if (/monitor|speaker/.test(query.toLowerCase()) && listing.category === "Monitors") score += 5;
            if (/headphone/.test(query.toLowerCase()) && listing.category === "Headphones") score += 5;
            if (/interface|usb.?c|macbook|record/.test(query.toLowerCase()) && listing.category === "Audio interfaces") score += 4;
            return { listing, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
    const results = ranked.length > 0 ? ranked : listings.slice(0, 6).map((listing) => ({ listing, score: 0 }));
    return {
        listingIds: results.map(({ listing }) => listing.id),
        rationale: `Matched your request against category, connection, included-accessory, and price facts from the seeded catalogue.${Number.isNaN(budget) ? "" : ` Prioritised options at or below S$${budget}.`}`,
        source: "catalogue fallback" as const,
    };
}

export function fallbackAnswer(listing: Listing, question: string, comparison?: Listing) {
    const lowerQuestion = question.toLowerCase();
    const subject = comparison ? `${listing.title} and ${comparison.title}` : listing.title;
    let answer = `${listing.title}: ${listing.compatibilitySummary}`;
    if (/phantom|48v/.test(lowerQuestion)) {
        answer = listing.facts.some((fact) => /48V|phantom/i.test(fact))
            ? `${listing.title} has a catalogue fact stating that 48V phantom power is available. Whether it should be enabled depends on the connected microphone; the listing does not establish the condition of every connected device.`
            : `${listing.title}'s catalogue data does not state that it provides 48V phantom power. I cannot confirm phantom-power compatibility beyond the listed facts.`;
    } else if (/mac|usb.?c|computer|laptop/.test(lowerQuestion)) {
        answer = `${listing.title}: ${listing.facts.filter((fact) => /USB|Mac|host/i.test(fact)).join(". ") || "the catalogue has no stated computer-host fact."} ${listing.missing.length ? `The listing flags: ${listing.missing.join(", ")}.` : ""}`;
    } else if (/cable|connect|xlr|trs|adapter/.test(lowerQuestion)) {
        answer = `${listing.title} lists these connections: ${listing.ports.join("; ")}. Included: ${listing.included.join(", ")}. ${listing.missing.length ? `Still needed or worth checking: ${listing.missing.join(", ")}.` : "No missing accessories are recorded in this demo listing."}`;
    } else if (comparison) {
        answer = `${listing.title} is listed at S$${listing.price} (${listing.condition}); ${comparison.title} is S$${comparison.price} (${comparison.condition}). ${listing.title} facts: ${listing.facts.slice(0, 2).join("; ")}. ${comparison.title} facts: ${comparison.facts.slice(0, 2).join("; ")}. The catalogue does not provide a full performance comparison beyond these fields.`;
    }
    return { answer, knownFacts: listing.facts, unknowns: `This demo can only establish facts documented in the seeded catalogue for ${subject}; it cannot verify live condition, safety, authenticity, driver status, or unlisted accessories.` };
}

export const systemSearchPrompt = `You are RigGraph Search. Match a shopper request only to listing IDs in the supplied catalogue. Never invent product facts, IDs, prices, availability, or compatibility. Return JSON only: {"listingIds":["id"],"rationale":"brief evidence-grounded reason"}. Choose 1-6 IDs, ranking the strongest match first.\n\nCATALOGUE:\n${catalogueContext()}`;

export function systemQuestionPrompt(listing: Listing, comparison?: Listing) {
    return `You are RigGraph Catalogue Q&A. Answer only from these catalogue records. Do not infer facts, product safety, authenticity, a listing's current condition, electrical safety, undocumented operating-system support, or unlisted accessories. Clearly say what is unknown. Return JSON only: {"answer":"plain-language answer","knownFacts":["fact"],"unknowns":"what the catalogue cannot establish"}.\n\nPRIMARY LISTING:\n${catalogueContext([listing])}${comparison ? `\n\nCOMPARISON LISTING:\n${catalogueContext([comparison])}` : ""}`;
}