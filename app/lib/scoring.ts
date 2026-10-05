export const TEAMS = ["red", "yellow", "blue", "green"] as const;
export type TeamKey = (typeof TEAMS)[number];
export type Role = "competitor" | "supporter";

/** Points per heat, where index 0 is 1st place. */
export const DEFAULT_POINTS = [5, 3, 2, 1];

/** Points for a place. Unplaced or out of range is 0. */
export function pointsForPlace(points: number[], place: number | null): number {
  if (place == null || place < 1) return 0;
  return points[place - 1] ?? 0;
}

/**
 * True when the entered places skip a number (for example 1, 1, 3).
 * Ties are fine, but places below a tie should move up.
 */
export function hasPlaceGap(places: (number | null)[]): boolean {
  const distinct = [...new Set(places.filter((p): p is number => p != null))].sort(
    (a, b) => a - b,
  );
  return distinct.some((place, i) => place !== i + 1);
}

export interface ScoringEvent {
  id: string;
  points: number[];
}
export interface ScoringResult {
  event_id: string;
  heat: number;
  team: TeamKey;
  place: number | null;
}
export interface ScoringMember {
  event_id: string;
  player_id: string;
  team: TeamKey;
}
export interface ScoringPlayer {
  id: string;
  name: string;
}

/**
 * Points each team has earned in each game, summed over the game's heats.
 * Keyed `${eventId}:${team}`.
 */
export function teamEventPoints(
  events: ScoringEvent[],
  results: ScoringResult[],
): Map<string, number> {
  const pointsByEvent = new Map(events.map((e) => [e.id, e.points]));
  const totals = new Map<string, number>();
  for (const r of results) {
    const points = pointsByEvent.get(r.event_id);
    if (!points) continue;
    const key = `${r.event_id}:${r.team}`;
    totals.set(key, (totals.get(key) ?? 0) + pointsForPlace(points, r.place));
  }
  return totals;
}

export interface Standing {
  playerId: string;
  name: string;
  total: number;
  /** Competition ranking: ties share a rank and the next rank is skipped (1, 2, 2, 4). */
  rank: number;
}

/**
 * Total points per player across all games, sorted highest first. Everyone on
 * a color in a game, competitors and supporters, gets that team's game score.
 */
export function computeStandings(
  players: ScoringPlayer[],
  events: ScoringEvent[],
  results: ScoringResult[],
  members: ScoringMember[],
): Standing[] {
  const teamPoints = teamEventPoints(events, results);

  const totals = new Map(players.map((p) => [p.id, 0]));
  for (const m of members) {
    const earned = teamPoints.get(`${m.event_id}:${m.team}`) ?? 0;
    totals.set(m.player_id, (totals.get(m.player_id) ?? 0) + earned);
  }

  const sorted = players
    .map((p) => ({ playerId: p.id, name: p.name, total: totals.get(p.id) ?? 0 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return sorted.map((s) => ({
    ...s,
    rank: sorted.findIndex((other) => other.total === s.total) + 1,
  }));
}

/** Number of games where every heat has a place for every team. */
export function eventsScored(events: ScoringEvent[], results: ScoringResult[]): number {
  return events.filter((e) => {
    const own = results.filter((r) => r.event_id === e.id);
    return own.length > 0 && own.every((r) => r.place !== null);
  }).length;
}

export interface HeatView {
  number: number;
  places: Record<TeamKey, number | null>;
  /** Names of the people competing for each team in this heat. */
  competitors: Record<TeamKey, string[]>;
}

/** Groups one game's results and competitors by heat. */
export function buildHeats(
  results: { heat: number; team: TeamKey; place: number | null }[],
  competitors: { heat: number; team: TeamKey; name: string }[],
): HeatView[] {
  const numbers = [...new Set(results.map((r) => r.heat))].sort((a, b) => a - b);
  return numbers.map((number) => {
    const places = Object.fromEntries(TEAMS.map((t) => [t, null])) as Record<
      TeamKey,
      number | null
    >;
    for (const r of results) if (r.heat === number) places[r.team] = r.place;

    const names = Object.fromEntries(TEAMS.map((t) => [t, [] as string[]])) as Record<
      TeamKey,
      string[]
    >;
    for (const c of competitors) if (c.heat === number) names[c.team].push(c.name);
    for (const t of TEAMS) names[t].sort((a, b) => a.localeCompare(b));

    return { number, places, competitors: names };
  });
}

export function isHeatComplete(heat: Pick<HeatView, "places">): boolean {
  return TEAMS.every((t) => heat.places[t] !== null);
}

/** The first heat still missing a place, or the first heat when all are scored. */
export function nextHeatToScore(heats: HeatView[]): number {
  return (heats.find((h) => !isHeatComplete(h)) ?? heats[0])?.number ?? 1;
}

/** Each team's points for one game so far, summed over its heats. */
export function gameTotals(
  points: number[],
  heats: Pick<HeatView, "places">[],
): Record<TeamKey, number> {
  const totals = Object.fromEntries(TEAMS.map((t) => [t, 0])) as Record<TeamKey, number>;
  for (const heat of heats) {
    for (const t of TEAMS) totals[t] += pointsForPlace(points, heat.places[t]);
  }
  return totals;
}
