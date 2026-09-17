"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { findListing, listings, type Listing } from "@/lib/catalogue";
import { money } from "@/lib/format";
import { useGear, type CustomGear } from "@/lib/gear-store";
import {
    sanitizeCheck,
    sanitizeSlots,
    suggestSlotsFallback,
    type BuilderCheck,
    type BuildSlot,
    type OwnedItem,
} from "@/lib/builder";
import { ArrowIcon, CheckIcon, SparkleIcon } from "./Icons";

type PlacedItem = { kind: "listing"; id: string } | { kind: "custom"; id: string; label: string };
type Assignments = Record<string, PlacedItem>;

const GOAL_IDEAS = ["Vocal setup for a USB-C MacBook", "USB-C MIDI keyboard rig", "Studio monitors for mixing"];

function dragPayload(item: PlacedItem) {
    return JSON.stringify(item);
}

function parseDragPayload(raw: string): PlacedItem | null {
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) return null;
        const item = parsed as Record<string, unknown>;
        if (item.kind === "listing" && typeof item.id === "string" && findListing(item.id)) return { kind: "listing", id: item.id };
        if (item.kind === "custom" && typeof item.id === "string" && typeof item.label === "string" && item.label.trim()) {
            return { kind: "custom", id: item.id, label: item.label.slice(0, 120) };
        }
        return null;
    } catch {
        return null;
    }
}

