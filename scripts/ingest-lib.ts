import { createHash } from "node:crypto";

export const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

export function contentHash(content: string | Buffer) {
    return createHash("sha256").update(content).digest("hex");
}

export function classifyPort(label: string) {
    const normalised = label.toLowerCase();
    if (normalised.includes("xlr")) return { connector: "XLR", signal: normalised.includes("input") ? "microphone" : "line", direction: normalised.includes("output") ? "output" : "input" };
    if (normalised.includes("usb")) return { connector: normalised.includes("usb-c") ? "USB-C" : "USB-B", signal: "usb", direction: "bidirectional" };
    if (normalised.includes("midi")) return { connector: normalised.includes("5-pin") ? "DIN-5" : "TRS", signal: "midi", direction: normalised.includes("out") ? "output" : normalised.includes("in") ? "input" : "bidirectional" };
    if (normalised.includes("headphone")) return { connector: normalised.includes("3.5") ? "3.5 mm TRS" : "¼ in TRS", signal: "headphone", direction: "output" };
    if (normalised.includes("power") || normalised.includes("iec")) return { connector: normalised.includes("iec") ? "IEC" : "Power", signal: "power", direction: "input" };
    if (normalised.includes("rca")) return { connector: "RCA", signal: normalised.includes("input") ? "line" : "line", direction: normalised.includes("output") ? "output" : "input" };
    if (normalised.includes("output")) return { connector: normalised.includes("trs") ? "TRS" : "¼ in", signal: "line", direction: "output" };
    return { connector: normalised.includes("trs") ? "TRS" : "Unknown", signal: "unknown", direction: "bidirectional" };
}

export function stripHtmlToSections(html: string): { heading: string; body: string }[] {
    const withoutScripts = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ");
    const sections: { heading: string; body: string }[] = [];
    const headingMatches = [...withoutScripts.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)];
    if (headingMatches.length === 0) {
        return [{ heading: "", body: cleanText(withoutScripts) }];
    }
    for (let index = 0; index < headingMatches.length; index += 1) {
        const match = headingMatches[index];
        const start = (match.index ?? 0) + match[0].length;
        const end = headingMatches[index + 1]?.index ?? withoutScripts.length;
        sections.push({ heading: cleanText(match[1]).slice(0, 120), body: cleanText(withoutScripts.slice(start, end)) });
    }
    return sections.filter((section) => section.body.length > 0);
}

function cleanText(html: string) {
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
}

export type ChunkInput = { content: string; headingPath: string[]; topics: string[]; metadata: Record<string, unknown> };

export function chunkSections(sections: { heading: string; body: string }[], sourceLabel: string, maxChars = 2800): ChunkInput[] {
    const chunks: ChunkInput[] = [];
    for (const section of sections) {
        let remaining = section.body;
        let part = 0;
        while (remaining.length > 0) {
            const slice = remaining.slice(0, maxChars);
            const topics = Array.from(
                new Set(
                    `${section.heading} ${slice.slice(0, 400)}`
                        .toLowerCase()
                        .split(/[^a-z0-9+]+/)
                        .filter((word) => ["xlr", "trs", "usb", "midi", "48v", "phantom", "monitor", "headphone", "rca", "balanced", "microphone", "interface"].includes(word)),
                ),
            );
            chunks.push({
                content: slice,
                headingPath: [sourceLabel, section.heading].filter(Boolean),
                topics,
                metadata: { source: sourceLabel, ...(part > 0 ? { part } : {}) },
            });
            if (remaining.length <= maxChars) break;
            const overlap = Math.floor(maxChars * 0.1);
            remaining = remaining.slice(maxChars - overlap);
            part += 1;
            if (chunks.length > 200) return chunks;
        }
    }
    return chunks;
}

export function extractRequirementHints(text: string): { type: string; detail: string }[] {
    const hints: { type: string; detail: string }[] = [];
    if (/48v|phantom power/i.test(text)) hints.push({ type: "phantom_power", detail: "May require 48V phantom power — verify against the specific microphone documentation." });
    if (/xlr (cable|microphone cable)/i.test(text)) hints.push({ type: "cable", detail: "XLR cable requirement mentioned — verify inclusion per listing." });
    if (/usb-c (adapter|cable)|usb-b/i.test(text)) hints.push({ type: "adapter", detail: "USB connector or adapter requirement mentioned — verify host compatibility." });
    if (/balanced (monitor|trs|xlr)/i.test(text)) hints.push({ type: "cable", detail: "Balanced monitor cabling mentioned — a stereo pair normally needs two cables." });
    return hints;
}
