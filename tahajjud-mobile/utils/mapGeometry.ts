/**
 * Pure geometry/selection logic for the Global Tahajjud Map.
 *
 * Deliberately free of any react-native / firebase import so it can be run
 * and asserted on directly in a plain Node script against real production
 * data. This module exists because the map's "which dots and pins are
 * actually shown" logic repeatedly shipped with bugs that were only ever
 * reasoned about, never tested: the code that decides whether a pin survives
 * a zoom is exactly the code that kept dropping it, so it needs to be
 * something a test can call, not something buried in a component that can
 * only be exercised by hand on a device.
 *
 * Everything here is a pure function of its inputs. Types are structural
 * ({id, lat, lng}) rather than imported from utils/tahajjudMap, which pulls
 * in firebase and can't be loaded outside the app.
 */

export interface LatLng { lat: number; lng: number; }
export interface Point extends LatLng { id: string; }
export interface MapRegion {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
}

// Golden angle (radians) — sunflower-spiral spacing packs any number of
// same-cell dots evenly without two ever landing on the same spot.
const GOLDEN_ANGLE = 2.399963;

/** Below this many pins in the pool, skip viewport culling and pin-repaint
 *  throttling entirely. Real pin counts today are in the single digits, so
 *  both optimisations were only ever costing correctness. Comfortably above
 *  real usage, well below anything that would actually strain the map. */
export const DUA_PIN_CULL_THRESHOLD = 60;
export const DUA_PIN_CAP = 150;
export const WORLD_VIEW_DOT_CAP = 800;

/** Zoom level (region.latitudeDelta) at or above which prayer dots are shown
 *  aggregated per grid cell rather than one per person. */
export const AGGREGATE_ZOOM_THRESHOLD = 0.3;

// Evenly-spaced sample down to `cap` items rather than just slicing the
// front — dots are roughly ordered by recency, and a plain slice would show
// only the newest cluster instead of a spread that still reads as "the whole
// world lit up."
export function sampleEvenly<T>(items: T[], cap: number): T[] {
    if (items.length <= cap) return items;
    const stride = items.length / cap;
    const out: T[] = [];
    for (let i = 0; i < cap; i++) out.push(items[Math.floor(i * stride)]);
    return out;
}

// Shared by both dots' and dua pins' viewport culling — same padded bounding
// box, same "wide enough to cover the whole world" early-out.
export function getViewportBounds(region: MapRegion, padMultiplier: number) {
    const latPad = region.latitudeDelta * padMultiplier;
    const lngPad = region.longitudeDelta * padMultiplier;
    return {
        minLat: region.latitude - region.latitudeDelta / 2 - latPad,
        maxLat: region.latitude + region.latitudeDelta / 2 + latPad,
        minLng: region.longitude - region.longitudeDelta / 2 - lngPad,
        maxLng: region.longitude + region.longitudeDelta / 2 + lngPad,
        isWorldView: region.latitudeDelta + latPad * 2 >= 180 && region.longitudeDelta + lngPad * 2 >= 360,
    };
}

export function boundsFilter<T extends LatLng>(
    items: T[], bounds: ReturnType<typeof getViewportBounds>,
): T[] {
    return items.filter(d =>
        d.lat >= bounds.minLat && d.lat <= bounds.maxLat && d.lng >= bounds.minLng && d.lng <= bounds.maxLng);
}

/**
 * Coordinates are rounded to ~11km cells for privacy, so everyone in the same
 * city shares one exact point and their dots stack invisibly. Spread each
 * cell's dots in a deterministic spiral instead — offsets stay within the
 * ~0.1° (~11km) the stored coordinates are already blurred to, so this adds
 * no location precision. Sorted by doc id so a dot keeps its spot across
 * snapshot updates instead of dancing.
 */
export function spreadStacked<T extends Point>(items: T[]): T[] {
    const byCell = new Map<string, T[]>();
    for (const d of items) {
        const key = `${d.lat},${d.lng}`;
        const cell = byCell.get(key);
        if (cell) cell.push(d); else byCell.set(key, [d]);
    }
    const out: T[] = [];
    for (const cell of byCell.values()) {
        cell.sort((a, b) => (a.id < b.id ? -1 : 1));
        cell.forEach((d, i) => {
            if (i === 0) { out.push(d); return; }
            const r = Math.min(0.032 * Math.sqrt(i), 0.1);
            const a = i * GOLDEN_ANGLE;
            out.push({ ...d, lat: d.lat + r * Math.cos(a), lng: d.lng + r * Math.sin(a) });
        });
    }
    return out;
}

/**
 * Grid size (in degrees) used to group dots.
 *
 * FIXED at the ~11km (0.1°) privacy grid the coordinates are already stored
 * on — one dot per real city cell, which is exactly how many dots the map has
 * always shown.
 *
 * This deliberately does NOT scale with zoom. A previous version made the
 * grid a function of the viewport (latitudeDelta / 14) to stop dots merging
 * at regional zoom. It worked, but the cost was catastrophic and was the
 * wrong trade entirely: at world view the cells became ~8.5° wide, so ~323
 * distinct active cities collapsed into ~29 dots. The map exists to show the
 * ummah lit up — thinning it by 90% to win a cosmetic argument about overlap
 * destroys the entire point of the screen. Dot COUNT is the product; overlap
 * is a styling problem, and it is solved by dot SIZE (see dotRadiusForZoom),
 * never by throwing away dots.
 */
export function gridSizeForZoom(_latitudeDelta?: number): number {
    return 0.1;
}

