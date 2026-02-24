export interface ConfluencePoint {
    lat: number;
    lon: number;
    prefix: string;
    country: string;
    region?: string;
    locationDescription: string;
    distanceKm: number;
    direction: string;
    nearestPlace: string;
    altitudeM?: number;
    visitCount: number;
    notes?: string;
}
export interface ConfluenceError {
    error: string;
    lat: number;
    lon: number;
}
/**
 * Fetch and parse a confluence.org point page.
 * Returns structured data or an error object.
 */
export declare function fetchConfluencePoint(lat: number, lon: number, timeoutMs?: number): Promise<ConfluencePoint | ConfluenceError>;
/**
 * Parse confluence.org HTML directly (useful when HTML is supplied externally).
 */
export declare function parseConfluenceHtml(html: string, lat: number, lon: number): ConfluencePoint | ConfluenceError;
