import type { TeamKey } from "./scoring";

/** Display name and Tailwind classes for each team. Kept as full class strings so Tailwind can see them. */
export const TEAM_STYLES: Record<
  TeamKey,
  { label: string; swatch: string; selected: string; ring: string }
> = {
  red: { label: "Red", swatch: "bg-red-600", selected: "bg-red-600 text-white", ring: "border-red-600" },
  yellow: {
    label: "Yellow",
    swatch: "bg-yellow-400",
    selected: "bg-yellow-400 text-gray-950",
    ring: "border-yellow-400",
  },
  blue: { label: "Blue", swatch: "bg-blue-600", selected: "bg-blue-600 text-white", ring: "border-blue-600" },
  green: {
    label: "Green",
    swatch: "bg-green-600",
    selected: "bg-green-600 text-white",
    ring: "border-green-600",
  },
  a: { label: "Team A", swatch: "bg-gray-900 dark:bg-gray-100", selected: "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-950", ring: "border-gray-900 dark:border-gray-100" },
  b: { label: "Team B", swatch: "bg-gray-500", selected: "bg-gray-500 text-white", ring: "border-gray-500" },
};

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${n}${suffixes[n % 10] ?? "th"}`;
}
