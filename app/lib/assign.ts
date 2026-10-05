import { TEAMS, type Role, type TeamKey } from "./scoring";

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

/** The people competing for each color in one heat. */
export type HeatLineup = Record<TeamKey, string[]>;

export interface Assignment {
  player: string;
  team: TeamKey;
  role: Role;
  /** The heat a competitor plays in. Supporters have none. */
  heat: number | null;
}

/**
 * Assigns everyone to a color for one game. Competitors keep the colors and
 * heats they were given (heat numbers start at 1 in the order given). Everyone
 * else is dealt as a supporter to a random team among the currently smallest,
 * counting competitors, so total team sizes differ by at most 1.
 */
export function dealEvent(
  players: readonly string[],
  heats: readonly HeatLineup[],
  rng: Rng,
): Assignment[] {
  const competitors: Assignment[] = heats.flatMap((lineup, i) =>
    TEAMS.flatMap((team) =>
      lineup[team].map((player) => ({
        player,
        team,
        role: "competitor" as const,
        heat: i + 1,
      })),
    ),
  );
  const competing = new Set(competitors.map((a) => a.player));
  const sizes = new Map<TeamKey, number>(
    TEAMS.map((t) => [t, competitors.filter((a) => a.team === t).length]),
  );

  const supporters = shuffle(
    players.filter((p) => !competing.has(p)),
    rng,
  ).map((player) => {
    const smallest = Math.min(...sizes.values());
    const candidates = TEAMS.filter((t) => sizes.get(t) === smallest);
    const team = candidates[Math.floor(rng() * candidates.length)];
    sizes.set(team, smallest + 1);
    return { player, team, role: "supporter" as const, heat: null };
  });

  return [...competitors, ...supporters];
}