/**
 * Circle radius in metres. Scales with the visible region so dots stay a
 * roughly constant size on screen at every zoom.
 *
 * The multiplier is what keeps neighbouring cities visually distinct instead
 * of smearing together, and it is the ONLY lever used for that — dot count is
 * never reduced to fix overlap (see gridSizeForZoom). Cities sit on a fixed
 * ~11km grid, so a dot merges into its neighbour once its drawn diameter
 * approaches 11km. At 500 the solid dot alone spans 10km at a regional zoom
 * (latitudeDelta 10) — touching its neighbour before the glow is even drawn,
 * which is what turned the dense Jakarta → Bogor → Bandung corridor into one
 * solid cyan mass.
 *
 * The ceiling is set by that same arithmetic, and this value sits as close to
 * it as is safe. Separation at latitudeDelta 10 requires the full glow
 * (radius × GLOW_MULTIPLIER, doubled for a diameter) to stay under the 11km
 * grid spacing — i.e. multiplier × GLOW_MULTIPLIER < ~550. 450 × 1.2 = 540
 * lands just inside that, giving the brightest map that still keeps every
 * city readable as its own point.
 *
 * Brightness is deliberately spent on the SOLID dot rather than the halo:
 * the core is drawn at ~80% opacity and the glow at ~8%, so widening the core
 * does far more for how lit-up the world looks than widening the halo, for
 * the same amount of the separation budget.
 *
 * The 1500m floor is the long-standing one: below ~latitudeDelta 5 dots stop
 * shrinking so they never disappear at street-level zoom.
 */
export function dotRadiusForZoom(latitudeDelta: number): number {
    return Math.max(1500, latitudeDelta * 450);
}

/**
 * The soft halo drawn behind each dot, as a multiple of the dot's radius.
 *
 * Lives here rather than in the component so the separation budget it shares
 * with dotRadiusForZoom (multiplier × this < ~550, see above) is enforced by
 * the same test that checks the dots never merge. It was 3× originally, which
 * is what drew each dot ~30km wide against 11km city spacing and fused dense
 * regions into one solid cyan mass.
 */
export const GLOW_MULTIPLIER = 1.2;

/** Radius of the halo behind a dot, in metres. */
export function glowRadiusForZoom(latitudeDelta: number): number {
    return dotRadiusForZoom(latitudeDelta) * GLOW_MULTIPLIER;
}

/**
 * One point per grid cell at the current zoom (see gridSizeForZoom).
 *
 * Each cell is drawn at its stored coordinate — which, because the grid IS
 * the storage grid, is already the cell's own point. Dots therefore land in
 * exactly the places they always have.
 *
 * Everyone in a cell collapses into exactly ONE same-sized dot; the cell's
 * population is deliberately not reflected in the dot's size.
 */
export function aggregateToGrid<T extends Point>(items: T[], gridDeg: number): Point[] {
    const byCell = new Map<string, T[]>();
    for (const d of items) {
        const key = `${Math.round(d.lat / gridDeg)}:${Math.round(d.lng / gridDeg)}`;
        const cell = byCell.get(key);
        if (cell) cell.push(d); else byCell.set(key, [d]);
    }
    const out: Point[] = [];
    for (const cell of byCell.values()) {
        // Stable id across snapshot updates: the lowest doc id in the cell,
        // same "sort then pick" stability trick spreadStacked uses.
        const firstId = cell.reduce((min, d) => (d.id < min ? d.id : min), cell[0].id);
        out.push({ id: `city-${firstId}`, lat: cell[0].lat, lng: cell[0].lng });
    }
    return out;
}

/**
 * Which dua pins to render.
 *
 * Pins are NOT viewport-culled until there are genuinely enough of them for
 * culling to buy anything. Culling pins was premature: the real number of
 * pins on the map at any moment is in the single digits (they're opt-in, and
 * expire off the map after 24h), and every "the pin vanished when I zoomed
 * in" report traced back to this filter dropping the one pin the user was
 * looking at. Below the threshold every pin is simply returned — a pin that
 * is off-screen costs nothing anyway, because the native map only actually
 * draws an overlay whose coordinate is inside the real viewport.
 *
 * Above the threshold, the pin you have open (selectedId) and your own pins
 * are taken from the FULL unfiltered set, so they can never be dropped by
 * either the bounds filter or the sampling cap.
 *
 * Order is always the input's own order. Hoisting priority pins to the front
 * reordered the map's native children on every selection/zoom, and reordering
 * children of react-native-maps' AIRMap can tear down and recreate the native
 * annotation — its own source of blank pins. Stable order means a pin's
 * position in the children array only ever changes when a pin is genuinely
 * added or removed.
 */
export function selectVisibleDuas<T extends Point>(
    spreadDuas: T[],
    region: MapRegion,
    selectedId: string | null,
    ownIds: Set<string>,
): T[] {
    if (spreadDuas.length <= DUA_PIN_CULL_THRESHOLD) return spreadDuas;
    const bounds = getViewportBounds(region, 2);
    const isPriority = (d: T) => d.id === selectedId || ownIds.has(d.id);
    const inView = bounds.isWorldView ? spreadDuas : boundsFilter(spreadDuas, bounds);
    const rest = inView.filter(d => !isPriority(d));
    const keptRest = rest.length <= DUA_PIN_CAP ? rest : sampleEvenly(rest, DUA_PIN_CAP);
    const keep = new Set(keptRest.map(d => d.id));
    for (const d of spreadDuas) if (isPriority(d)) keep.add(d.id);
    return spreadDuas.filter(d => keep.has(d.id));
}
