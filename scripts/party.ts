import { createRng, dealEvent, type Assignment, type HeatLineup } from "../app/lib/assign";
import { TEAMS } from "../app/lib/scoring";
import { parseCsv } from "./csv";

export interface PartyEvent {
  position: number;
  name: string;
  description: string;
  /** Heat 1 first. Each lists the people competing for each color. */
  heats: HeatLineup[];
}

export interface Party {
  players: string[];
  events: PartyEvent[];
  /** Everyone's team for each game, keyed by event position. */
  assignments: Map<number, Assignment[]>;
}

export interface PartyResult {
  party: Party | null;
  errors: string[];
  warnings: string[];
}

export interface PartyInput {
  playersCsv: string;
  eventsCsv: string;
  heatsCsv: string;
  seed: string;
}

/** Most people a color can field in one heat. The team cards are designed for this many names. */
const MAX_PER_TEAM = 3;

/**
 * Validates the three CSVs and deals supporters. Each game is dealt with its
 * own random stream (seeded from the seed and the game's name), so reordering
 * games or changing one game's lineup never changes another game's teams.
 */
export function buildParty({ playersCsv, eventsCsv, heatsCsv, seed }: PartyInput): PartyResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const players = parseCsv(playersCsv).map((r) => r.name);
  const playerSet = new Set(players);
  if (players.length === 0) errors.push("players.csv has no players");
  if (players.some((p) => !p)) errors.push("players.csv has a blank name");
  if (playerSet.size !== players.length) {
    const dupes = players.filter((p, i) => players.indexOf(p) !== i);
    errors.push(`players.csv has duplicate names: ${[...new Set(dupes)].join(", ")}`);
  }

  const eventsByName = new Map<string, PartyEvent>();
  const positions = new Set<number>();
  for (const [i, row] of parseCsv(eventsCsv).entries()) {
    const line = `events.csv row ${i + 2}`;
    const position = Number(row.position);
    if (!Number.isInteger(position) || position < 1) errors.push(`${line}: position must be 1, 2, 3...`);
    if (positions.has(position)) errors.push(`${line}: position ${position} is used twice`);
    positions.add(position);
    if (!row.name) {
      errors.push(`${line}: name is blank`);
      continue;
    }
    const key = row.name.toLowerCase();
    if (eventsByName.has(key)) errors.push(`${line}: "${row.name}" appears twice`);
    eventsByName.set(key, { position, name: row.name, description: row.description ?? "", heats: [] });
  }

  if (eventsByName.size === 0) errors.push("events.csv has no games");

  // Collect heats per game, keyed by heat number, before checking they are contiguous.
  const heatsByEvent = new Map<string, Map<number, HeatLineup>>();
  for (const [i, row] of parseCsv(heatsCsv).entries()) {
    const line = `heats.csv row ${i + 2}`;
    const event = eventsByName.get((row.event ?? "").toLowerCase());
    if (!event) {
      errors.push(`${line}: no game named "${row.event}" in events.csv`);
      continue;
    }
    const number = Number(row.heat);
    if (!Number.isInteger(number) || number < 1) {
      errors.push(`${line} (${event.name}): heat must be 1, 2, 3...`);
      continue;
    }
    const heats = heatsByEvent.get(event.name) ?? new Map<number, HeatLineup>();
    heatsByEvent.set(event.name, heats);
    if (heats.has(number)) {
      errors.push(`${line} (${event.name}): heat ${number} appears twice`);
      continue;
    }

    const lineup = {} as HeatLineup;
    for (const team of TEAMS) {
      lineup[team] = (row[team] ?? "")
        .split(";")
        .map((n) => n.trim())
        .filter(Boolean);
      if (lineup[team].length === 0) {
        errors.push(`${line} (${event.name}, heat ${number}): no ${team} competitor`);
      }
      for (const name of lineup[team]) {
        if (!playerSet.has(name)) {
          errors.push(`${line} (${event.name}, heat ${number}): "${name}" isn't in players.csv`);
        }
      }
      if (lineup[team].length > MAX_PER_TEAM) {
        errors.push(
          `${line} (${event.name}, heat ${number}): ${team} has ${lineup[team].length} people; the most per color is ${MAX_PER_TEAM}`,
        );
      }
    }
    const counts = TEAMS.map((t) => lineup[t].length);
    if (new Set(counts).size > 1) {
      warnings.push(
        `${event.name}, heat ${number}: uneven teams (${TEAMS.map((t) => `${t} ${lineup[t].length}`).join(", ")})`,
      );
    }
    heats.set(number, lineup);
  }

  for (const event of eventsByName.values()) {
    const heats = heatsByEvent.get(event.name);
    if (!heats || heats.size === 0) {
      errors.push(`${event.name}: no rows in heats.csv`);
      continue;
    }
    const numbers = [...heats.keys()].sort((a, b) => a - b);
    if (numbers.some((n, i) => n !== i + 1)) {
      errors.push(`${event.name}: heats must be numbered 1, 2, 3 with none missing (found ${numbers.join(", ")})`);
      continue;
    }
    event.heats = numbers.map((n) => heats.get(n)!);

    const everyone = event.heats.flatMap((h) => TEAMS.flatMap((t) => h[t]));
    const repeated = everyone.filter((p, i) => everyone.indexOf(p) !== i);
    if (repeated.length) {
      errors.push(`${event.name}: ${[...new Set(repeated)].join(", ")} is listed more than once`);
    }
  }

  if (errors.length) return { party: null, errors, warnings };

  const events = [...eventsByName.values()].sort((a, b) => a.position - b.position);
  const assignments = new Map(
    events.map((e) => [e.position, dealEvent(players, e.heats, createRng(`${seed}:${e.name}`))]),
  );
  return { party: { players, events, assignments }, errors, warnings };
}
