import type { Metadata } from "next";

const IOS_APP_ID = "6759176533";
const ANDROID_PACKAGE = "com.tahajjudplus.app";

// Google's own Install Referrer mechanism — no third-party attribution SDK
// needed. Play passes this string through to the app on first launch (read
// via the Play Install Referrer API), so the ambassador code survives an
// install even though the click happened before the app existed on-device.
// iOS has no equivalent first-party deferred-deep-link mechanism, so for now
// iOS attribution relies on the code being entered/applied manually at
// checkout rather than carried through the install.
function androidStoreUrl(code: string): string {
    const referrer = encodeURIComponent(`ambassador_code=${code}`);
    return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=${referrer}`;
}

const IOS_STORE_URL = `https://apps.apple.com/app/id${IOS_APP_ID}`;

function normalizeCode(raw: string): string {
    return raw.trim().toUpperCase();
}

type Props = {
    params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { code } = await params;
    const displayCode = normalizeCode(code);
    return {
        title: `Tahajjud+ — invited by ${displayCode}`,
        description: `Use code ${displayCode} for a discount on Tahajjud+ Premium.`,
    };
}

export default async function ReferralPage({ params }: Props) {
    const { code } = await params;
    const displayCode = normalizeCode(code);

    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-[url('/noise.svg')] bg-fixed">
            <div className="absolute inset-0 bg-slate-950 -z-10" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black -z-10" />

            <div className="w-full max-w-md text-center">
                <p className="text-sm font-semibold tracking-wide text-indigo-300/80 uppercase mb-3">
                    You&apos;ve been invited to
                </p>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent mb-8">
                    Tahajjud+
                </h1>

                <div className="rounded-2xl border border-indigo-400/30 bg-white/5 px-6 py-5 mb-8">
                    <p className="text-xs text-white/50 mb-2">Your code</p>
                    <p className="text-2xl font-mono font-bold tracking-[0.2em] text-white">
                        {displayCode}
                    </p>
                    <p className="text-xs text-white/50 mt-3">
                        Enter this code at checkout for your discount.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <a
                        href={IOS_STORE_URL}
                        className="w-full rounded-xl bg-white text-slate-950 font-semibold py-3.5 hover:bg-white/90 transition-colors"
                    >
                        Download on the App Store
                    </a>
                    <a
                        href={androidStoreUrl(code)}
                        className="w-full rounded-xl border border-white/20 text-white font-semibold py-3.5 hover:bg-white/10 transition-colors"
                    >
                        Get it on Google Play
                    </a>
                </div>

                <p className="text-xs text-white/40 mt-10">
                    Tahajjud+ · wake for the last third of the night
                </p>
            </div>
        </main>
    );
}
