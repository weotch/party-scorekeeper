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

/**
 * Spreads repeat pairings across games. Within each game, swaps supporters
 * between colors whenever that lowers how often the same two people share a
 * color across all games (it minimizes the sum of squared "games together"
 * counts). Competitors never move, team sizes never change, and supporters stay
 * one color per game. The rng only orders the search, so results are
 * deterministic for a seed.
 */
export function mixTeams(games: readonly Assignment[][], rng: Rng, maxRounds = 50): Assignment[][] {
  const players = [...new Set(games.flat().map((a) => a.player))];
  const index = new Map(players.map((p, i) => [p, i]));
  const n = players.length;
  const together = new Int32Array(n * n);
  const add = (a: number, b: number, d: number) => {
    together[a * n + b] += d;
    together[b * n + a] += d;
  };

  // Current members of each color in each game, as player indexes
  const teams = games.map((game) => {
    const byTeam = new Map<TeamKey, number[]>(TEAMS.map((t) => [t, []]));
    for (const a of game) byTeam.get(a.team)!.push(index.get(a.player)!);
    return byTeam;
  });
  for (const byTeam of teams) {
    for (const members of byTeam.values()) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) add(members[i], members[j], 1);
      }
    }
  }
  const teamOf = teams.map((byTeam) => {
    const m = new Map<number, TeamKey>();
    for (const [team, members] of byTeam) for (const p of members) m.set(p, team);
    return m;
  });
  const supporters = games.map((game) =>
    game.filter((a) => a.role === "supporter").map((a) => index.get(a.player)!),
  );

  // Change in the objective if x (on team A) and y (on team B) trade places
  const swapDelta = (A: number[], B: number[], x: number, y: number) => {
    let delta = 0;
    for (const m of A) {
      if (m === x) continue;
      delta += -2 * together[x * n + m] + 1 + 2 * together[y * n + m] + 1;
    }
    for (const m of B) {
      if (m === y) continue;
      delta += -2 * together[y * n + m] + 1 + 2 * together[x * n + m] + 1;
    }
    return delta;
  };

  for (let round = 0; round < maxRounds; round++) {
    let improved = false;
    for (let g = 0; g < games.length; g++) {
      for (const x of shuffle(supporters[g], rng)) {
        const teamX = teamOf[g].get(x)!;
        const A = teams[g].get(teamX)!;
        let best = { delta: 0, y: -1 };
        for (const y of supporters[g]) {
          const teamY = teamOf[g].get(y)!;
          if (teamY === teamX) continue;
          const delta = swapDelta(A, teams[g].get(teamY)!, x, y);
          if (delta < best.delta) best = { delta, y };
        }
        if (best.y === -1) continue;

        const y = best.y;
        const teamY = teamOf[g].get(y)!;
        const B = teams[g].get(teamY)!;
        for (const m of A) if (m !== x) { add(x, m, -1); add(y, m, 1); }
        for (const m of B) if (m !== y) { add(y, m, -1); add(x, m, 1); }
        A[A.indexOf(x)] = y;
        B[B.indexOf(y)] = x;
        teamOf[g].set(x, teamY);
        teamOf[g].set(y, teamX);
        improved = true;
      }
    }
    if (!improved) break;
  }

  return games.map((game, g) =>
    game.map((a) => ({ ...a, team: teamOf[g].get(index.get(a.player)!)! })),
  );
}
