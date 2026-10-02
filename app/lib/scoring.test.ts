import { describe, expect, it } from "vitest";
import {
  computeStandings,
  hasPlaceGap,
  pointsForPlace,
  type ScoringMember,
  type ScoringTeam,
} from "./scoring";

describe("pointsForPlace", () => {
  it("maps places to the event's points table", () => {
    expect([1, 2, 3, 4].map((p) => pointsForPlace([5, 3, 2, 1], p))).toEqual([5, 3, 2, 1]);
  });

  it("gives 0 for no place or a place past the table", () => {
    expect(pointsForPlace([5, 3, 2, 1], null)).toBe(0);
    expect(pointsForPlace([5, 0], 3)).toBe(0);
  });

  it("gives the bonus loser 0", () => {
    expect(pointsForPlace([5, 0], 2)).toBe(0);
  });
});

describe("hasPlaceGap", () => {
  it("allows ties that move the rest up", () => {
    expect(hasPlaceGap([1, 1, 2, 3])).toBe(false);
    expect(hasPlaceGap([1, 2, 2, 3])).toBe(false);
  });

  it("allows partial entry starting from 1st", () => {
    expect(hasPlaceGap([1, null, null, null])).toBe(false);
    expect(hasPlaceGap([null, null, null, null])).toBe(false);
  });

  it("flags skipped places", () => {
    expect(hasPlaceGap([1, 1, 3, 4])).toBe(true);
    expect(hasPlaceGap([2, null, null, null])).toBe(true);
  });
});

describe("computeStandings", () => {
  const players = ["Ann", "Bo", "Cy", "Di", "Ed", "Fay"].map((name) => ({ id: name, name }));
  const events = [
    { id: "e1", points: [5, 3, 2, 1] },
    { id: "bonus", points: [5, 0] },
  ];

  const members: ScoringMember[] = [
    // e1: Ann, Bo, Cy, Di compete; Ed supports red, Fay supports green
    { event_id: "e1", player_id: "Ann", team: "red" },
    { event_id: "e1", player_id: "Bo", team: "yellow" },
    { event_id: "e1", player_id: "Cy", team: "blue" },
    { event_id: "e1", player_id: "Di", team: "green" },
    { event_id: "e1", player_id: "Ed", team: "red" },
    { event_id: "e1", player_id: "Fay", team: "green" },
    // bonus: Ann, Cy, Ed on A; Bo, Di, Fay on B
    ...["Ann", "Cy", "Ed"].map((p) => ({ event_id: "bonus", player_id: p, team: "a" as const })),
    ...["Bo", "Di", "Fay"].map((p) => ({ event_id: "bonus", player_id: p, team: "b" as const })),
  ];

  it("gives supporters their competitor's points and adds up across events", () => {
    const teams: ScoringTeam[] = [
      { event_id: "e1", team: "red", place: 1 },
      { event_id: "e1", team: "yellow", place: 2 },
      { event_id: "e1", team: "blue", place: 3 },
      { event_id: "e1", team: "green", place: 4 },
      { event_id: "bonus", team: "a", place: 2 },
      { event_id: "bonus", team: "b", place: 1 },
    ];
    const totals = Object.fromEntries(
      computeStandings(players, events, teams, members).map((s) => [s.name, s.total]),
    );
    expect(totals).toEqual({ Ann: 5, Ed: 5, Bo: 8, Cy: 2, Di: 6, Fay: 6 });
  });

  it("scores ties by the place entered", () => {
    const teams: ScoringTeam[] = [
      { event_id: "e1", team: "red", place: 1 },
      { event_id: "e1", team: "yellow", place: 1 },
      { event_id: "e1", team: "blue", place: 2 },
      { event_id: "e1", team: "green", place: 3 },
    ];
    const totals = Object.fromEntries(
      computeStandings(players, events, teams, members).map((s) => [s.name, s.total]),
    );
    expect(totals).toMatchObject({ Ann: 5, Bo: 5, Cy: 3, Di: 2 });
  });

  it("ignores events without results", () => {
    const standings = computeStandings(players, events, [], members);
    expect(standings.every((s) => s.total === 0)).toBe(true);
  });

  it("sorts highest first and shares ranks on ties", () => {
    const teams: ScoringTeam[] = [
      { event_id: "e1", team: "red", place: 1 },
      { event_id: "e1", team: "yellow", place: 2 },
      { event_id: "e1", team: "blue", place: 3 },
      { event_id: "e1", team: "green", place: 4 },
    ];
    const standings = computeStandings(players, events, teams, members);
    expect(standings.map((s) => [s.name, s.total, s.rank])).toEqual([
      ["Ann", 5, 1],
      ["Ed", 5, 1],
      ["Bo", 3, 3],
      ["Cy", 2, 4],
      ["Di", 1, 5],
      ["Fay", 1, 5],
    ]);
  });
});
