/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingQuestionBox } from "@/components/ListingQuestionBox";
import { ArrowIcon, CheckIcon, HeartIcon, PinIcon, SparkleIcon } from "@/components/Icons";
import { findListing, listings } from "@/lib/catalogue";
import { money } from "@/lib/format";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const listing = findListing(id);
    if (!listing) notFound();
    const related = listings.filter((item) => item.category === listing.category && item.id !== listing.id).slice(0, 3);

    return (
        <main>
            <header className="site-header compact-header"><Link href="/" className="wordmark" aria-label="RigGraph home"><span>R</span>RIGGRAPH</Link><nav className="desktop-nav"><Link href="/">Browse gear</Link><Link href="/notes">Notes</Link></nav><Link className="back-link" href="/">← Back to browse</Link></header>
            <div className="breadcrumbs"><Link href="/">Marketplace</Link><span>/</span><Link href={`/?category=${listing.category}`}>{listing.category}</Link><span>/</span><span>{listing.brand}</span></div>
            <section className="detail-layout">
                <div className="detail-gallery"><div className="detail-image-wrap"><img src={listing.image} alt={`${listing.title} listing photo`} className="detail-image" style={{ objectPosition: listing.imagePosition }} /><button className="detail-save"><HeartIcon /> Save</button><span className={`compatibility-chip large ${listing.compatibility === "Ready to connect" ? "ready" : listing.compatibility === "Cable needed" ? "cable" : "check"}`}><CheckIcon /> {listing.compatibility}</span></div><p className="photo-caption">Illustrative listing photo · Product and condition details are seeded for this demo.</p></div>
                <aside className="detail-summary"><p className="eyebrow"><span className="eyebrow-dot" /> {listing.category}</p><h1>{listing.title}</h1><div className="price-row"><strong>{money(listing.price)}</strong><span>{listing.condition}</span></div><p className="detail-location"><PinIcon /> {listing.location} · Pickup preferred</p><div className="seller-row"><span className="seller-avatar">{listing.sellerInitials}</span><div><strong>{listing.seller}</strong><small>Seller rating {listing.sellerRating.toFixed(1)} ★</small></div><span className="reply-time">Replies in a few hours</span></div><button className="request-button">Request to buy <ArrowIcon /></button><p className="simulated-label">Demo only · Request, payment, and pickup are simulated</p></aside>
            </section>
            <section className="detail-content">
                <div className="detail-main"><section className="content-section"><h2>About this listing</h2><p>{listing.description}</p><div className="tag-row">{listing.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>
                    <section className="compatibility-panel"><div className="panel-icon"><SparkleIcon /></div><div><p className="eyebrow">Compatibility snapshot</p><h2>{listing.compatibility}</h2><p>{listing.compatibilitySummary}</p></div></section>
                    <section className="signal-section"><div><p className="eyebrow"><span className="eyebrow-dot" /> Connection map</p><h2>What it connects to.</h2><p>Structured compatibility notes are illustrative and limited to the seeded product record.</p></div><div className="signal-map"><div className="signal-node product-node"><span>{listing.brand.slice(0, 1)}</span><strong>{listing.model}</strong><small>{listing.ports[0]}</small></div><div className="signal-line" /><div className="signal-node target-node"><span>↔</span><strong>Compatible gear</strong><small>{listing.compatibilitySummary}</small></div></div></section>
                    <ListingQuestionBox listing={listing} comparisons={related} />
                </div>
                <aside className="detail-side"><section><h3>Ports &amp; connections</h3><ul>{listing.ports.map((port) => <li key={port}>{port}</li>)}</ul></section><section><h3>Included</h3><ul className="check-list">{listing.included.map((item) => <li key={item}><CheckIcon /> {item}</li>)}</ul></section><section className={listing.missing.length ? "needs-section" : ""}><h3>{listing.missing.length ? "Still needed / check" : "No missing gear noted"}</h3>{listing.missing.length > 0 && <ul>{listing.missing.map((item) => <li key={item}>{item}</li>)}</ul>}</section><section className="evidence-section"><p className="eyebrow">Evidence source</p><p>{listing.evidence}</p><small>Demo records preserve source context so AI answers can acknowledge their boundaries.</small></section></aside>
            </section>
            {related.length > 0 && <section className="related-section"><div><p className="eyebrow"><span className="eyebrow-dot" /> Same category</p><h2>Compare similar gear.</h2></div><div className="related-links">{related.map((item) => <Link href={`/listing/${item.id}`} key={item.id}><span>{item.brand}</span><strong>{item.title}</strong><em>{money(item.price)}</em><ArrowIcon /></Link>)}</div></section>}
            <footer className="site-footer"><Link href="/" className="wordmark"><span>R</span>RIGGRAPH</Link><p>Illustrative Singapore marketplace demo · No real transactions</p><Link href="/notes">Demo notes</Link></footer>
        </main>
    );
}