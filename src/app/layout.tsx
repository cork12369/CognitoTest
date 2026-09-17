import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { GearProvider } from "@/lib/gear-store";
import "./globals.css";

const fredoka = Fredoka({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-display",
});

const nunito = Nunito({
    subsets: ["latin"],
    weight: ["400", "600", "700", "800"],
    variable: "--font-sans",
});

export const metadata: Metadata = {
    title: "Looply — Compatible music gear",
    description:
        "A clay-textured demo marketplace for compatible used home-recording gear in Singapore, with grounded AI search and catalogue Q&A.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
            <body><GearProvider>{children}</GearProvider></body>
        </html>
    );
}