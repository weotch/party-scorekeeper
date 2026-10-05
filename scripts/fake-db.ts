/**
 * A tiny fake of the PostgREST endpoints the app uses, seeded from data/*.csv,
 * for exercising the UI without a real Supabase project.
 *
 *   npm run fake-db   # listens on :54321 (PORT overrides, DATA_DIR picks the CSV folder)
 *   SUPABASE_URL=http://localhost:54321 SUPABASE_SECRET_KEY=x APP_PASSWORD=bopya SESSION_SECRET=test npm run dev
 *
 * Test hooks: GET /fail?n=2 makes the next 2 writes fail, GET /latency?ms=800
 * slows writes down so optimistic UI is easy to see.
 */
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { DEFAULT_POINTS, TEAMS } from "../app/lib/scoring";
import { buildParty } from "./party";

const dir = process.env.DATA_DIR ?? "data";
const port = Number(process.env.PORT ?? 54321);
const read = (file: string) => readFileSync(`${dir}/${file}`, "utf8");

const { party, errors } = buildParty({
  playersCsv: read("players.csv"),
  eventsCsv: read("events.csv"),
  heatsCsv: read("heats.csv"),
  seed: "fake-db",
});
if (!party) {
  console.error(errors.join("\n"));
  process.exit(1);
}

type Row = Record<string, unknown>;
const players: Row[] = party.players.map((name, i) => ({ id: `p${i + 1}`, name }));
const playerId = new Map(players.map((p) => [p.name as string, p.id]));
const events: Row[] = party.events.map((e) => ({
  id: `e${e.position}`,
  position: e.position,
  name: e.name,
  description: e.description || null,
  points: DEFAULT_POINTS,
}));
const heatResults: Row[] = [];
const members: Row[] = [];
for (const e of party.events) {
  const event_id = `e${e.position}`;
  e.heats.forEach((_, i) => {
    for (const team of TEAMS) heatResults.push({ event_id, heat: i + 1, team, place: null });
  });
  for (const a of party.assignments.get(e.position)!) {
    members.push({ event_id, player_id: playerId.get(a.player), team: a.team, role: a.role, heat: a.heat });
  }
}
const tables: Record<string, Row[]> = {
  players,
  events,
  heat_results: heatResults,
  event_members: members,
};

let failNext = 0;
let latencyMs = 250;

createServer(async (req, res) => {
  const url = new URL(req.url!, "http://localhost");
  const send = (body: unknown, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (url.pathname === "/fail") {
    failNext = Number(url.searchParams.get("n") ?? 1);
    return send({ failNext });
  }
  if (url.pathname === "/latency") {
    latencyMs = Number(url.searchParams.get("ms") ?? 0);
    return send({ latencyMs });
  }

  const rows = tables[url.pathname.replace("/rest/v1/", "")];
  if (!rows) return send({ message: `unknown table ${url.pathname}` }, 404);

  // PostgREST filters look like ?event_id=eq.e1
  const filters = [...url.searchParams]
    .filter(([, v]) => v.startsWith("eq."))
    .map(([k, v]) => [k, v.slice(3)] as const);
  const matches = rows.filter((row) => filters.every(([k, v]) => String(row[k]) === v));

  if (req.method === "PATCH") {
    let body = "";
    for await (const chunk of req) body += chunk;
    await new Promise((r) => setTimeout(r, latencyMs));
    if (failNext > 0) {
      failNext--;
      return send({ message: "simulated failure" }, 500);
    }
    for (const row of matches) Object.assign(row, JSON.parse(body));
    return send(matches.map((row) => project(row, url.searchParams.get("select"))));
  }

  let out = matches;
  const order = url.searchParams.get("order")?.split(".")[0];
  if (order) out = [...out].sort((a, b) => Number(a[order]) - Number(b[order]));
  send(out.map((row) => project(row, url.searchParams.get("select"))));
}).listen(port, () => console.log(`fake-db listening on ${port}`));

/** Applies ?select=a,b,players(name): picks columns and embeds the member's player. */
function project(row: Row, select: string | null): Row {
  if (!select || select === "*") return row;
  const out: Row = {};
  for (const part of select.split(",").map((s) => s.trim())) {
    if (part === "players(name)") {
      out.players = { name: players.find((p) => p.id === row.player_id)?.name };
    } else {
      out[part] = row[part];
    }
  }
  return out;
}
