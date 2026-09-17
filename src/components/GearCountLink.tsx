"use client";

import Link from "next/link";
import { useGear } from "@/lib/gear-store";

export function GearCountLink() {
    const { count } = useGear();

    return (
        <Link href="/builder" className="saved-link" aria-label={`Open Loop Builder with ${count} saved items`}>
            My Gear <span>{count}</span>
        </Link>
    );
}
