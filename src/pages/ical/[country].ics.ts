import type { APIRoute, GetStaticPaths } from "astro";
import events2026 from '../../data/events-2026.json';
import events2027 from '../../data/events-2027.json';

type EventRecord = {
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
  city?: string;
  country: string;
  website?: string;
};

const eventsByYear: Record<string, EventRecord[]> = {
  '2026': events2026 as EventRecord[],
  '2027': events2027 as EventRecord[],
};

// Merge all years into a single array for "all"
const allEvents: EventRecord[] = [
  ...eventsByYear['2026'],
  ...eventsByYear['2027'],
];

function toIcalDate(dateStr: string) {
  return dateStr.replace(/-/g, "");
}

function escapeIcal(str: string = "") {
  return str.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

function buildIcal(entries: EventRecord[]) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Caribbean Event Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Caribbean Event Deadlines",
    "X-WR-TIMEZONE:America/Martinique",
  ];

  for (const f of entries) {
    const uid = `${f.name.toLowerCase().replace(/\s+/g, "-")}@caribbean-event-deadlines`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${toIcalDate(f.startDate)}`,
      `DTEND;VALUE=DATE:${toIcalDate(f.endDate)}`,
      `SUMMARY:${escapeIcal(f.name)}`,
      `DESCRIPTION:${escapeIcal(f.description ?? "")}`,
      `LOCATION:${escapeIcal(`${f.city ?? ""}, ${f.country}`)}`,
      `URL:${f.website ?? ""}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export const getStaticPaths: GetStaticPaths = () => {
  const countries = [
    ...new Set(allEvents.map((f) => f.country).filter(Boolean)),
  ];
  return [
    { params: { country: "all" } },
    ...countries.map((c) => ({
      params: { country: c.toLowerCase().replace(/\s+/g, "-") },
    })),
  ];
};

export const GET: APIRoute = ({ params }) => {
  const { country } = params;
  const year = params.year as string | undefined; // if you later add year param

  const source =
    country === "all"
      ? allEvents
      : allEvents.filter(
          (f) => f.country.toLowerCase().replace(/\s+/g, "-") === country
        );

  return new Response(buildIcal(source), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${country}.ics"`,
    },
  });
};
