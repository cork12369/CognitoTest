import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Looply — Compatible music gear",
    description: "A curated demo marketplace for compatible home-recording gear in Singapore.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}