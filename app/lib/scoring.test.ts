import { describe, expect, it } from "vitest";
import {
  buildHeats,
  computeStandings,
  eventsScored,
  gameTotals,
  hasPlaceGap,
  isHeatComplete,
  nextHeatToScore,
  pointsForPlace,
  type ScoringMember,
  type ScoringResult,
} from "./scoring";

const POINTS = [5, 3, 2, 1];

describe("pointsForPlace", () => {
  it("maps places to the points table", () => {
    expect([1, 2, 3, 4].map((p) => pointsForPlace(POINTS, p))).toEqual([5, 3, 2, 1]);
  });

  it("gives 0 for no place or a place past the table", () => {
    expect(pointsForPlace(POINTS, null)).toBe(0);
    expect(pointsForPlace(POINTS, 5)).toBe(0);
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

const result = (
  event_id: string,
  heat: number,
  team: ScoringResult["team"],
  place: number | null,
): ScoringResult => ({ event_id, heat, team, place });

/** All four teams for one heat, in red, yellow, blue, green order. */
const heatOf = (event_id: string, heat: number, places: (number | null)[]) =>
  (["red", "yellow", "blue", "green"] as const).map((team, i) =>
    result(event_id, heat, team, places[i]),
  );

describe("computeStandings", () => {
  const players = ["Ann", "Bo", "Cy", "Di", "Ed", "Fay"].map((name) => ({ id: name, name }));
  const events = [
    { id: "bobble", points: POINTS },
    { id: "potato", points: POINTS },
  ];
  const members: ScoringMember[] = [
    // Balloon Bobble: Ann and Bo play heat 1, Cy and Di play heat 2; Ed and Fay support
    { event_id: "bobble", player_id: "Ann", team: "red" },
    { event_id: "bobble", player_id: "Bo", team: "blue" },
    { event_id: "bobble", player_id: "Cy", team: "yellow" },
    { event_id: "bobble", player_id: "Di", team: "green" },
    { event_id: "bobble", player_id: "Ed", team: "red" },
    { event_id: "bobble", player_id: "Fay", team: "green" },
    // Hot Potato Tag: one heat, everyone on a color
    { event_id: "potato", player_id: "Ann", team: "red" },
    { event_id: "potato", player_id: "Bo", team: "red" },
    { event_id: "potato", player_id: "Cy", team: "yellow" },
    { event_id: "potato", player_id: "Di", team: "blue" },
    { event_id: "potato", player_id: "Ed", team: "green" },
    { event_id: "potato", player_id: "Fay", team: "green" },
  ];

  const totals = (results: ScoringResult[]) =>
    Object.fromEntries(
      computeStandings(players, events, results, members).map((s) => [s.name, s.total]),
    );

  it("sums a team's points across heats and gives them to everyone on that color", () => {
    const results = [
      // Heat 1: red 1st, blue 2nd, green 3rd, yellow 4th. Heat 2: blue 1st, yellow 2nd, red 3rd, green 4th.
      ...heatOf("bobble", 1, [1, 4, 2, 3]),
      ...heatOf("bobble", 2, [3, 2, 1, 4]),
    ];
    // red 5+2=7, yellow 1+3=4, blue 3+5=8, green 2+1=3
    expect(totals(results)).toEqual({ Ann: 7, Ed: 7, Cy: 4, Bo: 8, Di: 3, Fay: 3 });
  });

  it("scores a one-heat game the same however many people compete per team", () => {
    expect(totals(heatOf("potato", 1, [1, 2, 3, 4]))).toEqual({
      Ann: 5,
      Bo: 5,
      Cy: 3,
      Di: 2,
      Ed: 1,
      Fay: 1,
    });
  });

  it("adds up across games and scores ties by the place entered", () => {
    const results = [
      ...heatOf("bobble", 1, [1, 1, 2, 3]),
      ...heatOf("bobble", 2, [null, null, null, null]),
      ...heatOf("potato", 1, [2, 1, 3, 4]),
    ];
    expect(totals(results)).toEqual({
      Ann: 5 + 3,
      Ed: 5 + 1,
      Bo: 3 + 3,
      Cy: 5 + 5,
      Di: 2 + 2,
      Fay: 2 + 1,
    });
  });

  it("counts only heats that have places", () => {
    expect(Object.values(totals([])).every((t) => t === 0)).toBe(true);
    expect(totals([...heatOf("bobble", 1, [1, null, null, null])]).Ann).toBe(5);
  });

  it("sorts highest first and shares ranks on ties", () => {
    const standings = computeStandings(players, events, heatOf("potato", 1, [1, 2, 3, 4]), members);
    expect(standings.map((s) => [s.name, s.total, s.rank])).toEqual([
      ["Ann", 5, 1],
      ["Bo", 5, 1],
      ["Cy", 3, 3],
      ["Di", 2, 4],
      ["Ed", 1, 5],
      ["Fay", 1, 5],
    ]);
  });
});

describe("eventsScored", () => {
  const events = [
    { id: "a", points: POINTS },
    { id: "b", points: POINTS },
    { id: "c", points: POINTS },
  ];

  it("counts a game only when every heat is fully placed", () => {
    const results = [
      ...heatOf("a", 1, [1, 2, 3, 4]),
      ...heatOf("b", 1, [1, 2, 3, 4]),
      ...heatOf("b", 2, [1, 2, 3, null]),
      ...heatOf("c", 1, [1, 2, 3, 4]),
      ...heatOf("c", 2, [4, 3, 2, 1]),
    ];
    expect(eventsScored(events, results)).toBe(2);
  });

  it("does not count games with no results", () => {
    expect(eventsScored(events, [])).toBe(0);
  });
});

describe("heat helpers", () => {
  const results = [
    ...heatOf("e", 1, [1, 2, 3, 4]).map((r) => r),
    ...heatOf("e", 2, [2, 1, null, null]),
  ];
  const competitors = [
    { heat: 2, team: "red" as const, name: "Zed" },
    { heat: 1, team: "red" as const, name: "Cy" },
    { heat: 1, team: "red" as const, name: "Ann" },
    { heat: 1, team: "blue" as const, name: "Bo" },
  ];
  const heats = buildHeats(results, competitors);

  it("groups places and sorted competitor names by heat", () => {
    expect(heats.map((h) => h.number)).toEqual([1, 2]);
    expect(heats[0].places).toEqual({ red: 1, yellow: 2, blue: 3, green: 4 });
    expect(heats[0].competitors.red).toEqual(["Ann", "Cy"]);
    expect(heats[0].competitors.yellow).toEqual([]);
    expect(heats[1].competitors.red).toEqual(["Zed"]);
  });

  it("finds the heat to score next", () => {
    expect(isHeatComplete(heats[0])).toBe(true);
    expect(isHeatComplete(heats[1])).toBe(false);
    expect(nextHeatToScore(heats)).toBe(2);
    expect(nextHeatToScore([heats[0]])).toBe(1);
    expect(nextHeatToScore([])).toBe(1);
  });

  it("totals a game across heats", () => {
    expect(gameTotals(POINTS, heats)).toEqual({ red: 5 + 3, yellow: 3 + 5, blue: 2, green: 1 });
  });
});
