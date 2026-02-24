# confluence-mcp-server

MCP server for fetching and parsing confluence.org point pages.

## Tools

### `confluence_get_point`
Fetches and parses a point directly from confluence.org.

**Warning:** confluence.org can be very slow (10+ seconds per page). The tool has a 30s timeout.

Parameters:
- `lat` — signed integer latitude (e.g. `57`, `-33`)
- `lon` — signed integer longitude (e.g. `24`, `-3`)

### `confluence_parse_html`
Parses raw HTML you've already fetched yourself (e.g. via browser automation or curl). Useful for avoiding the slow server by batching fetches separately.

Parameters:
- `html` — raw HTML string
- `lat` — integer latitude
- `lon` — integer longitude

## Returned data

Both tools return a human-readable summary and a JSON object:

```typescript
{
  lat: number;
  lon: number;
  prefix: string;            // "57°N 24°E"
  country: string;           // "Latvia"
  region?: string;           // "Euskadi" (not always present)
  locationDescription: string; // "4.8 km (3.0 miles) SW of Bolderāja, Rīgas, Latvia"
  distanceKm: number;        // 4.8
  direction: string;         // "SW"
  nearestPlace: string;      // "Bolderāja"
  altitudeM?: number;        // 19
  visitCount: number;        // 12
  notes?: string;            // contents of the Notes section, if present
}
```

The `nearestPlace` field is what you'll usually want to use as the entity `name` in the database — but confirm with Andrew since it's subjective (sometimes a better-known nearby town is preferable to the literally closest village).

## Setup

```bash
npm install
npm run build
```

## Claude Desktop config

```json
{
  "mcpServers": {
    "confluence": {
      "command": "node",
      "args": ["/Users/andrewzc/Projects/confluence-mcp-server/dist/index.js"]
    }
  }
}
```
# confluence-mcp-server
