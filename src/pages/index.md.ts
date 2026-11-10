import type { APIRoute } from "astro";
import events2026 from "../data/events-2026.json";
import events2027 from "../data/events-2027.json";

type Ev = { name: string; startDate: string; endDate: string; country: string; website?: string };

const all = [...events2026, ...events2027] as Ev[];
const today = new Date().toISOString().slice(0, 10);
const upcoming = all
  .filter((e) => e.endDate >= today)
  .sort((a, b) => a.startDate.localeCompare(b.startDate));

export const GET: APIRoute = () => {
  const items = upcoming
    .map(
      (e) =>
        `## ${e.name}\n${e.startDate} – ${e.endDate} · ${e.country}` +
        (e.website ? `\n${e.website}` : "")
    )
    .join("\n\n");

  const md = `---
title: Caribbean Countdowns — upcoming events
description: Live countdowns and verified dates for Caribbean festivals, carnivals and regattas.
url: https://caribbean.countdowns.co/
---

# Caribbean Countdowns

Live countdowns and verified dates for Caribbean festivals, carnivals and regattas (2024–2027). ${upcoming.length} upcoming events are listed below. Structured event data is available via the API — https://caribbean.countdowns.co/api/events/2026 (free tier returns name, dates, country; more fields on the medium/premium tiers).

${items}
`;

  return new Response(md, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
