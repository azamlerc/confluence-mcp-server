import { parse } from "node-html-parser";
/**
 * Parse a direction string like "4.8 km (3.0 miles) SW of Bolderāja, Rīgas, Latvia"
 * Returns the distance in km, direction, and nearest place name.
 */
function parseLocationDescription(desc) {
    // Match: "4.8 km (3.0 miles) SW of Bolderāja, ..."
    //        "51.2 km (31.8 miles) NNE of al-`Uwaynat, ..."
    //        "1.9 km (1.2 miles) N of Urduña, ..."
    const match = desc.match(/^([\d.]+)\s*km\s*\([\d.]+ miles\)\s*([A-Z]+)\s+of\s+([^,]+)/);
    if (!match)
        return null;
    return {
        distanceKm: parseFloat(match[1]),
        direction: match[2],
        nearestPlace: match[3].trim(),
    };
}
/**
 * Fetch and parse a confluence.org point page.
 * Returns structured data or an error object.
 */
export async function fetchConfluencePoint(lat, lon, timeoutMs = 30000) {
    const url = `https://confluence.org/confluence.php?lat=${lat}&lon=${lon}`;
    let html;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                // Behave like a normal browser to avoid any bot filtering
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        });
        clearTimeout(timer);
        if (!response.ok) {
            return { error: `HTTP ${response.status}: ${response.statusText}`, lat, lon };
        }
        html = await response.text();
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: `Fetch failed: ${msg}`, lat, lon };
    }
    return parseConfluenceHtml(html, lat, lon);
}
/**
 * Parse confluence.org HTML directly (useful when HTML is supplied externally).
 */
export function parseConfluenceHtml(html, lat, lon) {
    const root = parse(html);
    // --- Country and optional region ---
    // Structure: <h3><a href="/country.php?id=62">Latvia</a></h3>
    // or:        <h3><a href="/country.php?...">Spain</a> : <a href="/region.php?...">Euskadi</a></h3>
    const countryLinks = root.querySelectorAll('a[href^="/country.php"]');
    if (countryLinks.length === 0) {
        return { error: "Could not find country element", lat, lon };
    }
    const country = countryLinks[0].text.trim();
    const regionLinks = root.querySelectorAll('a[href^="/region.php"]');
    const region = regionLinks.length > 0 ? regionLinks[0].text.trim() : undefined;
    // --- Location description and altitude ---
    // The second <h3> block contains the location string and altitude.
    // We look for the h3 that contains the distance pattern.
    let locationDescription = "";
    let altitudeM;
    const h3s = root.querySelectorAll("h3");
    for (const h3 of h3s) {
        const text = h3.text;
        if (/\d+\.\d+\s*km/.test(text)) {
            // First line is the distance description
            locationDescription = text.split("\n")[0].trim();
            // Altitude line: "Approx. altitude: 19 m"
            const altMatch = text.match(/altitude:\s*([\d.]+)\s*m/i);
            if (altMatch)
                altitudeM = parseInt(altMatch[1]);
            break;
        }
    }
    if (!locationDescription) {
        return { error: "Could not find location description", lat, lon };
    }
    const parsed = parseLocationDescription(locationDescription);
    if (!parsed) {
        return {
            error: `Could not parse location description: "${locationDescription}"`,
            lat,
            lon,
        };
    }
    // --- Visit count ---
    // Blue bar text like "57°N 24°E (visit #12)" or the page <title>
    let visitCount = 0;
    const blueBarFont = root.querySelectorAll('td[bgcolor="#000070"] font');
    for (const el of blueBarFont) {
        const visitMatch = el.text.match(/visit\s*#(\d+)/i);
        if (visitMatch) {
            visitCount = parseInt(visitMatch[1]);
            break;
        }
    }
    // --- Prefix string ---
    // Derive from lat/lon: "57°N 24°E", "43°N 3°W", "22°N 25°E"
    const latStr = `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}`;
    const lonStr = `${Math.abs(lon)}°${lon >= 0 ? "E" : "W"}`;
    const prefix = `${latStr} ${lonStr}`;
    // --- Notes section (not always present) ---
    // There's a dark blue bar with the text "Notes" followed by content
    let notes;
    const allBlueBars = root.querySelectorAll('td[bgcolor="#000070"]');
    for (const bar of allBlueBars) {
        if (bar.text.trim().toLowerCase() === "notes") {
            // The notes content is in the next sibling <tr><td>
            const parentTr = bar.closest("tr");
            const nextTr = parentTr?.nextElementSibling;
            if (nextTr) {
                notes = nextTr.text.trim();
            }
            break;
        }
    }
    return {
        lat,
        lon,
        prefix,
        country,
        region,
        locationDescription,
        distanceKm: parsed.distanceKm,
        direction: parsed.direction,
        nearestPlace: parsed.nearestPlace,
        altitudeM,
        visitCount,
        notes,
    };
}
