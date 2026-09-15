import Link from "next/link";
import type { Listing } from "@/lib/catalogue";
import { money } from "@/lib/format";
import { CheckIcon, HeartIcon, PinIcon } from "./Icons";

export function ListingCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
    return (
        <article className="listing-card" style={{ animationDelay: `${index * 45}ms` }}>
            <Link href={`/listing/${listing.id}`} className="listing-image-wrap" aria-label={`View ${listing.title}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={listing.image} alt="" className="listing-image" style={{ objectPosition: listing.imagePosition }} />
                <span className={`compatibility-chip ${listing.compatibility === "Ready to connect" ? "ready" : listing.compatibility === "Cable needed" ? "cable" : "check"}`}>
                    <CheckIcon /> {listing.compatibility}
                </span>
                <button className="card-heart" aria-label={`Save ${listing.title}`} onClick={(event) => event.preventDefault()}><HeartIcon /></button>
            </Link>
            <div className="listing-info">
                <div className="listing-overline"><span>{listing.category}</span><span>{listing.published}</span></div>
                <div className="listing-title-row">
                    <h3><Link href={`/listing/${listing.id}`}>{listing.title}</Link></h3>
                    <strong>{money(listing.price)}</strong>
                </div>
                <p className="listing-meta"><PinIcon /> {listing.location} <span>·</span> {listing.condition}</p>
                <p className="listing-fit">{listing.compatibilitySummary}</p>
            </div>
        </article>
    );
}