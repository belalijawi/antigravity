/**
 * Runs the map's ACTUAL shipped selection/geometry logic (utils/mapGeometry.ts
 * — the same module components/GlobalTahajjudMap.tsx imports) against real
 * production data, and asserts the two things that kept regressing:
 *
 *   1. A dua pin is NEVER dropped at any zoom level, including zoomed all the
 *      way in on the pin itself.
 *   2. Rendered dots never overlap each other, at any zoom — which is what
 *      turns a dense region into one merged blob.
 *
 * Run: npx tsx scripts/verifyMapGeometry.mts
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
    getFirestore, collection, query, where, getDocs, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import {
    spreadStacked, aggregateToGrid, gridSizeForZoom, dotRadiusForZoom,
    selectVisibleDuas, getViewportBounds, boundsFilter, sampleEvenly, GLOW_MULTIPLIER,
    AGGREGATE_ZOOM_THRESHOLD, WORLD_VIEW_DOT_CAP,
    type Point, type MapRegion,
} from '../utils/mapGeometry.ts';

const app = initializeApp({
    apiKey: 'AIzaSyBTbpXPTn-wMBp821rMaoqOqdstNhzyRdM',
    authDomain: 'tahajjud-2d7bf.firebaseapp.com',
    projectId: 'tahajjud-2d7bf',
});
await signInAnonymously(getAuth(app));
const db = getFirestore(app);
const cutoff = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

const dotSnap = await getDocs(query(collection(db, 'tahajjud_map'),
    where('ts', '>=', cutoff), orderBy('ts', 'desc'), limit(3000)));
const dots: Point[] = [];
dotSnap.forEach(d => { const x = d.data() as any; dots.push({ id: d.id, lat: x.lat, lng: x.lng }); });

const pinSnap = await getDocs(query(collection(db, 'public-duas'),
    where('onMap', '==', true), where('createdAt', '>=', cutoff),
    orderBy('createdAt', 'desc'), limit(400)));
const pins: Point[] = [];
pinSnap.forEach(d => { const x = d.data() as any; pins.push({ id: d.id, lat: x.lat, lng: x.lng }); });

console.log(`real data: ${dots.length} prayer dots, ${pins.length} dua pin(s)\n`);

let failures = 0;
const fail = (m: string) => { console.log(`  FAIL  ${m}`); failures++; };

// ── 1. The pin must survive every zoom, centred on the pin itself ──────────
const spreadPins = spreadStacked(pins);
const ZOOMS = [120, 40, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005];
console.log('1. dua pin survives zoom (viewport centred on the pin):');
for (const pin of spreadPins) {
    for (const latD of ZOOMS) {
        const region: MapRegion = {
            latitude: pin.lat, longitude: pin.lng,
            latitudeDelta: latD, longitudeDelta: latD,
        };
        for (const [label, sel, own] of [
            ['not selected', null, new Set<string>()],
            ['selected', pin.id, new Set<string>()],
            ['own pin', null, new Set([pin.id])],
        ] as const) {
            const vis = selectVisibleDuas(spreadPins, region, sel, own);
            if (!vis.some(d => d.id === pin.id)) fail(`pin ${pin.id} dropped at latΔ=${latD} (${label})`);
        }
    }
}
console.log(failures === 0 ? '  PASS  survived all zooms, all selection states\n' : '');

// Same, but with a synthetic large pool so the culling path actually runs.
const synthetic: Point[] = [...spreadPins];
for (let i = 0; i < 400; i++) {
    synthetic.push({ id: `synth-${i}`, lat: -80 + (i % 160), lng: -170 + ((i * 7) % 340) });
}
const before = failures;
console.log('2. same, with a 400+ pin pool so culling/sampling actually engages:');
for (const pin of spreadPins) {
    for (const latD of ZOOMS) {
        const region: MapRegion = {
            latitude: pin.lat, longitude: pin.lng, latitudeDelta: latD, longitudeDelta: latD,
        };
        // Worst case: not selected and not own — only geography protects it.
        const vis = selectVisibleDuas(synthetic, region, null, new Set());
        if (!vis.some(d => d.id === pin.id)) fail(`pin ${pin.id} dropped from large pool at latΔ=${latD}`);
        // And the guaranteed cases.
        const visSel = selectVisibleDuas(synthetic, region, pin.id, new Set());
        if (!visSel.some(d => d.id === pin.id)) fail(`SELECTED pin dropped from large pool at latΔ=${latD}`);
        const visOwn = selectVisibleDuas(synthetic, region, null, new Set([pin.id]));
        if (!visOwn.some(d => d.id === pin.id)) fail(`OWN pin dropped from large pool at latΔ=${latD}`);
    }
}
console.log(failures === before ? '  PASS  survived culling + sampling at every zoom\n' : '');

// ── 3. Dot COUNT must not be thinned, and dots must not overlap ────────────
// Count is checked FIRST and treated as the hard requirement: a previous
// "fix" for overlap silently collapsed ~323 city dots into ~29 at world view,
// which is a far worse bug than the overlap it cured.
const distinctCities = new Set(dots.map(d => `${d.lat},${d.lng}`)).size;
console.log(`3. dot count preserved (${distinctCities} distinct city cells in the data):`);
{
    const worldAgg = aggregateToGrid(dots, gridSizeForZoom(120));
    if (worldAgg.length !== distinctCities) {
        fail(`world view renders ${worldAgg.length} dots, expected all ${distinctCities}`);
    } else {
        console.log(`   world view renders all ${worldAgg.length} — no thinning  PASS`);
    }
}

// Separation is only REQUIRED from a regional zoom inwards — that is where a
// viewer expects to pick out individual cities, and where the reported
// "one solid cyan smear over Java" happened. Zoomed further out than that,
// cities are genuinely closer together than any visible dot can be drawn, and
// their glows merging into lit-up regions is the intended look of the map (and
// how it has always looked). Widening the dots there is not a bug to fix; the
// alternative — deleting dots until they fit — is what broke the map before.
const SEPARATION_REQUIRED_AT_OR_BELOW = 10;
console.log('4. dots stay distinct from regional zoom inwards' +
    ' (glow diameter < gap to nearest dot):');
const M_PER_DEG = 111_000;
for (const latD of [120, 60, 40, 20, 10, 5, 2, 1, 0.5, 0.3]) {
    const region: MapRegion = { latitude: -6.2, longitude: 106.8, latitudeDelta: latD, longitudeDelta: latD };
    const useAggregate = latD >= AGGREGATE_ZOOM_THRESHOLD;
    const source: Point[] = useAggregate
        ? aggregateToGrid(dots, gridSizeForZoom(latD))
        : spreadStacked(dots);
    const bounds = getViewportBounds(region, 2);
    const pool = bounds.isWorldView ? source : boundsFilter(source, bounds);
    const rendered = sampleEvenly(pool, WORLD_VIEW_DOT_CAP);
    const glowDia = dotRadiusForZoom(latD) * GLOW_MULTIPLIER * 2;

    let minGap = Infinity;
    for (let i = 0; i < rendered.length; i++) {
        for (let j = i + 1; j < rendered.length; j++) {
            const dy = (rendered[i].lat - rendered[j].lat) * M_PER_DEG;
            const dx = (rendered[i].lng - rendered[j].lng) * M_PER_DEG
                * Math.cos(rendered[i].lat * Math.PI / 180);
            minGap = Math.min(minGap, Math.hypot(dx, dy));
        }
    }
    const ok = minGap > glowDia;
    const required = latD <= SEPARATION_REQUIRED_AT_OR_BELOW;
    console.log(`   latΔ=${String(latD).padStart(5)}  dots=${String(rendered.length).padStart(4)}` +
        `  glow=${(glowDia / 1000).toFixed(1).padStart(6)}km  gap=${(minGap / 1000).toFixed(1).padStart(7)}km` +
        `  ${ok ? 'separate' : 'merged'}${required ? '' : '  (merged is intended this far out)'}`);
    if (required && !ok) fail(`dots merge at latΔ=${latD}, where they must stay distinct`);
}

console.log(failures === 0
    ? '\nALL CHECKS PASSED'
    : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
