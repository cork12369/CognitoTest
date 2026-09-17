import Link from "next/link";
import { BuilderExperience } from "@/components/BuilderExperience";
import { GearCountLink } from "@/components/GearCountLink";

export const metadata = {
    title: "Loop Builder — Looply",
    description: "Drag saved gear into adaptive build slots and let Looply Assist check compatibility.",
};

export default function BuilderPage() {
    return (
        <main>
            <header className="site-header compact-header">
                <Link href="/" className="wordmark" aria-label="Looply home"><span>L</span>LOOPLY</Link>
                <nav className="desktop-nav" aria-label="Main navigation"><Link href="/#browse">Browse gear</Link><Link href="/builder">Loop Builder</Link><Link href="/notes">Notes</Link></nav>
                <div className="header-actions"><GearCountLink /></div>
            </header>
            <div className="builder-page">
                <BuilderExperience />
            </div>
            <footer className="site-footer"><Link href="/" className="wordmark"><span>L</span>LOOPLY</Link><p>Illustrative Singapore marketplace demo · No real transactions</p><Link href="/notes">Demo notes</Link></footer>
        </main>
    );
}
