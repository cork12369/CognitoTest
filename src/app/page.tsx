import Link from "next/link";
import { BrowseExperience } from "@/components/BrowseExperience";
import { GearCountLink } from "@/components/GearCountLink";
import { ArrowIcon, MenuIcon, SparkleIcon } from "@/components/Icons";

export default function HomePage() {
    return (
        <main>
            <header className="site-header">
                <Link href="/" className="wordmark" aria-label="Looply home"><span>L</span>LOOPLY</Link>
                <nav className="desktop-nav" aria-label="Main navigation"><a href="#browse">Browse gear</a><Link href="/builder">Loop Builder</Link><Link href="/notes">Notes</Link></nav>
                <div className="header-actions"><GearCountLink /><button className="sell-button">Sell gear <ArrowIcon /></button><button className="menu-button" aria-label="Open menu"><MenuIcon /></button></div>
            </header>
            <BrowseExperience />
            <section className="how-section" id="how-it-works">
                <div className="how-copy"><p className="eyebrow"><span className="eyebrow-dot" /> Less research, more recording</p><h2>Compatibility is a<br /><em>better starting point.</em></h2></div>
                <div className="how-steps">
                    <article><span>01</span><h3>Save to My Gear</h3><p>Heart listings anywhere in the marketplace. They become the cart for your build.</p></article>
                    <article><span>02</span><h3>Build My Loop</h3><p>Open Loop Builder, add gear you already own, and drag saved items into the suggested slots.</p></article>
                    <article><span>03</span><h3>Run Loop Check</h3><p>Looply Assist evaluates every change for missing cables and connection caveats.</p></article>
                </div>
            </section>
            <section className="cta-band"><div><p className="eyebrow"><SparkleIcon /> Looply Assist</p><h2>Gear answers, without<br />the gear forums.</h2></div><Link href="/listing/focusrite-scarlett-2i2-4th-gen" className="cta-link">Ask Looply Assist <ArrowIcon /></Link></section>
            <footer className="site-footer"><Link href="/" className="wordmark"><span>L</span>LOOPLY</Link><p>Illustrative Singapore marketplace demo · No real transactions</p><Link href="/notes">Demo notes</Link></footer>
        </main>
    );
}