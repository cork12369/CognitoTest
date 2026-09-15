import Link from "next/link";
import { BrowseExperience } from "@/components/BrowseExperience";
import { ArrowIcon, MenuIcon, SparkleIcon } from "@/components/Icons";

export default function HomePage() {
    return (
        <main>
            <header className="site-header">
                <Link href="/" className="wordmark" aria-label="RigGraph home"><span>R</span>RIGGRAPH</Link>
                <nav className="desktop-nav" aria-label="Main navigation"><a href="#browse">Browse gear</a><a href="#how-it-works">How it works</a><Link href="/notes">Notes</Link></nav>
                <div className="header-actions"><button className="saved-link">Saved <span>0</span></button><button className="sell-button">Sell gear <ArrowIcon /></button><button className="menu-button" aria-label="Open menu"><MenuIcon /></button></div>
            </header>
            <BrowseExperience />
            <section className="how-section" id="how-it-works">
                <div className="how-copy"><p className="eyebrow"><span className="eyebrow-dot" /> Less research, more recording</p><h2>Compatibility is a<br /><em>better starting point.</em></h2></div>
                <div className="how-steps">
                    <article><span>01</span><h3>Tell us the goal</h3><p>Search in your own words—gear, budget, computer, and what you want to create.</p></article>
                    <article><span>02</span><h3>See the real details</h3><p>Every demo listing carries structured ports, accessories, and sourced product facts.</p></article>
                    <article><span>03</span><h3>Connect with confidence</h3><p>Spot missing cables and connection caveats before you arrange a pickup.</p></article>
                </div>
            </section>
            <section className="cta-band"><div><p className="eyebrow"><SparkleIcon /> AI-assisted catalogue</p><h2>Gear answers, without<br />the gear forums.</h2></div><Link href="/listing/focusrite-scarlett-2i2-4th-gen" className="cta-link">Try listing Q&amp;A <ArrowIcon /></Link></section>
            <footer className="site-footer"><Link href="/" className="wordmark"><span>R</span>RIGGRAPH</Link><p>Illustrative Singapore marketplace demo · No real transactions</p><Link href="/notes">Demo notes</Link></footer>
        </main>
    );
}