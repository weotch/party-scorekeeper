import { describe, expect, it } from "vitest";
import { createRng, dealBonus, dealStandard, type Assignment } from "./assign";

const players = Array.from({ length: 26 }, (_, i) => `P${i + 1}`);
const competitors = { red: "P1", yellow: "P2", blue: "P3", green: "P4" };

function sizes(assignments: Assignment[]) {
  const counts: Record<string, number> = {};
  for (const a of assignments) counts[a.team] = (counts[a.team] ?? 0) + 1;
  return Object.values(counts).sort();
}

describe("dealStandard", () => {
  const dealt = dealStandard(players, competitors, createRng("test"));

  it("puts every player on exactly one team", () => {
    expect(dealt.map((a) => a.player).sort()).toEqual([...players].sort());
  });

  it("gives each color its competitor", () => {
    const comps = dealt.filter((a) => a.role === "competitor");
    expect(Object.fromEntries(comps.map((a) => [a.team, a.player]))).toEqual(competitors);
  });

  it("keeps team sizes within 1 of each other", () => {
    expect(sizes(dealt)).toEqual([6, 6, 7, 7]);
  });

  it("is deterministic for a seed and varies across seeds", () => {
    expect(dealStandard(players, competitors, createRng("test"))).toEqual(dealt);
    expect(dealStandard(players, competitors, createRng("other"))).not.toEqual(dealt);
  });
});

describe("dealBonus", () => {
  it("splits everyone into Team A and Team B evenly", () => {
    const dealt = dealBonus(players.slice(0, 25), createRng("bonus"));
    expect(dealt).toHaveLength(25);
    expect(new Set(dealt.map((a) => a.team))).toEqual(new Set(["a", "b"]));
    expect(sizes(dealt)).toEqual([12, 13]);
    expect(dealt.every((a) => a.role === "supporter")).toBe(true);
  });
});