function CartCard({
    listing,
    slots,
    onPlace,
}: {
    listing: Listing;
    slots: BuildSlot[];
    onPlace: (item: PlacedItem, slotId: string) => void;
}) {
    return (
        <article
            className="cart-card"
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData("application/x-looply-gear", dragPayload({ kind: "listing", id: listing.id }));
                event.dataTransfer.setData("text/plain", listing.id);
                event.dataTransfer.effectAllowed = "copy";
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={listing.image} alt="" className="cart-card-image" />
            <div className="cart-card-body">
                <p className="cart-card-category">{listing.category}</p>
                <strong>{listing.title}</strong>
                <span className="cart-card-price">{money(listing.price)}</span>
                <label className="cart-place">
                    <span>Place in</span>
                    <select defaultValue="" onChange={(event) => { if (event.target.value) onPlace({ kind: "listing", id: listing.id }, event.target.value); event.target.value = ""; }} aria-label={`Place ${listing.title} into a build slot`}>
                        <option value="">Choose slot…</option>
                        {slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
                    </select>
                </label>
            </div>
        </article>
    );
}

function LibraryCard({
    item,
    slots,
    onPlace,
    onRemove,
}: {
    item: CustomGear;
    slots: BuildSlot[];
    onPlace: (item: PlacedItem, slotId: string) => void;
    onRemove: (id: string) => void;
}) {
    return (
        <article
            className="cart-card library-card"
            draggable
            onDragStart={(event) => {
                event.dataTransfer.setData("application/x-looply-gear", dragPayload({ kind: "custom", id: item.id, label: item.label }));
                event.dataTransfer.setData("text/plain", item.label);
                event.dataTransfer.effectAllowed = "copy";
            }}
        >
            <div className="cart-card-body">
                <p className="cart-card-category">{item.category} · my library</p>
                <strong>{item.label}</strong>
                {item.detail && <span className="cart-card-note">{item.detail}</span>}
                <label className="cart-place">
                    <span>Place in</span>
                    <select defaultValue="" onChange={(event) => { if (event.target.value) onPlace({ kind: "custom", id: item.id, label: item.label }, event.target.value); event.target.value = ""; }} aria-label={`Place ${item.label} into a build slot`}>
                        <option value="">Choose slot…</option>
                        {slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
                    </select>
                </label>
                <button type="button" className="link-button" onClick={() => onRemove(item.id)}>Remove from library</button>
            </div>
        </article>
    );
}

function SlotCard({
    slot,
    placed,
    placedListing,
    dragOver,
    placeOptions,
    onDragOver,
    onDragLeave,
    onDrop,
    onPick,
    onClear,
}: {
    slot: BuildSlot;
    placed: PlacedItem | null;
    placedListing?: Listing;
    dragOver: boolean;
    placeOptions: { value: string; label: string }[];
    onDragOver: () => void;
    onDragLeave: () => void;
    onDrop: (item: PlacedItem) => void;
    onPick: (value: string) => void;
    onClear: () => void;
}) {
    return (
        <article
            className={`build-slot${placed ? " filled" : ""}${dragOver ? " drag-over" : ""}`}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; onDragOver(); }}
            onDragLeave={onDragLeave}
            onDrop={(event) => {
                event.preventDefault();
                const raw = event.dataTransfer.getData("application/x-looply-gear") || event.dataTransfer.getData("text/plain");
                const direct = parseDragPayload(raw);
                if (direct) {
                    onDrop(direct);
                    return;
                }
                const listing = findListing(raw.trim());
                if (listing) onDrop({ kind: "listing", id: listing.id });
            }}
        >
            <div className="slot-heading">
                <div>
                    <h3>{slot.label}</h3>
                    <p className="slot-reason">{slot.reason}</p>
                </div>
                <span className={`slot-tag${slot.required ? " required" : ""}`}>{slot.required ? "Needed" : "Optional"}</span>
            </div>
            {placed && placedListing ? (
                <div className="slot-filled">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={placedListing.image} alt="" />
                    <div>
                        <strong>{placedListing.title}</strong>
                        <span>{placedListing.category} · {money(placedListing.price)}</span>
                        <Link href={`/listing/${placedListing.id}`}>View listing</Link>
                    </div>
                    <button type="button" className="slot-clear" onClick={onClear} aria-label={`Remove ${placedListing.title} from ${slot.label}`}>✕</button>
                </div>
            ) : placed && placed.kind === "custom" ? (
                <div className="slot-filled">
                    <div>
                        <strong>{placed.label}</strong>
                        <span>My library entry · unverified</span>
                    </div>
                    <button type="button" className="slot-clear" onClick={onClear} aria-label={`Remove ${placed.label} from ${slot.label}`}>✕</button>
                </div>
            ) : (
                <div className="slot-empty">
                    <p>Drag a saved item here{slot.category !== "Any" ? ` · ${slot.category}` : ""}</p>
                    <label className="slot-pick">
                        <span>or pick</span>
                        <select defaultValue="" onChange={(event) => { if (event.target.value) onPick(event.target.value); event.target.value = ""; }} aria-label={`Assign an item to ${slot.label}`}>
                            <option value="">Choose item…</option>
                            {placeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                </div>
            )}
        </article>
    );
}

function CheckPanel({ check, isChecking, error, idle, onRetry }: { check: BuilderCheck | null; isChecking: boolean; error: string; idle: boolean; onRetry: () => void }) {
    if (idle) {
        return (
            <section className="check-panel" aria-live="polite">
                <div className="check-heading"><span className="question-mark"><SparkleIcon /></span><div><p className="eyebrow">Loop Check · Looply Assist</p><h2>Build something to check it.</h2></div></div>
                <p className="check-idle">Save gear with the hearts, tell the builder what you already own, then drag items into the suggested slots. The assistant evaluates every change automatically.</p>
            </section>
        );
    }
    if (isChecking && !check) {
        return (
            <section className="check-panel" aria-live="polite">
                <div className="check-heading"><span className="question-mark"><SparkleIcon /></span><div><p className="eyebrow">Loop Check · Looply Assist</p><h2>Checking your loop…</h2></div></div>
                <p className="check-idle">Reading ports, phantom power, cables, and missing accessories.</p>
            </section>
        );
    }
    if (error && !check) {
        return (
            <section className="check-panel" aria-live="polite">
                <div className="check-heading"><span className="question-mark"><SparkleIcon /></span><div><p className="eyebrow">Loop Check · Looply Assist</p><h2>Check hit a snag.</h2></div></div>
                <p className="search-error" role="alert">{error}</p>
                <button type="button" className="ask-button" onClick={onRetry}>Try again</button>
            </section>
        );
    }
    if (!check) return null;
    const chip = check.status === "ready" ? "ready" : check.status === "attention" ? "cable" : "check";
    const title = check.status === "ready" ? "Loop Check: ready" : check.status === "attention" ? "Loop Check: needs attention" : "Loop Check: blocked";
    return (
        <section className="check-panel" aria-live="polite">
            <div className="check-heading"><span className="question-mark"><SparkleIcon /></span><div><p className="eyebrow">Loop Check · {check.source === "model" ? "Looply Assist, grounded in catalogue" : "Catalogue-grounded check"}</p><h2>{title}</h2></div><span className={`compatibility-chip static ${chip}`}><CheckIcon /> {check.status}</span></div>
            {isChecking && <p className="check-refreshing">Re-checking latest change…</p>}
            {check.issues.length > 0 ? (
                <ul className="check-issues">
                    {check.issues.map((issue, index) => (
                        <li key={`${issue.severity}-${index}`} className={`issue-${issue.severity}`}><strong>{issue.severity === "block" ? "Blocked" : issue.severity === "warn" ? "Check" : "Note"}</strong><span>{issue.message}</span></li>
                    ))}
                </ul>
            ) : (
                <p className="check-idle">No incompatibilities found in the catalogue facts.</p>
            )}
            {check.suggestions.length > 0 && <div className="check-suggestions"><strong>Suggestions</strong><ul>{check.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul></div>}
            {check.swaps.length > 0 && (
                <div className="check-swaps"><strong>Smart Swap</strong>{check.swaps.map((swap) => (
                    <div key={swap.slotId} className="swap-row">
                        <p>{swap.reason}</p>
                        <div>{swap.listingIds.map((id) => {
                            const listing = findListing(id);
                            if (!listing) return null;
                            return <Link key={id} href={`/listing/${id}`}>{listing.title} · {money(listing.price)} <ArrowIcon /></Link>;
                        })}</div>
                    </div>
                ))}</div>
            )}
            {check.knownFacts.length > 0 && <div className="known-facts"><strong>Facts considered</strong><ul>{check.knownFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>}
            <div className="unknown-facts"><strong>Not established</strong><p>{check.unknowns}</p></div>
        </section>
    );
}

export function BuilderExperience() {
    const { savedIds, customGear, addCustomGear, removeCustomGear } = useGear();
    const [goal, setGoal] = useState("");
    const [owned, setOwned] = useState<OwnedItem[]>([]);
    const [slots, setSlots] = useState<BuildSlot[] | null>(null);
    const [suggestSource, setSuggestSource] = useState<"model" | "catalogue fallback">("catalogue fallback");
    const [isSuggesting, setIsSuggesting] = useState(true);
    const [assignments, setAssignments] = useState<Assignments>({});
    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
    const [cataloguePick, setCataloguePick] = useState("");
    const [customLabel, setCustomLabel] = useState("");
    const [customCategory, setCustomCategory] = useState("Other");
    const [customDetail, setCustomDetail] = useState("");
    const [check, setCheck] = useState<BuilderCheck | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [checkError, setCheckError] = useState("");
    const [checkNonce, setCheckNonce] = useState(0);
    const [suggestNonce, setSuggestNonce] = useState(0);

    const savedListings = useMemo(
        () => savedIds.map((id) => findListing(id)).filter((listing): listing is Listing => Boolean(listing)),
        [savedIds],
    );

    const ownedKey = JSON.stringify(owned);
    const assignmentsKey = JSON.stringify(assignments);
    const slotIdsKey = JSON.stringify(slots?.map((slot) => slot.id));
    const slotDetailsKey = JSON.stringify(slots?.map((slot) => ({ id: slot.id, label: slot.label, required: slot.required })) ?? []);

    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            const parsedOwned = JSON.parse(ownedKey) as OwnedItem[];
            setIsSuggesting(true);
            try {
                const response = await fetch("/api/builder/suggest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ goal, owned: parsedOwned }),
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error("Slots unavailable");
                const data: unknown = await response.json();
                const parsed = typeof data === "object" && data !== null ? (data as { slots?: unknown; source?: unknown }).slots : null;
                const next = sanitizeSlots({ slots: parsed });
                if (!next) throw new Error("Slots unavailable");
                if (controller.signal.aborted) return;
                setSlots(next);
                setSuggestSource((data as { source?: unknown }).source === "model" ? "model" : "catalogue fallback");
                setAssignments((current) => {
                    const ids = new Set(next.map((slot) => slot.id));
                    return Object.fromEntries(Object.entries(current).filter(([slotId]) => ids.has(slotId)));
                });
            } catch {
                if (controller.signal.aborted) return;
                setSlots(suggestSlotsFallback(goal, JSON.parse(ownedKey) as OwnedItem[]));
                setSuggestSource("catalogue fallback");
            } finally {
                if (!controller.signal.aborted) setIsSuggesting(false);
            }
        }, 600);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [goal, ownedKey, suggestNonce]);

    const assignedCount = slots?.filter((slot) => assignments[slot.id]).length ?? 0;
    const shouldCheck = Boolean(slots?.length) && (assignedCount > 0 || owned.length > 0);
    const displayCheck = shouldCheck ? check : null;

    useEffect(() => {
        if (!shouldCheck) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            const parsedOwned = JSON.parse(ownedKey) as OwnedItem[];
            const parsedAssignments = JSON.parse(assignmentsKey) as Assignments;
            const currentSlotIds = JSON.parse(slotIdsKey) as string[];
            const slotDetails = new Map((JSON.parse(slotDetailsKey) as BuildSlot[]).map((slot) => [slot.id, slot]));
            setIsChecking(true);
            setCheckError("");
            try {
                const payload = currentSlotIds.map((slotId) => {
                    const slot = slotDetails.get(slotId);
                    const placed = parsedAssignments[slotId];
                    return {
                        slotId,
                        slotLabel: slot?.label ?? "Build slot",
                        required: slot?.required ?? false,
                        ...(placed?.kind === "listing" ? { listingId: placed.id } : {}),
                        ...(placed?.kind === "custom" ? { customLabel: placed.label } : {}),
                    };
                });
                const response = await fetch("/api/builder/check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ goal, owned: parsedOwned, assignments: payload }),
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error("Loop Check is unavailable right now. Please try again.");
                const data: unknown = await response.json();
                const parsed = sanitizeCheck(data);
                if (!parsed) throw new Error("Loop Check returned an unexpected result. Please try again.");
                if (controller.signal.aborted) return;
                setCheck({ ...parsed, source: (data as { source?: unknown }).source === "model" ? "model" : "catalogue fallback" });
            } catch (error) {
                if (controller.signal.aborted) return;
                setCheckError(error instanceof Error ? error.message : "Loop Check is unavailable right now.");
            } finally {
                if (!controller.signal.aborted) setIsChecking(false);
            }
        }, 600);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [goal, ownedKey, assignmentsKey, slotIdsKey, slotDetailsKey, checkNonce, shouldCheck]);

    function placeInSlot(item: PlacedItem, slotId: string) {
        const slot = slots?.find((candidate) => candidate.id === slotId);
        if (!slot) return;
        if (item.kind === "listing") {
            const listing = findListing(item.id);
            if (!listing) return;
            if (slot.category !== "Any" && listing.category !== slot.category) {
                setCheckError(`${listing.title} is ${listing.category}, but the ${slot.label} slot expects ${slot.category}. It was still placed — Loop Check will flag any mismatch.`);
            }
        }
        setAssignments((current) => ({ ...current, [slotId]: item }));
        setDragOverSlot(null);
    }

    function placeByValue(value: string, slotId: string) {
        if (value.startsWith("listing:")) {
            placeInSlot({ kind: "listing", id: value.slice("listing:".length) }, slotId);
            return;
        }
        if (value.startsWith("custom:")) {
            const item = customGear.find((entry) => entry.id === value.slice("custom:".length));
            if (item) placeInSlot({ kind: "custom", id: item.id, label: item.label }, slotId);
        }
    }

    function addOwnedListing() {
        const listing = findListing(cataloguePick);
        if (!listing) return;
        setOwned((current) => (current.some((item) => item.listingId === listing.id) ? current : [...current, { id: `owned-${listing.id}`, source: "catalogue", listingId: listing.id, label: listing.title, category: listing.category }]));
        setCataloguePick("");
    }

    function addCustomOwned() {
        if (!customLabel.trim()) return;
        const item = addCustomGear({ label: customLabel, category: customCategory, detail: customDetail });
        setOwned((current) => [...current, { id: `owned-${item.id}`, source: "custom", label: item.label, category: item.category, detail: item.detail }]);
        setCustomLabel("");
        setCustomDetail("");
    }

    function addLibraryToOwned(id: string) {
        const item = customGear.find((entry) => entry.id === id);
        if (!item || owned.some((entry) => entry.id === `owned-${item.id}`)) return;
        setOwned((current) => [...current, { id: `owned-${item.id}`, source: "custom", label: item.label, category: item.category, detail: item.detail }]);
    }

    const placeOptions = useMemo(() => [
        ...savedListings.map((listing) => ({ value: `listing:${listing.id}`, label: `${listing.title} · ${money(listing.price)}` })),
        ...customGear.map((item) => ({ value: `custom:${item.id}`, label: `${item.label} · my library` })),
    ], [savedListings, customGear]);

    const buildTotal = useMemo(
        () => (slots ?? []).reduce((total, slot) => {
            const placed = assignments[slot.id];
            if (placed?.kind === "listing") return total + (findListing(placed.id)?.price ?? 0);
            return total;
        }, 0),
        [slots, assignments],
    );

    return (
        <>
            <section className="builder-hero">
                <div>
                    <p className="eyebrow"><span className="eyebrow-dot" /> Loop Builder</p>
                    <h1>Pick parts. Build your loop.</h1>
                    <p className="hero-description">Save gear from the marketplace, tell the builder what you already own, and drag items into the suggested slots. Looply Assist checks every change.</p>
                    <label className="builder-goal" htmlFor="builder-goal">What are you building?</label>
                    <input id="builder-goal" value={goal} onChange={(event) => setGoal(event.target.value.slice(0, 500))} placeholder="Try “vocal setup for a USB-C MacBook”" />
                    <div className="search-suggestions"><span>Popular:</span>{GOAL_IDEAS.map((idea) => <button key={idea} type="button" onClick={() => setGoal(idea)}>{idea}</button>)}</div>
                </div>
                <div className="builder-total-card">
                    <p className="eyebrow">My Loop</p>
                    <strong>{money(buildTotal)}</strong>
                    <span>{assignedCount} of {slots?.length ?? 0} slots filled · {suggestSource === "model" ? "Slots suggested by Looply Assist" : "Slots from catalogue matching"}</span>
                </div>
            </section>

            <section className="owned-section" aria-labelledby="owned-title">
                <div className="owned-heading"><h2 id="owned-title">Gear you already own</h2><p>The builder skips slots you have covered. Niche items are saved to your library for next time.</p></div>
                <div className="owned-grid">
                    <div className="owned-box">
                        <label htmlFor="owned-catalogue">Pick from the catalogue</label>
                        <div className="owned-row">
                            <select id="owned-catalogue" value={cataloguePick} onChange={(event) => setCataloguePick(event.target.value)}>
                                <option value="">Choose gear…</option>
                                {["Audio interfaces", "Microphones", "Monitors", "Headphones", "MIDI controllers", "Accessories"].map((category) => (
                                    <optgroup key={category} label={category}>
                                        {listings.filter((listing) => listing.category === category).map((listing) => <option key={listing.id} value={listing.id}>{listing.title}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                            <button type="button" onClick={addOwnedListing} disabled={!cataloguePick}>Add</button>
                        </div>
                    </div>
                    <div className="owned-box">
                        <label htmlFor="owned-custom">Niche or unlisted gear</label>
                        <div className="owned-row">
                            <input id="owned-custom" value={customLabel} onChange={(event) => setCustomLabel(event.target.value.slice(0, 120))} placeholder="e.g. Teenage Engineering OP-1" />
                            <select value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} aria-label="Niche gear category">
                                {["Audio interfaces", "Microphones", "Monitors", "Headphones", "MIDI controllers", "Accessories", "Other"].map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                        </div>
                        <div className="owned-row">
                            <input value={customDetail} onChange={(event) => setCustomDetail(event.target.value.slice(0, 300))} placeholder="Connections or notes (optional)" aria-label="Niche gear connection notes" />
                            <button type="button" onClick={addCustomOwned} disabled={!customLabel.trim()}>Save to library</button>
                        </div>
                    </div>
                </div>
                {owned.length > 0 && (
                    <ul className="owned-list">
                        {owned.map((item) => (
                            <li key={item.id}>
                                <span><strong>{item.label}</strong><small>{item.category ?? "Owned gear"}{item.source === "custom" ? " · my library" : ""}</small></span>
                                <button type="button" onClick={() => setOwned((current) => current.filter((entry) => entry.id !== item.id))} aria-label={`Remove ${item.label} from owned gear`}>✕</button>
                            </li>
                        ))}
                    </ul>
                )}
                {customGear.length > 0 && (
                    <div className="library-row">
                        <span>My library:</span>
                        {customGear.map((item) => (
                            <button key={item.id} type="button" onClick={() => addLibraryToOwned(item.id)} disabled={owned.some((entry) => entry.id === `owned-${item.id}`)}>+ {item.label}</button>
                        ))}
                    </div>
                )}
            </section>

            <div className="builder-layout">
                <aside className="builder-sidebar" aria-label="Saved gear">
                    <div className="sidebar-heading"><h2>My Gear cart</h2><span>{savedListings.length}</span></div>
                    <p className="sidebar-hint">Hearts from the marketplace land here. Drag a card into a slot — or use “Place in” on touch screens.</p>
                    {savedListings.length === 0 && (
                        <div className="sidebar-empty">
                            <p>Nothing saved yet.</p>
                            <Link href="/#browse">Browse the marketplace</Link>
                        </div>
                    )}
                    {savedListings.map((listing) => <CartCard key={listing.id} listing={listing} slots={slots ?? []} onPlace={placeInSlot} />)}
                    {customGear.length > 0 && (
                        <>
                            <div className="sidebar-heading sub"><h2>My library</h2><span>{customGear.length}</span></div>
                            {customGear.map((item) => <LibraryCard key={item.id} item={item} slots={slots ?? []} onPlace={placeInSlot} onRemove={removeCustomGear} />)}
                        </>
                    )}
                </aside>

                <div className="builder-main">
                    <div className="slots-heading">
                        <h2>Suggested slots</h2>
                        {isSuggesting ? <span>Updating…</span> : <button type="button" className="link-button" onClick={() => setSuggestNonce((value) => value + 1)}>Regenerate</button>}
                    </div>
                    {!slots || slots.length === 0 ? (
                        <div className="empty-state"><SparkleIcon /><h3>Suggesting your slots…</h3><p>Tell the builder your goal and owned gear above.</p></div>
                    ) : (
                        <div className="slot-grid">
                            {slots.map((slot) => {
                                const placed = assignments[slot.id] ?? null;
                                const placedListing = placed?.kind === "listing" ? findListing(placed.id) : undefined;
                                return (
                                    <SlotCard
                                        key={slot.id}
                                        slot={slot}
                                        placed={placed}
                                        placedListing={placedListing}
                                        dragOver={dragOverSlot === slot.id}
                                        placeOptions={placeOptions}
                                        onDragOver={() => setDragOverSlot(slot.id)}
                                        onDragLeave={() => setDragOverSlot((current) => (current === slot.id ? null : current))}
                                        onDrop={(item) => placeInSlot(item, slot.id)}
                                        onPick={(value) => placeByValue(value, slot.id)}
                                        onClear={() => setAssignments((current) => { const next = { ...current }; delete next[slot.id]; return next; })}
                                    />
                                );
                            })}
                        </div>
                    )}
                    {checkError && <p className="search-error" role="alert">{checkError}</p>}
                    <CheckPanel check={displayCheck} isChecking={shouldCheck && isChecking} error={shouldCheck ? checkError : ""} idle={!shouldCheck} onRetry={() => setCheckNonce((value) => value + 1)} />
                </div>
            </div>
        </>
    );
}
