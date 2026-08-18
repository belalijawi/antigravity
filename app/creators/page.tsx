"use client";

import { useState, FormEvent } from "react";
import { submitAmbassadorApplication } from "@/lib/firebase";

function Field({
    label,
    optional,
    children,
}: {
    label: string;
    optional?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="mb-6">
            <label className="block text-sm text-white/70 mb-2">
                {label}
                {optional && <span className="text-white/40"> (optional)</span>}
            </label>
            {children}
        </div>
    );
}

const inputClass =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-400/60 transition-colors";

export default function AmbassadorsPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [location, setLocation] = useState("");
    const [instagram, setInstagram] = useState("");
    const [tiktok, setTiktok] = useState("");
    const [youtube, setYoutube] = useState("");
    const [otherPlatform, setOtherPlatform] = useState("");
    const [audienceSize, setAudienceSize] = useState("");
    const [workLinks, setWorkLinks] = useState("");
    const [why, setWhy] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasAtLeastOneSocial =
        instagram.trim() || tiktok.trim() || youtube.trim() || otherPlatform.trim();

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);

        if (!name.trim() || !email.trim()) {
            setError("Name and email are required.");
            return;
        }
        if (!hasAtLeastOneSocial) {
            setError("Add at least one social so we can see your content.");
            return;
        }

        setSubmitting(true);
        try {
            await submitAmbassadorApplication({
                name: name.trim(),
                email: email.trim(),
                location: location.trim() || undefined,
                instagram: instagram.trim() || undefined,
                tiktok: tiktok.trim() || undefined,
                youtube: youtube.trim() || undefined,
                otherPlatform: otherPlatform.trim() || undefined,
                audienceSize: audienceSize.trim() || undefined,
                workLinks: workLinks.trim() || undefined,
                why: why.trim() || undefined,
            });
            setSubmitted(true);
        } catch (err) {
            console.error("[creators] submit failed:", err);
            setError("Something went wrong sending your application. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    if (submitted) {
        return (
            <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-[url('/noise.svg')] bg-fixed">
                <div className="absolute inset-0 bg-slate-950 -z-10" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black -z-10" />
                <div className="w-full max-w-md text-center">
                    <h1 className="text-3xl font-extrabold text-white mb-4">
                        JazakAllah Khair 🤲
                    </h1>
                    <p className="text-white/60">
                        We&apos;ve got your application. If it&apos;s a good fit, we&apos;ll
                        reach out at the email you gave us.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="relative flex min-h-screen flex-col items-center p-6 py-20 bg-[url('/noise.svg')] bg-fixed">
            <div className="absolute inset-0 bg-slate-950 -z-10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black -z-10" />

            <div className="w-full max-w-lg">
                <p className="text-sm font-semibold tracking-wide text-indigo-300/80 uppercase mb-3 text-center">
                    Become a
                </p>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-4 text-center">
                    Tahajjud+ Creator
                </h1>
                <p className="text-white/60 text-center mb-12">
                    Help other Muslims find Tahajjud+, and get a commission for
                    everyone who joins through you.
                </p>

                <form onSubmit={handleSubmit}>
                    <Field label="Name">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className={inputClass}
                        />
                    </Field>

                    <Field label="Email">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className={inputClass}
                        />
                    </Field>

                    <Field label="Where are you based?" optional>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="City, country — we work with creators worldwide"
                            className={inputClass}
                        />
                    </Field>

                    <div className="border-t border-white/10 my-8" />

                    <label className="block text-sm text-white/70 mb-4">
                        Your socials <span className="text-white/40">(at least one, so we can see your content)</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <input
                            type="text"
                            value={instagram}
                            onChange={(e) => setInstagram(e.target.value)}
                            placeholder="instagram @you"
                            className={inputClass}
                        />
                        <input
                            type="text"
                            value={tiktok}
                            onChange={(e) => setTiktok(e.target.value)}
                            placeholder="tiktok @you"
                            className={inputClass}
                        />
                        <input
                            type="text"
                            value={youtube}
                            onChange={(e) => setYoutube(e.target.value)}
                            placeholder="youtube @you"
                            className={inputClass}
                        />
                    </div>

                    <Field label="Anywhere else?" optional>
                        <input
                            type="text"
                            value={otherPlatform}
                            onChange={(e) => setOtherPlatform(e.target.value)}
                            placeholder="Another platform + handle"
                            className={inputClass}
                        />
                    </Field>

                    <Field label="Audience size" optional>
                        <input
                            type="text"
                            value={audienceSize}
                            onChange={(e) => setAudienceSize(e.target.value)}
                            placeholder="e.g. 12k, 80k, 1.2M"
                            className={inputClass}
                        />
                    </Field>

                    <Field label="Your best work" optional>
                        <textarea
                            value={workLinks}
                            onChange={(e) => setWorkLinks(e.target.value)}
                            placeholder="Paste links, one per line — reels, TikToks, YouTube, a portfolio"
                            rows={3}
                            className={inputClass}
                        />
                    </Field>

                    <Field label="Why do you want to be a Tahajjud+ creator?" optional>
                        <textarea
                            value={why}
                            onChange={(e) => setWhy(e.target.value)}
                            rows={3}
                            className={inputClass}
                        />
                    </Field>

                    {error && (
                        <p className="text-sm text-red-400 mb-4">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-xl bg-white text-slate-950 font-semibold py-3.5 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Sending…" : "Apply"}
                    </button>
                </form>
            </div>
        </main>
    );
}
