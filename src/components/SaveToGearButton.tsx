"use client";

import { useGear } from "@/lib/gear-store";
import { HeartIcon } from "./Icons";

export function SaveToGearButton({ listingId, listingTitle }: { listingId: string; listingTitle: string }) {
    const { isSaved, toggle } = useGear();
    const saved = isSaved(listingId);

    return (
        <button
            type="button"
            className="detail-save"
            aria-pressed={saved}
            onClick={() => toggle(listingId)}
        >
            <HeartIcon filled={saved} /> {saved ? "Saved to My Gear" : "My Gear"}
            <span className="sr-only">{saved ? `Remove ${listingTitle} from My Gear` : `Add ${listingTitle} to My Gear`}</span>
        </button>
    );
}
