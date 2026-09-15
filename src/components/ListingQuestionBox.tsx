"use client";

import { FormEvent, useState } from "react";
import type { Listing } from "@/lib/catalogue";
import { SendIcon, SparkleIcon } from "./Icons";

type Answer = { answer: string; knownFacts: string[]; unknowns: string; source: "model" | "catalogue fallback" };

const prompts = ["Will this work with a USB-C MacBook?", "What cable or adapter do I need?", "What can’t this listing confirm?"];

export function ListingQuestionBox({ listing, comparisons }: { listing: Listing; comparisons: Listing[] }) {
    const [question, setQuestion] = useState("");
    const [comparisonId, setComparisonId] = useState("");
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [isAsking, setIsAsking] = useState(false);
    const [error, setError] = useState("");

    async function ask(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!question.trim()) return;
        setIsAsking(true);
        setError("");
        try {
            const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId: listing.id, question, comparisonId: comparisonId || undefined }) });
            if (!response.ok) throw new Error("Question could not be answered");
            setAnswer(await response.json());
        } catch {
            setError("The catalogue assistant is unavailable right now. Please try again.");
        } finally {
            setIsAsking(false);
        }
    }

    return (
        <section className="question-box" aria-labelledby="question-title">
            <div className="question-heading"><span className="question-mark"><SparkleIcon /></span><div><p className="eyebrow">Grounded catalogue Q&amp;A</p><h2 id="question-title">Ask about this gear.</h2></div></div>
            <p>Answers use only the details in this demo&apos;s structured catalogue. Unknown facts stay unknown.</p>
            <div className="prompt-row">{prompts.map((prompt) => <button key={prompt} onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div>
            <form onSubmit={ask}>
                <label htmlFor="listing-question" className="sr-only">Ask a question about this listing</label>
                <textarea id="listing-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. Can I connect this to a condenser mic and MacBook?" rows={3} />
                <div className="question-actions"><label>Compare with <select value={comparisonId} onChange={(event) => setComparisonId(event.target.value)}><option value="">nothing else</option>{comparisons.map((comparison) => <option key={comparison.id} value={comparison.id}>{comparison.title}</option>)}</select></label><button className="ask-button" disabled={isAsking}>{isAsking ? "Checking catalogue…" : <><SendIcon /> Ask RigGraph</>}</button></div>
            </form>
            {error && <p className="search-error" role="alert">{error}</p>}
            {answer && <div className="answer-card"><div className="answer-label"><SparkleIcon /> {answer.source === "model" ? "Model answer, grounded in catalogue" : "Catalogue-grounded answer"}</div><p>{answer.answer}</p>{answer.knownFacts.length > 0 && <div className="known-facts"><strong>Facts considered</strong><ul>{answer.knownFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>}<div className="unknown-facts"><strong>Not established</strong><p>{answer.unknowns}</p></div></div>}
        </section>
    );
}