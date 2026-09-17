import { findListing, listings, type Listing } from "./catalogue";

export type SlotCategory = Listing["category"] | "Any";

export type OwnedItem = {
    id: string;
    source: "catalogue" | "custom";
    listingId?: string;
    label: string;
    category?: string;
    detail?: string;
};

export type BuildSlot = {
    id: string;
    label: string;
    category: SlotCategory;
    required: boolean;
    reason: string;
};

export type SlotAssignment = {
    slotId: string;
    slotLabel: string;
    required: boolean;
    listingId?: string;
    customLabel?: string;
};

export type BuilderIssue = {
    slotId?: string;
    severity: "info" | "warn" | "block";
    message: string;
};

export type BuilderCheck = {
    status: "ready" | "attention" | "blocked";
    issues: BuilderIssue[];
    suggestions: string[];
    swaps: { slotId: string; listingIds: string[]; reason: string }[];
    knownFacts: string[];
    unknowns: string;
    source: "model" | "catalogue fallback";
};

export const SLOT_CATEGORIES: SlotCategory[] = [
    "Audio interfaces",
    "Microphones",
    "Monitors",
    "Headphones",
    "MIDI controllers",
    "Accessories",
    "Any",
];

const GENERIC_GOAL = "home recording setup";

const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const ownedCategories = (owned: OwnedItem[]) => {
    const cats = new Set<string>();
    for (const item of owned) {
        if (item.listingId) {
            const listing = findListing(item.listingId);
            if (listing) cats.add(listing.category);
        } else if (item.category) {
            cats.add(item.category);
        }
    }
    return cats;
};

export function suggestSlotsFallback(goal: string, owned: OwnedItem[]): BuildSlot[] {
    const text = goal.toLowerCase();
    const hasOwned = ownedCategories(owned);
    const generic = !text.trim() || /setup|studio|start|beginner|first|home|loop/.test(text);
    const wantsMic = generic || /vocal|sing|voice|podcast|mic|record|stream/.test(text);
    const wantsInterface = generic || /interface|record|macbook|computer|laptop|usb|vocal|mic|guitar/.test(text);
    const wantsMonitors = /monitor|speaker|mix|master/.test(text);
    const wantsHeadphones = generic || /headphone|late|night|quiet|practice/.test(text);
    const wantsMidi = /midi|keyboard|controller|keys|beat|produc|synth/.test(text);

    const slots: BuildSlot[] = [];
    if (wantsInterface && !hasOwned.has("Audio interfaces")) {
        slots.push({ id: "interface", label: "Audio interface", category: "Audio interfaces", required: true, reason: "No owned interface is listed, and the goal needs a way to get sound into the computer." });
    }
    if (wantsMic && !hasOwned.has("Microphones")) {
        slots.push({ id: "mic", label: "Microphone", category: "Microphones", required: true, reason: "No owned microphone is listed, and the goal involves recording a voice or instrument." });
    }
    if (wantsMonitors && !hasOwned.has("Monitors")) {
        slots.push({ id: "monitors", label: "Studio monitors", category: "Monitors", required: false, reason: "The goal mentions speakers or mixing, which a monitor pair covers." });
    }
    if (wantsHeadphones && !hasOwned.has("Headphones")) {
        slots.push({ id: "headphones", label: "Headphones", category: "Headphones", required: false, reason: "Headphones cover quiet tracking and late-night listening." });
    }
    if (wantsMidi && !hasOwned.has("MIDI controllers")) {
        slots.push({ id: "midi", label: "MIDI controller", category: "MIDI controllers", required: true, reason: "The goal mentions keys, beats, or MIDI control." });
    }
    if (slots.length === 0 && !hasOwned.has("Accessories")) {
        slots.push({ id: "cables", label: "Cables & stands", category: "Accessories", required: false, reason: "Your core roles look owned. Worth checking the cables and supports around them." });
    } else if (slots.length >= 2 && !hasOwned.has("Accessories")) {
        slots.push({ id: "cables", label: "Cables & stands", category: "Accessories", required: false, reason: "Interfaces, mics, and monitors usually need extra cables or a stand to actually connect." });
    }
    if (slots.length === 0) {
        slots.push({ id: "upgrade", label: "Next upgrade", category: "Any", required: false, reason: "Your setup looks covered. Drag in anything saved to compare an upgrade." });
    }
    return slots.slice(0, 6);
}

type ResolvedAssignment = SlotAssignment & { listing?: Listing };

