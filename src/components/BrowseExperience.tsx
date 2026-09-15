"use client";

import { FormEvent, useMemo, useState } from "react";
import { categories, listings, type Listing } from "@/lib/catalogue";
import { ListingCard } from "./ListingCard";
import { CheckIcon, SearchIcon, SlidersIcon, SparkleIcon } from "./Icons";

type SearchResponse = {
    listingIds: string[];
    rationale: string;
    source: "model" | "catalogue fallback";
};

export function BrowseExperience() {
    const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All gear");
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<SearchResponse | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState("");

    const visibleListings = useMemo(() => {
        const base = activeCategory === "All gear" ? listings : listings.filter((listing) => listing.category === activeCategory);
        if (!result) return base;
        return result.listingIds.map((id) => listings.find((listing) => listing.id === id)).filter((listing): listing is Listing => Boolean(listing));
    }, [activeCategory, result]);

    async function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            setResult(null);
            return;
        }
        setIsSearching(true);
        setSearchError("");
        try {
            const response = await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: trimmedQuery }),
            });
            if (!response.ok) throw new Error("Search unavailable");
            setResult(await response.json());
        } catch {
            setSearchError("We could not complete that search. Try a shorter request or browse the catalogue.");
        } finally {
            setIsSearching(false);
        }
    }

    function selectCategory(category: (typeof categories)[number]) {
        setActiveCategory(category);
        setResult(null);
        setQuery("");
    }

    return (
        <>
            <section className="hero-shell">
                <div className="hero-grid">
                    <div className="hero-copy">
                        <p className="eyebrow"><span className="eyebrow-dot" /> Singapore&apos;s used studio gear, decoded</p>
                        <h1>Build a loop<br /><em>that just works.</em></h1>
                        <p className="hero-description">Start in Loop Builder—shop pre-loved music gear with the ports, cables, and Loop Check details made clear before you buy.</p>
                        <form className="search-box" onSubmit={handleSearch}>
                            <SearchIcon className="search-icon" />
                            <label className="sr-only" htmlFor="main-search">Describe what you need</label>
                            <input id="main-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “vocal setup for a USB-C MacBook”" />
                            <button type="submit" disabled={isSearching}>{isSearching ? "Searching" : "Find gear"}</button>
                        </form>
                        <div className="search-suggestions"><span>Popular:</span><button onClick={() => { setQuery("vocal recording setup"); setResult(null); }}>Vocal recording</button><button onClick={() => { setQuery("USB-C MIDI keyboard"); setResult(null); }}>MIDI for MacBook</button><button onClick={() => { setQuery("studio monitors for an interface"); setResult(null); }}>Studio monitors</button></div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
                        <div className="hero-signal one" /><div className="hero-signal two" />
                        <div className="hero-device interface"><span>INPUT</span><i /><i /><i /><i /><b>48V</b></div>
                        <div className="hero-device mic"><span>MIC</span><div /></div>
                        <div className="hero-device laptop"><span>LOOP<br />LY</span></div>
                        <div className="hero-label label-mic">RØDE NT1 <small>XLR · 48V</small></div>
                        <div className="hero-label label-interface">Scarlett 2i2 <small>USB-C</small></div>
                        <div className="hero-label label-laptop">Your computer <small>USB-C host</small></div>
                        <div className="hero-status"><span><CheckIcon /></span><div><strong>Loop Check</strong><small>One cable included</small></div></div>
                    </div>
                </div>
            </section>

            <section className="catalogue-section" id="browse">
                <div className="catalogue-heading">
                    <div><p className="eyebrow"><span className="eyebrow-dot" /> Curated for first setups</p><h2>Find your next piece.</h2></div>
                    <button className="filter-button"><SlidersIcon /> Filters <span>0</span></button>
                </div>
                <div className="category-tabs" role="tablist" aria-label="Gear categories">
                    {categories.map((category) => <button key={category} role="tab" aria-selected={activeCategory === category} className={activeCategory === category ? "active" : ""} onClick={() => selectCategory(category)}>{category}</button>)}
                </div>
                {result && <div className="ai-result-note"><SparkleIcon /><div><strong>{result.source === "model" ? "Looply Assist matched the catalogue" : "Catalogue-matched search"}</strong><span>{result.rationale}</span></div><button onClick={() => { setResult(null); setQuery(""); }}>Clear</button></div>}
                {searchError && <p className="search-error" role="alert">{searchError}</p>}
                <div className="listing-grid">
                    {visibleListings.map((listing, index) => <ListingCard key={listing.id} listing={listing} index={index} />)}
                </div>
                {visibleListings.length === 0 && <div className="empty-state"><SparkleIcon /><h3>No exact match yet</h3><p>Try mentioning a category, budget, or connection type—like “XLR microphone” or “USB-C interface”.</p><button onClick={() => { setResult(null); setQuery(""); }}>See all gear</button></div>}
            </section>
        </>
    );
}