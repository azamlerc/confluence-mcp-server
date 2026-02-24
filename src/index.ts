#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchConfluencePoint, parseConfluenceHtml } from "./parser.js";

const server = new McpServer({
  name: "confluence-mcp-server",
  version: "1.0.0",
});

// Tool 1: Fetch and parse a confluence point by lat/lon
server.tool(
  "confluence_get_point",
  "Fetch and parse a confluence.org point page by latitude and longitude. Returns structured data about the point including country, nearest place, distance, visit count, and any notes. Warning: confluence.org can be slow (10+ seconds), so this tool has a 30s timeout.",
  {
    lat: z.number().int().min(-90).max(90).describe("Latitude as a signed integer, e.g. 57 or -33"),
    lon: z.number().int().min(-180).max(180).describe("Longitude as a signed integer, e.g. 24 or -3"),
  },
  async ({ lat, lon }) => {
    const result = await fetchConfluencePoint(lat, lon);

    if ("error" in result) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching ${lat}°, ${lon}°: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    const lines = [
      `**${result.prefix}** — ${result.country}${result.region ? ` / ${result.region}` : ""}`,
      `Location: ${result.locationDescription}`,
      `Nearest place: ${result.nearestPlace} (${result.distanceKm} km ${result.direction})`,
      result.altitudeM !== undefined ? `Altitude: ${result.altitudeM} m` : null,
      `Visits: ${result.visitCount}`,
      result.notes ? `\nNotes: ${result.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: lines,
        },
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Tool 2: Parse raw HTML (for when the caller fetches the page themselves,
// e.g. via browser automation or curl, to avoid the slow web server)
server.tool(
  "confluence_parse_html",
  "Parse raw HTML from a confluence.org point page. Useful when you've fetched the HTML yourself (e.g. via browser). Returns the same structured data as confluence_get_point.",
  {
    html: z.string().describe("Raw HTML content of the confluence.org page"),
    lat: z.number().int().min(-90).max(90).describe("Latitude of the point (needed since it's not reliably in the HTML)"),
    lon: z.number().int().min(-180).max(180).describe("Longitude of the point"),
  },
  async ({ html, lat, lon }) => {
    const result = parseConfluenceHtml(html, lat, lon);

    if ("error" in result) {
      return {
        content: [
          {
            type: "text",
            text: `Parse error for ${lat}°, ${lon}°: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    const lines = [
      `**${result.prefix}** — ${result.country}${result.region ? ` / ${result.region}` : ""}`,
      `Location: ${result.locationDescription}`,
      `Nearest place: ${result.nearestPlace} (${result.distanceKm} km ${result.direction})`,
      result.altitudeM !== undefined ? `Altitude: ${result.altitudeM} m` : null,
      `Visits: ${result.visitCount}`,
      result.notes ? `\nNotes: ${result.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: lines,
        },
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("confluence-mcp-server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
