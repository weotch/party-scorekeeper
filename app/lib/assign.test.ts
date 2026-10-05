import { describe, expect, it } from "vitest";
import { createRng, dealEvent, type Assignment, type HeatLineup } from "./assign";
import { TEAMS } from "./scoring";

const players = Array.from({ length: 26 }, (_, i) => `P${i + 1}`);

const lineup = (red: string[], yellow: string[], blue: string[], green: string[]): HeatLineup => ({
  red,
  yellow,
  blue,
  green,
});

const sizes = (assignments: Assignment[]) =>
  TEAMS.map((t) => assignments.filter((a) => a.team === t).length);

const spread = (assignments: Assignment[]) => Math.max(...sizes(assignments)) - Math.min(...sizes(assignments));

describe("dealEvent", () => {
  it("handles a one-heat game with one competitor per color", () => {
    const dealt = dealEvent(players, [lineup(["P1"], ["P2"], ["P3"], ["P4"])], createRng("a"));
    expect(dealt.map((a) => a.player).sort()).toEqual([...players].sort());
    expect(dealt.filter((a) => a.role === "competitor").map((a) => [a.player, a.team, a.heat])).toEqual([
      ["P1", "red", 1],
      ["P2", "yellow", 1],
      ["P3", "blue", 1],
      ["P4", "green", 1],
    ]);
    expect(dealt.filter((a) => a.role === "supporter").every((a) => a.heat === null)).toBe(true);
    expect(sizes(dealt).sort()).toEqual([6, 6, 7, 7]);
  });

  it("gives each heat its own competitors and keeps teams balanced", () => {
    const dealt = dealEvent(
      players,
      [lineup(["P1"], ["P2"], ["P3"], ["P4"]), lineup(["P5"], ["P6"], ["P7"], ["P8"])],
      createRng("b"),
    );
    const competitors = dealt.filter((a) => a.role === "competitor");
    expect(competitors).toHaveLength(8);
    expect(competitors.filter((a) => a.heat === 2).map((a) => a.player)).toEqual(["P5", "P6", "P7", "P8"]);
    expect(dealt.map((a) => a.player).sort()).toEqual([...players].sort());
    expect(spread(dealt)).toBeLessThanOrEqual(1);
  });

  it("supports several competitors per color in a heat", () => {
    const dealt = dealEvent(
      players,
      [
        lineup(
          ["P1", "P2", "P3"],
          ["P4", "P5", "P6"],
          ["P7", "P8", "P9"],
          ["P10", "P11", "P12"],
        ),
      ],
      createRng("c"),
    );
    expect(dealt.filter((a) => a.role === "competitor")).toHaveLength(12);
    expect(dealt.map((a) => a.player).sort()).toEqual([...players].sort());
    expect(sizes(dealt).sort()).toEqual([6, 6, 7, 7]);
  });

  it("counts competitors so uneven lineups still end up balanced", () => {
    const dealt = dealEvent(
      players,
      [lineup(["P1", "P2", "P3"], ["P4"], ["P5"], ["P6"])],
      createRng("d"),
    );
    expect(spread(dealt)).toBeLessThanOrEqual(1);
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const heats = [lineup(["P1"], ["P2"], ["P3"], ["P4"])];
    const dealt = dealEvent(players, heats, createRng("test"));
    expect(dealEvent(players, heats, createRng("test"))).toEqual(dealt);
    expect(dealEvent(players, heats, createRng("other"))).not.toEqual(dealt);
  });
});
