/** Minimal CSV parsing: comma separated, optional double quotes, first row is the header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) =>
      [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)]
        .slice(0, -1)
        .map(([, cell]) => cell.trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"').trim()),
    );
  const [header, ...body] = rows;
  return body.map((cells) =>
    Object.fromEntries(header.map((key, i) => [key.trim().toLowerCase(), cells[i] ?? ""])),
  );
}
