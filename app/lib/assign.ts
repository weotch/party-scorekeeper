import { BONUS_TEAMS, STANDARD_TEAMS, type Role, type TeamKey } from "./scoring";

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) seeded from a string, so reruns deal the same teams. */
export function createRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface Assignment {
  player: string;
  team: TeamKey;
  role: Role;
}

/**
 * Deal `players` across `teams` as evenly as possible: each player goes to a
 * random team among the currently smallest, so sizes differ by at most 1.
 */
function deal(
  players: readonly string[],
  teams: readonly TeamKey[],
  rng: Rng,
): Assignment[] {
  const sizes = new Map(teams.map((t) => [t, 0]));
  return shuffle(players, rng).map((player) => {
    const smallest = Math.min(...sizes.values());
    const candidates = teams.filter((t) => sizes.get(t) === smallest);
    const team = candidates[Math.floor(rng() * candidates.length)];
    sizes.set(team, smallest + 1);
    return { player, team, role: "supporter" as const };
  });
}

/** Standard event: each color gets its competitor, everyone else is dealt as a supporter. */
export function dealStandard(
  players: readonly string[],
  competitors: Record<(typeof STANDARD_TEAMS)[number], string>,
  rng: Rng,
): Assignment[] {
  const competing = new Set(Object.values(competitors));
  const assignments: Assignment[] = STANDARD_TEAMS.map((team) => ({
    player: competitors[team],
    team,
    role: "competitor",
  }));
  return assignments.concat(
    deal(
      players.filter((p) => !competing.has(p)),
      STANDARD_TEAMS,
      rng,
    ),
  );
}

/** Bonus event: everyone is split between Team A and Team B. */
export function dealBonus(players: readonly string[], rng: Rng): Assignment[] {
  return deal(players, BONUS_TEAMS, rng);
}
