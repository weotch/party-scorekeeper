import { redirect } from "react-router";
import { getEvents, getTeams } from "~/lib/data.server";
import { requireOfficial } from "~/lib/session.server";
import type { Route } from "./+types/home";

/** Sends officials to the first event that isn't fully scored (or the last event). */
export async function loader({ request }: Route.LoaderArgs) {
  await requireOfficial(request);
  const [events, teams] = await Promise.all([getEvents(), getTeams()]);
  if (events.length === 0) throw new Error("No events yet. Import the party data first.");
  const current =
    events.find((e) => teams.some((t) => t.event_id === e.id && t.place === null)) ?? events.at(-1)!;
  throw redirect(`/events/${current.position}`);
}
