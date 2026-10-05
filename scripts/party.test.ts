import { describe, expect, it } from "vitest";
import { buildParty } from "./party";

const names = Array.from({ length: 26 }, (_, i) => `P${i + 1}`);
const playersCsv = `name\n${names.join("\n")}\n`;
const eventsCsv = [
  "position,name,description",
  '1,Balloon Bobble,"Keep a balloon aloft, lose limbs"',
  "2,Hot Potato Tag,",
].join("\n");
const heatsCsv = [
  "event,heat,red,yellow,blue,green",
  "Balloon Bobble,1,P1,P2,P3,P4",
  "Balloon Bobble,2,P5,P6,P7,P8",
  "Hot Potato Tag,1,P9;P10;P11,P12;P13;P14,P15;P16;P17,P18;P19;P20",
].join("\n");

const build = (overrides: Partial<Parameters<typeof buildParty>[0]> = {}) =>
  buildParty({ playersCsv, eventsCsv, heatsCsv, seed: "s", ...overrides });

describe("buildParty", () => {
  it("builds games with heats, multi-person teams, and descriptions", () => {
    const { party, errors, warnings } = build();
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(party!.events.map((e) => [e.name, e.heats.length])).toEqual([
      ["Balloon Bobble", 2],
      ["Hot Potato Tag", 1],
    ]);
    expect(party!.events[0].description).toBe("Keep a balloon aloft, lose limbs");
    expect(party!.events[1].heats[0].red).toEqual(["P9", "P10", "P11"]);
  });

  it("puts every player in every game exactly once", () => {
    const { party } = build();
    for (const assignments of party!.assignments.values()) {
      expect(assignments.map((a) => a.player).sort()).toEqual([...names].sort());
    }
  });

  it("is deterministic, and reordering games does not change a game's teams", () => {
    const first = build().party!;
    expect(build().party!.assignments).toEqual(first.assignments);

    const swapped = build({
      eventsCsv: "position,name,description\n2,Balloon Bobble,\n1,Hot Potato Tag,\n",
    }).party!;
    const bobble = (p: typeof first) => p.assignments.get(p.events.find((e) => e.name === "Balloon Bobble")!.position);
    expect(bobble(swapped)).toEqual(bobble(first));
  });

  it("changing one game's lineup leaves other games alone", () => {
    const first = build().party!;
    const edited = build({ heatsCsv: heatsCsv.replace("P1,P2,P3,P4", "P4,P3,P2,P1") }).party!;
    expect(edited.assignments.get(1)).not.toEqual(first.assignments.get(1));
    expect(edited.assignments.get(2)).toEqual(first.assignments.get(2));
  });

  it("warns about uneven teams without failing", () => {
    const { party, warnings } = build({
      heatsCsv: heatsCsv.replace("P9;P10;P11,P12;P13;P14", "P9;P10;P11,P12;P13"),
    });
    expect(party).not.toBeNull();
    expect(warnings.join("\n")).toMatch(/Hot Potato Tag, heat 1: uneven teams \(red 3, yellow 2, blue 3, green 3\)/);
  });

  it.each([
    ["an unknown player", { heatsCsv: heatsCsv.replace("P1,P2", "Nobody,P2") }, /"Nobody" isn't in players.csv/],
    ["an unknown game", { heatsCsv: heatsCsv + "\nCornhole,1,P1,P2,P3,P4" }, /no game named "Cornhole"/],
    ["a game with no heats", { heatsCsv: heatsCsv.split("\n").slice(0, 3).join("\n") }, /Hot Potato Tag: no rows/],
    ["a missing heat number", { heatsCsv: heatsCsv.replace("Balloon Bobble,2", "Balloon Bobble,3") }, /numbered 1, 2, 3/],
    ["a repeated heat number", { heatsCsv: heatsCsv.replace("Balloon Bobble,2", "Balloon Bobble,1") }, /heat 1 appears twice/],
    ["a missing color", { heatsCsv: heatsCsv.replace("P1,P2,P3,P4", "P1,P2,P3,") }, /no green competitor/],
    ["someone competing twice in a game", { heatsCsv: heatsCsv.replace("P5,P6", "P1,P6") }, /P1 is listed more than once/],
    ["more than three people on a color", { heatsCsv: heatsCsv.replace("P9;P10;P11,P12", "P9;P10;P11;P21,P12") }, /red has 4 people; the most per color is 3/],
    ["no players", { playersCsv: "name\n" }, /players.csv has no players/],
    ["no games", { eventsCsv: "position,name,description\n", heatsCsv: "event,heat,red,yellow,blue,green\n" }, /events.csv has no games/],
    ["completely empty files", { playersCsv: "", eventsCsv: "", heatsCsv: "" }, /no players[\s\S]*no games/],
    ["a duplicate position", { eventsCsv: eventsCsv.replace("2,Hot", "1,Hot") }, /position 1 is used twice/],
  ])("rejects %s", (_label, overrides, message) => {
    const { party, errors } = build(overrides);
    expect(party).toBeNull();
    expect(errors.join("\n")).toMatch(message);
  });
});