const provides48V = (listing: Listing) => /48v|phantom/i.test(`${listing.facts.join(" ")} ${listing.ports.join(" ")} ${listing.tags.join(" ")}`);
const hasXlrInput = (listing: Listing) => /xlr/i.test(listing.ports.join(" "));
const hasHeadphoneOut = (listing: Listing) => /headphone/i.test(listing.ports.join(" "));
const hasBalancedOuts = (listing: Listing) => /balanced|output/i.test(listing.ports.join(" "));
const isUsbB = (listing: Listing) => /usb-b/i.test(`${listing.tags.join(" ")} ${listing.ports.join(" ")}`);
const micNeedsPhantom = (listing: Listing) => listing.category === "Microphones" && /48v|phantom|condenser/i.test(`${listing.facts.join(" ")} ${listing.tags.join(" ")}`);
const micNeedsXlr = (listing: Listing) => listing.category === "Microphones" && /xlr/i.test(listing.ports.join(" "));
const includesXlrCable = (listing: Listing) => /xlr cable/i.test(`${listing.included.join(" ")} ${listing.ports.join(" ")}`);

export function checkBuildFallback(goal: string, owned: OwnedItem[], assignments: SlotAssignment[]): BuilderCheck {
    const issues: BuilderIssue[] = [];
    const suggestions: string[] = [];
    const assignedIds = new Set<string>();
    const resolved: ResolvedAssignment[] = assignments.map((assignment) => {
        const listing = assignment.listingId ? findListing(assignment.listingId) : undefined;
        if (listing) assignedIds.add(listing.id);
        return { ...assignment, listing };
    });
    const byCategory = (category: Listing["category"]) => resolved.filter((item) => item.listing?.category === category).map((item) => item.listing as Listing);
    const interfaces = byCategory("Audio interfaces");
    const mics = byCategory("Microphones");
    const monitors = byCategory("Monitors");
    const headphones = byCategory("Headphones");
    const midi = byCategory("MIDI controllers");
    const accessories = byCategory("Accessories");
    const goalsUsbC = /usb.?c|macbook|laptop|computer/.test(goal.toLowerCase());

    for (const slot of resolved.filter((item) => !item.listing && !item.customLabel && item.required)) {
        issues.push({ slotId: slot.slotId, severity: "warn", message: `${slot.slotLabel} is still empty. Drag a saved item in or pick something from the marketplace.` });
    }

    for (const mic of mics) {
        if (micNeedsPhantom(mic)) {
            const powered = interfaces.find((item) => provides48V(item));
            if (interfaces.length === 0) {
                issues.push({ severity: "block", message: `${mic.title} needs 48V phantom power, but no audio interface is in the build yet.` });
                suggestions.push("Add an interface that provides 48V phantom power before relying on this condenser mic.");
            } else if (!powered) {
                issues.push({ severity: "block", message: `${mic.title} needs 48V phantom power, and none of the assigned interfaces state that they provide it.` });
            } else if (!includesXlrCable(mic) && !accessories.some((item) => includesXlrCable(item))) {
                issues.push({ severity: "warn", message: `${mic.title} connects over XLR. Add an XLR cable if one is not already included.` });
            }
        } else if (micNeedsXlr(mic)) {
            if (!interfaces.some((item) => hasXlrInput(item))) {
                issues.push({ severity: "block", message: `${mic.title} needs an XLR microphone input, but no assigned interface has one.` });
            } else if (!includesXlrCable(mic) && !accessories.some((item) => includesXlrCable(item))) {
                issues.push({ severity: "warn", message: `${mic.title} has no XLR cable in the build. The listing also flags this as missing.` });
            }
        }
    }

    for (const item of interfaces) {
        if (isUsbB(item) && goalsUsbC) {
            issues.push({ severity: "warn", message: `${item.title} uses a USB-B host connection. A USB-C computer needs an adapter or a USB-C to USB-B data cable.` });
            suggestions.push("Prefer a USB-C interface, or add a USB-C to USB-B data cable to the accessories slot.");
        }
    }

    if (monitors.length > 0) {
        if (interfaces.length === 0) {
            issues.push({ severity: "warn", message: "Powered monitors are assigned but no interface is in the build to feed them line-level audio." });
        } else if (!interfaces.some((item) => hasBalancedOuts(item))) {
            issues.push({ severity: "warn", message: "The assigned interface does not state balanced line outputs for these monitors." });
        }
        if (!accessories.some((item) => /trs|xlr|monitor cable/i.test(`${item.title} ${item.ports.join(" ")}`))) {
            issues.push({ severity: "warn", message: "A monitor pair normally needs two balanced cables. None are in the accessories slot." });
            suggestions.push("Add a pair of balanced TRS or XLR monitor cables.");
        }
    }

    for (const item of headphones) {
        if (interfaces.length > 0 && !interfaces.some((phone) => hasHeadphoneOut(phone)) && !/headphone/i.test(item.ports.join(" "))) {
            issues.push({ severity: "warn", message: `${item.title} needs a headphone output, and the assigned interface does not list one.` });
        }
    }

    if (midi.length > 0 && interfaces.length === 0 && monitors.length === 0 && headphones.length === 0) {
        issues.push({ severity: "info", message: "A MIDI controller sends control data only. It does not record audio or drive speakers by itself." });
        suggestions.push("Pair the MIDI controller with an interface plus headphones or monitors for a complete loop.");
    }

    for (const item of resolved) {
        if (!item.listing) continue;
        for (const missing of item.listing.missing) {
            issues.push({ slotId: item.slotId, severity: "warn", message: `${item.listing.title} flags “${missing}” as still needed or worth checking.` });
        }
    }

    for (const item of owned) {
        if (item.listingId && assignedIds.has(item.listingId)) {
            const listing = findListing(item.listingId);
            issues.push({ severity: "info", message: `${listing?.title ?? item.label} is listed as both owned and assigned. That is fine for planning; it is still one item.` });
        }
    }

    const customLabels = resolved.filter((item) => item.customLabel).map((item) => item.customLabel as string);
    for (const label of [...customLabels, ...owned.filter((item) => item.source === "custom").map((item) => item.label)]) {
        issues.push({ severity: "info", message: `“${label}” is a personal library entry, so connection details cannot be verified from the catalogue.` });
    }

    const swapFor = (slotId: string | undefined, category: Listing["category"], reason: string) => {
        const options = listings.filter((listing) => listing.category === category && !assignedIds.has(listing.id)).slice(0, 2);
        if (options.length > 0) {
            return { slotId: slotId ?? category, listingIds: options.map((listing) => listing.id), reason };
        }
        return null;
    };

    const swaps: BuilderCheck["swaps"] = [];
    const problemInterface = issues.find((issue) => /USB-B|phantom|balanced/.test(issue.message));
    if (problemInterface && interfaces.length > 0) {
        const swap = swapFor(resolved.find((item) => item.listing?.category === "Audio interfaces")?.slotId, "Audio interfaces", "Other interfaces in the demo catalogue worth comparing.");
        if (swap) swaps.push(swap);
    }
    const problemMic = issues.find((issue) => /XLR microphone input|48V/.test(issue.message));
    if (problemMic && mics.length > 0) {
        const swap = swapFor(resolved.find((item) => item.listing?.category === "Microphones")?.slotId, "Microphones", "Other microphones in the demo catalogue worth comparing.");
        if (swap) swaps.push(swap);
    }

    if (suggestions.length === 0) {
        if (issues.some((issue) => issue.severity !== "info")) suggestions.push("Fill the flagged slots above and re-check. The panel updates automatically.");
        else suggestions.push("This combination looks compatible on catalogue facts. Arrange a pickup to verify condition in person.");
    }

    const knownFacts = [...new Set(resolved.flatMap((item) => item.listing?.facts ?? []))].slice(0, 5);
    const status = issues.some((issue) => issue.severity === "block") ? "blocked" : issues.some((issue) => issue.severity === "warn") ? "attention" : "ready";

    return {
        status,
        issues: issues.slice(0, 8),
        suggestions: suggestions.slice(0, 5),
        swaps: swaps.slice(0, 3),
        knownFacts,
        unknowns: `This demo can only establish facts documented in the seeded catalogue${customLabels.length ? ", and personal library entries are unverified" : ""}; it cannot verify live condition, safety, authenticity, driver status, or unlisted accessories.`,
        source: "catalogue fallback",
    };
}

