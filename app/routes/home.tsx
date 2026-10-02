import { Form } from "react-router";
import { requireOfficial } from "~/lib/session.server";
import { db } from "~/lib/supabase.server";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [{ title: "Party Scorekeeper" }];

// Placeholder until the event view and leaderboard are built. Confirms the
// app can reach the database.
export async function loader({ request }: Route.LoaderArgs) {
  await requireOfficial(request);
  const [players, events] = await Promise.all([
    db().from("players").select("*", { count: "exact", head: true }),
    db().from("events").select("*", { count: "exact", head: true }),
  ]);
  const error = players.error ?? events.error;
  if (error) throw new Error(`Database error: ${error.message || error.code}`);
  return { players: players.count ?? 0, events: events.count ?? 0 };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="flex flex-col gap-4 pt-10">
      <h1 className="text-2xl font-bold">Party Scorekeeper</h1>
      <p>
        Connected to the database: {loaderData.players} players and {loaderData.events} events
        loaded.
      </p>
      <Form method="post" action="/logout">
        <button type="submit" className="text-sm underline">
          Sign out
        </button>
      </Form>
    </main>
  );
}
