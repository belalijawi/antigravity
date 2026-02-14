// Kaaba coordinates in Mecca
const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;

/**
 * Calculate the bearing (direction) and distance from a given location to the Kaaba in Mecca
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @returns Object containing bearing in degrees (0-360) and distance in kilometers
 */
export function calculateQibla(userLat: number, userLon: number): { bearing: number; distance: number } {
    // Convert degrees to radians
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const toDegrees = (radians: number) => radians * (180 / Math.PI);

    const lat1 = toRadians(userLat);
    const lat2 = toRadians(KAABA_LAT);
    const lon1 = toRadians(userLon);
    const lon2 = toRadians(KAABA_LON);

    // Calculate bearing using the forward azimuth formula
    const dLon = lon2 - lon1;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let bearing = toDegrees(Math.atan2(y, x));

    // Normalize bearing to 0-360
    bearing = (bearing + 360) % 360;

    // Calculate distance using Haversine formula
    const R = 6371; // Earth's radius in kilometers
    const dLat = lat2 - lat1;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return {
        bearing: Math.round(bearing),
        distance: Math.round(distance),
    };
}

/**
 * Get compass direction label from bearing
 * @param bearing Bearing in degrees (0-360)
 * @returns Direction label (N, NE, E, SE, S, SW, W, NW)
 */
export function getCompassDirection(bearing: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
}
