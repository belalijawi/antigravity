export interface PrayerTimes {
    fajr: Date;
    sunrise: Date;
    dhuhr: Date;
    asr: Date;
    maghrib: Date;
    isha: Date;
}

export interface NightCalculation {
    nightStart: Date; // Maghrib
    nightEnd: Date;   // Fajr
    totalDurationWait: number; // in minutes
    lastThirdStart: Date;
}

/**
 * Calculates the last third of the night.
 * Night is defined from Maghrib to Fajr.
 * Last Third = Fajr - (Duration / 3)
 */
export function calculateLastThird(maghrib: Date, fajr: Date): NightCalculation {
    // If Fajr is before Maghrib (which is typical as Fajr is next day), add 24 hours to Fajr for calculation
    // However, when dealing with Date objects, we assume they are correct absolute times.
    // Usually Maghrib is Day N, Fajr is Day N+1.

    // Ensure Fajr is after Maghrib
    const nightStart = maghrib;
    let nightEnd = fajr;

    if (nightEnd <= nightStart) {
        // Should not happen if Dates are correct, but safe check
        nightEnd = new Date(fajr.getTime() + 24 * 60 * 60 * 1000);
    }

    const durationMs = nightEnd.getTime() - nightStart.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    const oneThirdMs = durationMs / 3;

    const lastThirdStart = new Date(nightEnd.getTime() - oneThirdMs);

    return {
        nightStart,
        nightEnd,
        totalDurationWait: durationMinutes,
        lastThirdStart
    };
}