export function ownedSummary(owned: OwnedItem[]) {
    if (owned.length === 0) return "No owned equipment listed.";
    return owned
        .map((item) => {
            const listing = item.listingId ? findListing(item.listingId) : undefined;
            if (listing) return `${listing.title} (catalogue: ${listing.category}; facts: ${listing.facts.join(", ")})`;
            return `${item.label} (personal entry${item.category ? `: ${item.category}` : ""}${item.detail ? `; notes: ${item.detail}` : ""})`;
        })
        .join("\n");
}

export function sanitizeOwned(raw: unknown): OwnedItem[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item, index) => {
            const listingId = typeof item.listingId === "string" ? item.listingId : undefined;
            const listing = listingId ? findListing(listingId) : undefined;
            const label = typeof item.label === "string" && item.label.trim() ? item.label.trim().slice(0, 120) : listing?.title ?? `Owned item ${index + 1}`;
            return {
                id: typeof item.id === "string" && item.id ? item.id.slice(0, 80) : `owned-${index}`,
                source: item.source === "custom" ? "custom" as const : "catalogue" as const,
                listingId: listing?.id,
                label,
                category: typeof item.category === "string" ? item.category.slice(0, 40) : listing?.category,
                detail: typeof item.detail === "string" ? item.detail.slice(0, 300) : undefined,
            };
        })
        .slice(0, 20);
}

