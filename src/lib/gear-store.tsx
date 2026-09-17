"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { findListing } from "./catalogue";

const GEAR_KEY = "looply:my-gear:v1";
const CUSTOM_KEY = "looply:custom-gear:v1";

export type CustomGear = {
    id: string;
    label: string;
    category: string;
    detail: string;
    createdAt: number;
};

type GearContextValue = {
    savedIds: string[];
    isSaved: (id: string) => boolean;
    toggle: (id: string) => void;
    count: number;
    customGear: CustomGear[];
    addCustomGear: (input: { label: string; category: string; detail: string }) => CustomGear;
    removeCustomGear: (id: string) => void;
};

const GearContext = createContext<GearContextValue | null>(null);

function readSavedIds(): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(GEAR_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return [...new Set(parsed.filter((id): id is string => typeof id === "string" && Boolean(findListing(id))))];
    } catch {
        // Corrupt or unavailable storage starts empty.
        return [];
    }
}

function readCustomGear(): CustomGear[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(CUSTOM_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item): item is CustomGear => typeof item === "object" && item !== null && typeof (item as CustomGear).id === "string" && typeof (item as CustomGear).label === "string")
            .map((item) => ({
                id: item.id,
                label: item.label.slice(0, 120),
                category: typeof item.category === "string" ? item.category : "Other",
                detail: typeof item.detail === "string" ? item.detail.slice(0, 300) : "",
                createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
            }));
    } catch {
        // Corrupt or unavailable storage starts empty.
        return [];
    }
}

export function GearProvider({ children }: { children: ReactNode }) {
    const [savedIds, setSavedIds] = useState<string[]>(() => readSavedIds());
    const [customGear, setCustomGear] = useState<CustomGear[]>(() => readCustomGear());

    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === GEAR_KEY) setSavedIds(readSavedIds());
            if (event.key === CUSTOM_KEY) setCustomGear(readCustomGear());
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    useEffect(() => {
        try {
            window.localStorage.setItem(GEAR_KEY, JSON.stringify(savedIds));
            window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(customGear));
        } catch {
            // Storage may be unavailable in private modes; the in-memory state still works.
        }
    }, [savedIds, customGear]);

    const toggle = useCallback((id: string) => {
        if (!findListing(id)) return;
        setSavedIds((ids) => (ids.includes(id) ? ids.filter((saved) => saved !== id) : [...ids, id]));
    }, []);

    const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

    const addCustomGear = useCallback((input: { label: string; category: string; detail: string }) => {
        const item: CustomGear = {
            id: `custom-${Date.now().toString(36)}`,
            label: input.label.trim().slice(0, 120),
            category: input.category,
            detail: input.detail.trim().slice(0, 300),
            createdAt: Date.now(),
        };
        setCustomGear((gear) => [item, ...gear].slice(0, 50));
        return item;
    }, []);

    const removeCustomGear = useCallback((id: string) => {
        setCustomGear((gear) => gear.filter((item) => item.id !== id));
    }, []);

    const value = useMemo(
        () => ({ savedIds, isSaved, toggle, count: savedIds.length, customGear, addCustomGear, removeCustomGear }),
        [savedIds, isSaved, toggle, customGear, addCustomGear, removeCustomGear],
    );

    return <GearContext.Provider value={value}>{children}</GearContext.Provider>;
}

export function useGear() {
    const gear = useContext(GearContext);
    if (!gear) throw new Error("useGear must be used within GearProvider");
    return gear;
}
