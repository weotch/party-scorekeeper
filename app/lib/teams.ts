import type { TeamKey } from "./scoring";

/** Display name and Tailwind classes for each team. Kept as full class strings so Tailwind can see them. */
export const TEAM_STYLES: Record<
  TeamKey,
  { label: string; swatch: string; selected: string; ring: string }
> = {
  red: {
    label: "Red",
    swatch: "bg-neon-red shadow-[0_0_12px_var(--color-neon-red)]",
    selected: "bg-neon-red text-void shadow-[0_0_16px_var(--color-neon-red)]",
    ring: "border-neon-red/70 shadow-[0_0_14px_rgb(255_59_92/0.25)]",
  },
  yellow: {
    label: "Yellow",
    swatch: "bg-neon-yellow shadow-[0_0_12px_var(--color-neon-yellow)]",
    selected: "bg-neon-yellow text-void shadow-[0_0_16px_var(--color-neon-yellow)]",
    ring: "border-neon-yellow/70 shadow-[0_0_14px_rgb(252_238_10/0.2)]",
  },
  blue: {
    label: "Blue",
    swatch: "bg-neon-blue shadow-[0_0_12px_var(--color-neon-blue)]",
    selected: "bg-neon-blue text-white shadow-[0_0_16px_var(--color-neon-blue)]",
    ring: "border-neon-blue/70 shadow-[0_0_14px_rgb(61_123_255/0.25)]",
  },
  green: {
    label: "Green",
    swatch: "bg-neon-green shadow-[0_0_12px_var(--color-neon-green)]",
    selected: "bg-neon-green text-void shadow-[0_0_16px_var(--color-neon-green)]",
    ring: "border-neon-green/70 shadow-[0_0_14px_rgb(57_255_143/0.2)]",
  },
  a: {
    label: "Team A",
    swatch: "bg-neon-cyan shadow-[0_0_12px_var(--color-neon-cyan)]",
    selected: "bg-neon-cyan text-void shadow-[0_0_16px_var(--color-neon-cyan)]",
    ring: "border-neon-cyan/70 shadow-[0_0_14px_rgb(0_240_255/0.2)]",
  },
  b: {
    label: "Team B",
    swatch: "bg-neon-pink shadow-[0_0_12px_var(--color-neon-pink)]",
    selected: "bg-neon-pink text-void shadow-[0_0_16px_var(--color-neon-pink)]",
    ring: "border-neon-pink/70 shadow-[0_0_14px_rgb(255_43_214/0.2)]",
  },
};

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${n}${suffixes[n % 10] ?? "th"}`;
}
