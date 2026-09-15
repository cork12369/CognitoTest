import { listings, type Listing } from "./catalogue";
import { requestEmbeddings } from "./openrouter";

type KnowledgeDocument = { id: string; kind: "listing" | "knowledge"; text: string; listing?: Listing };
type IndexedDocument = KnowledgeDocument & { vector: number[] };

const knowledgeBase: KnowledgeDocument[] = [
    { id: "kb-xlr-condenser", kind: "knowledge", text: "Condenser microphone guidance: an XLR condenser normally connects to an XLR microphone input and may require 48V phantom power. Use an XLR female-to-male cable. Enable phantom power only when the connected microphone documentation supports it." },
    { id: "kb-monitors", kind: "knowledge", text: "Powered monitor guidance: powered studio monitors accept line-level audio from an interface. A stereo pair normally needs two cables. Balanced TRS or XLR cables are preferred when both devices support them. Passive speakers are not equivalent to powered monitors." },
    { id: "kb-usb-host", kind: "knowledge", text: "USB guidance: USB-C describes a connector shape, not every data or driver capability. A USB-B audio interface can connect to a USB-C computer with an appropriate data cable or adapter, but do not guarantee driver or operating-system support without documented evidence." },
    { id: "kb-midi", kind: "knowledge", text: "MIDI guidance: a MIDI controller sends control data and does not itself provide audio recording inputs or speaker amplification. USB connects a controller to a computer; different TRS MIDI standards can require an appropriate adapter." },
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
    return [...required, ...ranked];
}

export function retrievalContext(documents: KnowledgeDocument[]) {
    return documents.map((document) => `[${document.kind.toUpperCase()} · ${document.id}]\n${document.text}`).join("\n\n");
}