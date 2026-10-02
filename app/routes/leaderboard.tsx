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
        <h1 className="font-display text-2xl font-black uppercase tracking-widest text-neon-pink glitch">Leaderboard</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-dim">
          // {completed} of {total} events scored
        </p>
      </header>

      <ol className="clip-corner flex flex-col divide-y divide-line border border-line bg-panel/85 px-3 backdrop-blur-sm">
        {standings.map((s, i) => {
          const tied = standings[i - 1]?.rank === s.rank || standings[i + 1]?.rank === s.rank;
          return (
            <li key={s.playerId} className="flex items-center gap-3 py-3">
              <span
                className={`w-10 text-right font-mono text-sm tabular-nums ${
                  s.rank === 1 ? "text-neon-yellow text-glow" : "text-dim"
                }`}
              >
                {tied ? `T${s.rank}` : s.rank}
              </span>
              <span className="flex-1 truncate text-xl font-semibold">{s.name}</span>
              <span className="font-mono text-xl tabular-nums text-neon-cyan text-glow">{s.total}</span>
            </li>
          );
        })}
      </ol>

      <Form method="post" action="/logout" className="pt-4 text-center">
        <button type="submit" className="font-mono text-sm uppercase tracking-widest text-dim underline">
          Jack out
        </button>
      </Form>
    </main>
  );
}
