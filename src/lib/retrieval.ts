import { listings, type Listing } from "./catalogue";
import { getRelevantChunks, isDatabaseConfigured } from "./database";
import { requestEmbeddings } from "./openrouter";

export type KnowledgeDocument = { id: string; kind: "listing" | "knowledge"; text: string; listing?: Listing };
type IndexedDocument = KnowledgeDocument & { vector: number[] };

const knowledgeBase: KnowledgeDocument[] = [
    { id: "kb-xlr-condenser", kind: "knowledge", text: "Condenser microphone guidance: an XLR condenser normally connects to an XLR microphone input and may require 48V phantom power. Use an XLR female-to-male cable. Enable phantom power only when the connected microphone documentation supports it." },
    { id: "kb-monitors", kind: "knowledge", text: "Powered monitor guidance: powered studio monitors accept line-level audio from an interface. A stereo pair normally needs two cables. Balanced TRS or XLR cables are preferred when both devices support them. Passive speakers are not equivalent to powered monitors." },
    { id: "kb-usb-host", kind: "knowledge", text: "USB guidance: USB-C describes a connector shape, not every data or driver capability. A USB-B audio interface can connect to a USB-C computer with an appropriate data cable or adapter, but do not guarantee driver or operating-system support without documented evidence." },
    { id: "kb-midi", kind: "knowledge", text: "MIDI guidance: a MIDI controller sends control data and does not itself provide audio recording inputs or speaker amplification. USB connects a controller to a computer; different TRS MIDI standards can require an appropriate adapter." },
    { id: "kb-gain-staging", kind: "knowledge", text: "Gain staging guidance: set recording level with the interface preamp gain so the signal is clear without clipping, then set listening volume with the monitor or headphone volume. If a dynamic microphone sounds quiet, add preamp gain before judging the microphone." },
    { id: "kb-balanced-vs-unbalanced", kind: "knowledge", text: "Balanced connection guidance: TRS and XLR balanced cables reject interference better than unbalanced TS or RCA cables over longer runs. Prefer balanced cables when both the interface output and the monitor input support them." },
    { id: "kb-headphone-monitoring", kind: "knowledge", text: "Headphone monitoring guidance: most audio interfaces include a headphone output that drives common closed-back studio headphones directly. A 3.5 mm plug with a 1/4 in adapter fits common interface headphone jacks." },
    { id: "kb-mic-stands", kind: "knowledge", text: "Microphone support guidance: vocal microphones mount on a boom stand with a standard microphone clip thread, and a pop filter controls plosives. Stands and pop filters carry no audio signal, so they never need phantom power or drivers." },
    { id: "kb-usb-power", kind: "knowledge", text: "USB power guidance: compact interfaces and MIDI controllers are commonly bus-powered over USB, while powered monitors need their own IEC mains power. A USB hub that cannot deliver enough power can cause dropouts; connect bus-powered audio gear directly where possible." },
    { id: "kb-monitor-placement", kind: "knowledge", text: "Monitor placement guidance: place a powered monitor pair at head height, angled toward the listening position and away from walls where possible. This is general setup guidance; room acoustics vary and the catalogue cannot verify any specific room." },
    { id: "kb-48v-safety", kind: "knowledge", text: "Phantom power safety guidance: enable 48V phantom power only for microphones whose documentation states they need it, normally condensers. Dynamic microphones do not require phantom power; whether any specific microphone tolerates it is unknown unless its documentation states so." },
    { id: "kb-dynamic-vs-condenser", kind: "knowledge", text: "Microphone type guidance: dynamic microphones such as stage vocal models need no phantom power and typically need more preamp gain than condensers. Condenser microphones are more sensitive, commonly need 48V phantom power, and pair with a shock mount and pop filter for vocals." },
];

const listingDocuments: KnowledgeDocument[] = listings.map((listing) => ({
    id: `listing:${listing.id}`,
    kind: "listing",
    listing,
    text: `${listing.id}: ${listing.title}; category=${listing.category}; price=S$${listing.price}; condition=${listing.condition}; description=${listing.description}; tags=${listing.tags.join(", ")}; ports=${listing.ports.join(", ")}; included=${listing.included.join(", ")}; missing=${listing.missing.join(", ") || "none"}; facts=${listing.facts.join(", ")}; Loop Check=${listing.compatibility}; summary=${listing.compatibilitySummary}; evidence=${listing.evidence}.`,
}));

const corpus = [...listingDocuments, ...knowledgeBase];
let indexPromise: Promise<IndexedDocument[] | null> | undefined;

function cosine(left: number[], right: number[]) {
    if (left.length !== right.length) return 0;
    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    for (let index = 0; index < left.length; index += 1) {
        dot += left[index] * right[index];
        leftMagnitude += left[index] ** 2;
        rightMagnitude += right[index] ** 2;
    }
    return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0;
}

async function getIndex() {
    if (!indexPromise) {
        indexPromise = requestEmbeddings(corpus.map((document) => document.text))
            .then((vectors) => vectors?.map((vector, index) => ({ ...corpus[index], vector })) ?? null)
            .catch(() => null);
    }
    return indexPromise;
}

export async function retrieveDbChunks(query: string, limit = 2): Promise<KnowledgeDocument[]> {
    if (!isDatabaseConfigured()) return [];
    try {
        const vectors = await requestEmbeddings([query]).catch(() => null);
        const chunks = await getRelevantChunks({ queryVector: vectors?.[0], queryText: query, limit: Math.min(Math.max(limit, 1), 3) });
        return chunks.map((chunk) => ({
            id: `db:${chunk.id}`,
            kind: "knowledge" as const,
            text: chunk.citation ? `${chunk.content}\n(Source: ${chunk.citation})` : chunk.content,
        }));
    } catch {
        return [];
    }
}

export async function retrieveContext(query: string, options?: { limit?: number; requiredListings?: Listing[] }) {
    const [index, vectors] = await Promise.all([getIndex(), requestEmbeddings([query])]);
    const queryVector = vectors?.[0];
    if (!index || !queryVector) return null;
    const requiredIds = new Set(options?.requiredListings?.map((listing) => `listing:${listing.id}`));
    const required = options?.requiredListings?.map((listing) => listingDocuments.find((document) => document.id === `listing:${listing.id}`)).filter((document): document is KnowledgeDocument => Boolean(document)) ?? [];
    const ranked = index
        .filter((document) => !requiredIds.has(document.id))
        .map((document) => ({ document, score: cosine(queryVector, document.vector) }))
        .sort((left, right) => right.score - left.score)
        .slice(0, options?.limit ?? 6)
        .map(({ document }) => document);
    const dbDocs = (await retrieveDbChunks(query, 2)).filter((document) => !requiredIds.has(document.id));
    return [...required, ...ranked, ...dbDocs];
}

export function retrievalContext(documents: KnowledgeDocument[]) {
    return documents.map((document) => `[${document.kind.toUpperCase()} · ${document.id}]\n${document.text}`).join("\n\n");
}