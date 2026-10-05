import { redirect } from "react-router";
import { getEvents, getHeatResults } from "~/lib/data.server";
import { requireOfficial } from "~/lib/session.server";
import type { Route } from "./+types/home";

/** Sends officials to the first heat that still needs a result (or the last game when all are scored). */
export async function loader({ request }: Route.LoaderArgs) {
  await requireOfficial(request);
  const [events, results] = await Promise.all([getEvents(), getHeatResults()]);
  if (events.length === 0) throw new Error("No events yet. Import the party data first.");

  for (const event of events) {
    const open = results.filter((r) => r.event_id === event.id && r.place === null).map((r) => r.heat);
    if (open.length > 0) throw redirect(`/events/${event.position}?heat=${Math.min(...open)}`);
  }
  throw redirect(`/events/${events.at(-1)!.position}`);
}
