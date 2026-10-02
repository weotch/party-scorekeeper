import { db } from "./supabase.server";
import type { EventKind, Role, TeamKey } from "./scoring";

export interface EventRow {
  id: string;
  position: number;
  name: string;
  kind: EventKind;
  points: number[];
}
export interface TeamRow {
  event_id: string;
  team: TeamKey;
  place: number | null;
}
export interface MemberRow {
  event_id: string;
  player_id: string;
  team: TeamKey;
  role: Role;
}
export interface PlayerRow {
  id: string;
  name: string;
}

/** Unwraps a Supabase result, turning errors into real Errors for the error boundary. */
function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throw new Error(`Database error: ${result.error.message || result.error.code}`);
  return result.data as T;
}

export async function getEvents(): Promise<EventRow[]> {
  return unwrap(
    await db().from("events").select("id, position, name, kind, points").order("position"),
  );
}

export async function getTeams(eventId?: string): Promise<TeamRow[]> {
  let query = db().from("event_teams").select("event_id, team, place");
  if (eventId) query = query.eq("event_id", eventId);
  return unwrap(await query);
}

export async function getMembers(): Promise<MemberRow[]> {
  // Explicit range: PostgREST caps responses at 1000 rows by default.
  return unwrap(
    await db().from("event_members").select("event_id, player_id, team, role").range(0, 9999),
  );
}

export async function getPlayers(): Promise<PlayerRow[]> {
  return unwrap(await db().from("players").select("id, name"));
}

/** Competitor names for an event, keyed by team. */
export async function getCompetitors(eventId: string): Promise<Partial<Record<TeamKey, string>>> {
  const rows = unwrap(
    await db()
      .from("event_members")
      .select("team, players(name)")
      .eq("event_id", eventId)
      .eq("role", "competitor"),
  ) as unknown as { team: TeamKey; players: { name: string } | null }[];
  return Object.fromEntries(rows.map((r) => [r.team, r.players?.name ?? ""]));
}

export async function setPlace(eventId: string, team: TeamKey, place: number | null) {
  const updated = unwrap(
    await db()
      .from("event_teams")
      .update({ place })
      .eq("event_id", eventId)
      .eq("team", team)
      .select("team"),
  );
  if (updated.length !== 1) throw new Error(`No ${team} team found for this event`);
}
