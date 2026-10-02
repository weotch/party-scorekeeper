import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads rows keyed by lowercased header", () => {
    expect(parseCsv("Name,Kind\nAnn,standard\r\nBo,bonus\n")).toEqual([
      { name: "Ann", kind: "standard" },
      { name: "Bo", kind: "bonus" },
    ]);
  });

  it("handles quotes, commas in quotes, blank lines, and missing cells", () => {
    expect(parseCsv('name,red,blue\n"Smith, Jo","Al ""Ace"" B",\n\nCy')).toEqual([
      { name: "Smith, Jo", red: 'Al "Ace" B', blue: "" },
      { name: "Cy", red: "", blue: "" },
    ]);
  });
});
