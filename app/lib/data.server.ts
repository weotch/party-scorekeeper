import { db } from "./supabase.server";
import type { ScoringMember, ScoringPlayer, ScoringResult, TeamKey } from "./scoring";

export interface EventRow {
  id: string;
  position: number;
  name: string;
  description: string | null;
  points: number[];
}

/** Unwraps a Supabase result, turning errors into real Errors for the error boundary. */
function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throw new Error(`Database error: ${result.error.message || result.error.code}`);
  return result.data as T;
}

export async function getEvents(): Promise<EventRow[]> {
  return unwrap(
    await db().from("events").select("id, position, name, description, points").order("position"),
  );
}

/** Every heat's places, for one game or all of them. */
export async function getHeatResults(eventId?: string): Promise<ScoringResult[]> {
  let query = db().from("heat_results").select("event_id, heat, team, place");
  if (eventId) query = query.eq("event_id", eventId);
  return unwrap(await query);
}

export async function getMembers(): Promise<ScoringMember[]> {
  // Explicit range: PostgREST caps responses at 1000 rows by default.
  return unwrap(
    await db().from("event_members").select("event_id, player_id, team").range(0, 9999),
  );
}

export async function getPlayers(): Promise<ScoringPlayer[]> {
  return unwrap(await db().from("players").select("id, name"));
}

/** Who competes for each team in each heat of a game. */
export async function getHeatCompetitors(
  eventId: string,
): Promise<{ heat: number; team: TeamKey; name: string }[]> {
  const rows = unwrap(
    await db()
      .from("event_members")
      .select("heat, team, players(name)")
      .eq("event_id", eventId)
      .eq("role", "competitor"),
  ) as unknown as { heat: number; team: TeamKey; players: { name: string } | null }[];
  return rows.map((r) => ({ heat: r.heat, team: r.team, name: r.players?.name ?? "" }));
}

export async function setPlace(eventId: string, heat: number, team: TeamKey, place: number | null) {
  const updated = unwrap(
    await db()
      .from("heat_results")
      .update({ place })
      .eq("event_id", eventId)
      .eq("heat", heat)
      .eq("team", team)
      .select("team"),
  );
  if (updated.length !== 1) throw new Error(`No ${team} team in heat ${heat} of this game`);
}