export function sanitizeSlots(raw: unknown): BuildSlot[] | null {
    if (typeof raw !== "object" || raw === null || !("slots" in raw) || !Array.isArray((raw as { slots: unknown }).slots)) return null;
    const slots = ((raw as { slots: unknown[] }).slots)
        .filter((slot: unknown): slot is Record<string, unknown> => typeof slot === "object" && slot !== null)
        .map((slot: Record<string, unknown>, index: number) => ({
            id: typeof slot.id === "string" && slot.id.trim() ? slot.id.trim().slice(0, 40) : `slot-${index + 1}`,
            label: typeof slot.label === "string" ? slot.label.trim().slice(0, 60) : "",
            category: SLOT_CATEGORIES.includes(slot.category as SlotCategory) ? (slot.category as SlotCategory) : "Any" as SlotCategory,
            required: typeof slot.required === "boolean" ? slot.required : true,
            reason: typeof slot.reason === "string" ? slot.reason.trim().slice(0, 200) : "",
        }))
        .filter((slot) => slot.label.length > 0);
    if (slots.length === 0 || slots.length > 6) return null;
    return slots;
}

export function sanitizeAssignments(raw: unknown): SlotAssignment[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item, index) => ({
            slotId: typeof item.slotId === "string" && item.slotId ? item.slotId.slice(0, 40) : `slot-${index + 1}`,
            slotLabel: typeof item.slotLabel === "string" && item.slotLabel.trim() ? item.slotLabel.trim().slice(0, 60) : "Build slot",
            required: typeof item.required === "boolean" ? item.required : false,
            listingId: typeof item.listingId === "string" && findListing(item.listingId) ? item.listingId : undefined,
            customLabel: typeof item.customLabel === "string" && item.customLabel.trim() ? item.customLabel.trim().slice(0, 120) : undefined,
        }))
        .slice(0, 10);
}

export function sanitizeCheck(raw: unknown): Omit<BuilderCheck, "source"> | null {
    if (typeof raw !== "object" || raw === null) return null;
    const data = raw as Record<string, unknown>;
    if (data.status !== "ready" && data.status !== "attention" && data.status !== "blocked") return null;
    const issues: BuilderIssue[] = (Array.isArray(data.issues) ? data.issues : [])
        .filter((issue): issue is Record<string, unknown> => typeof issue === "object" && issue !== null && hasText(issue.message))
        .map((issue): BuilderIssue => ({
            slotId: typeof issue.slotId === "string" ? issue.slotId.slice(0, 40) : undefined,
            severity: issue.severity === "block" || issue.severity === "warn" ? issue.severity : "info",
            message: (issue.message as string).trim().slice(0, 300),
        }))
        .slice(0, 8);
    const suggestions = (Array.isArray(data.suggestions) ? data.suggestions : [])
        .filter(hasText)
        .map((suggestion) => suggestion.trim().slice(0, 200))
        .slice(0, 5);
    const swaps = (Array.isArray(data.swaps) ? data.swaps : [])
        .filter((swap): swap is Record<string, unknown> => typeof swap === "object" && swap !== null)
        .map((swap) => ({
            slotId: typeof swap.slotId === "string" && swap.slotId ? swap.slotId.slice(0, 40) : "slot",
            listingIds: (Array.isArray(swap.listingIds) ? swap.listingIds : [])
                .filter((id): id is string => typeof id === "string" && Boolean(findListing(id)))
                .slice(0, 2),
            reason: typeof swap.reason === "string" ? swap.reason.trim().slice(0, 200) : "Worth comparing.",
        }))
        .filter((swap) => swap.listingIds.length > 0)
        .slice(0, 3);
    const knownFacts = (Array.isArray(data.knownFacts) ? data.knownFacts : [])
        .filter(hasText)
        .map((fact) => fact.trim().slice(0, 200))
        .slice(0, 5);
    return {
        status: data.status,
        issues,
        suggestions,
        swaps,
        knownFacts,
        unknowns: hasText(data.unknowns) ? data.unknowns.trim().slice(0, 700) : "The catalogue only establishes the listed product facts.",
    };
}

export const builderGoalPlaceholder = GENERIC_GOAL;
