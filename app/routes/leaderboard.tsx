import { Form } from "react-router";
import { getEvents, getMembers, getPlayers, getTeams } from "~/lib/data.server";
import { computeStandings } from "~/lib/scoring";
import { requireOfficial } from "~/lib/session.server";
import type { Route } from "./+types/leaderboard";

export const meta: Route.MetaFunction = () => [{ title: "Leaderboard · Party Scorekeeper" }];

export async function loader({ request }: Route.LoaderArgs) {
  await requireOfficial(request);
  const [players, events, teams, members] = await Promise.all([
    getPlayers(),
    getEvents(),
    getTeams(),
    getMembers(),
  ]);
  const completed = events.filter((e) =>
    teams.filter((t) => t.event_id === e.id).every((t) => t.place !== null),
  ).length;
  return {
    standings: computeStandings(players, events, teams, members),
    completed,
    total: events.length,
  };
}

export default function Leaderboard({ loaderData }: Route.ComponentProps) {
  const { standings, completed, total } = loaderData;
  return (
    <main className="flex flex-col gap-4 pt-4">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-gray-500">
          {completed} of {total} events scored
        </p>
      </header>

      <ol className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
        {standings.map((s, i) => {
          const tied = standings[i - 1]?.rank === s.rank || standings[i + 1]?.rank === s.rank;
          return (
            <li key={s.playerId} className="flex items-center gap-3 py-3">
              <span className="w-10 text-right text-sm font-semibold tabular-nums text-gray-500">
                {tied ? `T${s.rank}` : s.rank}
              </span>
              <span className="flex-1 truncate text-lg">{s.name}</span>
              <span className="text-lg font-bold tabular-nums">{s.total}</span>
            </li>
          );
        })}
      </ol>

      <Form method="post" action="/logout" className="pt-4 text-center">
        <button type="submit" className="text-sm text-gray-500 underline">
          Sign out
        </button>
      </Form>
    </main>
  );
}
