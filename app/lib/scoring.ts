export const STANDARD_TEAMS = ["red", "yellow", "blue", "green"] as const;
export const BONUS_TEAMS = ["a", "b"] as const;

export type TeamKey =
  | (typeof STANDARD_TEAMS)[number]
  | (typeof BONUS_TEAMS)[number];
export type EventKind = "standard" | "bonus";
export type Role = "competitor" | "supporter";

export const DEFAULT_POINTS: Record<EventKind, number[]> = {
  standard: [5, 3, 2, 1],
  bonus: [5, 0],
};

export function teamsForKind(kind: EventKind): readonly TeamKey[] {
  return kind === "standard" ? STANDARD_TEAMS : BONUS_TEAMS;
}

/** Points for a place, where `points[0]` is 1st place. Unplaced or out of range is 0. */
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
export interface ScoringTeam {
  event_id: string;
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

export interface Standing {
  playerId: string;
  name: string;
  total: number;
  /** Competition ranking: ties share a rank and the next rank is skipped (1, 2, 2, 4). */
  rank: number;
}

/** Total points per player across all events, sorted highest first. */
export function computeStandings(
  players: ScoringPlayer[],
  events: ScoringEvent[],
  teams: ScoringTeam[],
  members: ScoringMember[],
): Standing[] {
  const pointsByEvent = new Map(events.map((e) => [e.id, e.points]));
  const teamPoints = new Map<string, number>();
  for (const t of teams) {
    const points = pointsByEvent.get(t.event_id);
    if (points) teamPoints.set(`${t.event_id}:${t.team}`, pointsForPlace(points, t.place));
  }

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
