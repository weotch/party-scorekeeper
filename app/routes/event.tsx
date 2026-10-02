import { data, Link, useFetcher, useFetchers } from "react-router";
import { getCompetitors, getEvents, getTeams, setPlace } from "~/lib/data.server";
import { hasPlaceGap, pointsForPlace, teamsForKind, type TeamKey } from "~/lib/scoring";
import { requireOfficial } from "~/lib/session.server";
import { ordinal, TEAM_STYLES } from "~/lib/teams";
import type { Route } from "./+types/event";

export const meta: Route.MetaFunction = ({ data }) => [
  { title: data ? `${data.event.name} · Party Scorekeeper` : "Party Scorekeeper" },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOfficial(request);
  const events = await getEvents();
  const index = events.findIndex((e) => e.position === Number(params.position));
  if (index === -1) throw data("Event not found", { status: 404 });
  const event = events[index];

  const [teams, competitors] = await Promise.all([getTeams(event.id), getCompetitors(event.id)]);
  const places = Object.fromEntries(teams.map((t) => [t.team, t.place]));

  return {
    event,
    number: index + 1,
    total: events.length,
    prev: events[index - 1]?.position ?? null,
    next: events[index + 1]?.position ?? null,
    rows: teamsForKind(event.kind).map((team) => ({
      team,
      competitor: competitors[team] ?? null,
      place: places[team] ?? null,
    })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOfficial(request);
  const form = await request.formData();
  const events = await getEvents();
  const event = events.find((e) => e.position === Number(params.position));
  if (!event) return data({ error: "Event not found" }, { status: 404 });

  const teams = teamsForKind(event.kind);
  const team = String(form.get("team")) as TeamKey;
  const rawPlace = String(form.get("place") ?? "");
  const place = rawPlace === "" ? null : Number(rawPlace);
  if (!teams.includes(team) || (place !== null && !(place >= 1 && place <= teams.length))) {
    return data({ error: "Invalid place" }, { status: 400 });
  }

  try {
    await setPlace(event.id, team, place);
  } catch (error) {
    console.error(error);
    return data({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  return { error: null };
}

/**
 * Runs in the browser so a dropped connection becomes an error message on the
 * row (and the row rolls back) instead of an error page.
 */
export async function clientAction({ serverAction }: Route.ClientActionArgs) {
  try {
    return await serverAction();
  } catch (error) {
    if (error instanceof Response) throw error; // e.g. redirect to /login
    return { error: "Couldn't save. Check your connection and try again." };
  }
}

const fetcherKey = (eventId: string, team: TeamKey) => `place:${eventId}:${team}`;

export default function EventPage({ loaderData }: Route.ComponentProps) {
  const { event, number, total, prev, next, rows } = loaderData;

  // Optimistic places: an in-flight save wins over the last loaded value. When
  // the save settles, the reloaded data takes over, so a failed save rolls back.
  const pending = new Map(
    useFetchers()
      .filter((f) => f.formData && f.key.startsWith(`place:${event.id}:`))
      .map((f) => [f.formData!.get("team") as TeamKey, f.formData!.get("place") as string]),
  );
  const shownRows = rows.map((row) => {
    const p = pending.get(row.team);
    return { ...row, place: p === undefined ? row.place : p === "" ? null : Number(p) };
  });
  const gap = hasPlaceGap(shownRows.map((r) => r.place));

  return (
    <main className="flex flex-col gap-4 pt-4">
      <header className="flex items-center gap-2">
        <NavArrow to={prev} label="Previous event" direction="prev" />
        <div className="flex-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Event {number} of {total}
            {event.kind === "bonus" && " · Bonus"}
          </p>
          <h1 className="text-2xl font-bold leading-tight">{event.name}</h1>
        </div>
        <NavArrow to={next} label="Next event" direction="next" />
      </header>

      {event.kind === "bonus" && (
        <p className="text-center text-sm text-gray-500">Everyone on the winning team gets 5 points.</p>
      )}

      <ul className="flex flex-col gap-3">
        {shownRows.map((row) => (
          <TeamRow
            key={row.team}
            eventId={event.id}
            team={row.team}
            competitor={row.competitor}
            place={row.place}
            placeCount={rows.length}
            points={pointsForPlace(event.points, row.place)}
          />
        ))}
      </ul>

      {gap && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Heads up: a place is skipped. After a tie, the next team should take the next place
          (for example 1st, 1st, 2nd).
        </p>
      )}
    </main>
  );
}

function TeamRow({
  eventId,
  team,
  competitor,
  place,
  placeCount,
  points,
}: {
  eventId: string;
  team: TeamKey;
  competitor: string | null;
  place: number | null;
  placeCount: number;
  points: number;
}) {
  const fetcher = useFetcher<typeof clientAction>({ key: fetcherKey(eventId, team) });
  const style = TEAM_STYLES[team];
  const error = fetcher.state === "idle" ? fetcher.data?.error : undefined;

  return (
    <li className={`rounded-xl border-2 ${style.ring} p-3`}>
      <div className="mb-3 flex items-center gap-3">
        <span className={`h-8 w-8 shrink-0 rounded-full ${style.swatch}`} aria-hidden />
        <div className="min-w-0 flex-1">
          {competitor ? (
            <>
              <p className="truncate text-lg font-semibold leading-tight">{competitor}</p>
              <p className="text-xs text-gray-500">{style.label}</p>
            </>
          ) : (
            <p className="text-lg font-semibold">{style.label}</p>
          )}
        </div>
        {place !== null && (
          <span className="text-sm font-semibold tabular-nums text-gray-600 dark:text-gray-300">
            +{points}
          </span>
        )}
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${placeCount}, minmax(0, 1fr))` }}>
        {Array.from({ length: placeCount }, (_, i) => i + 1).map((n) => {
          const selected = place === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                fetcher.submit(
                  // Tapping the selected place again clears it
                  { team, place: selected ? "" : String(n) },
                  { method: "post" },
                )
              }
              className={`rounded-lg py-3 text-base font-semibold transition-colors ${
                selected
                  ? style.selected
                  : "bg-gray-100 text-gray-800 active:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:active:bg-gray-700"
              }`}
            >
              {ordinal(n)}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  );
}

function NavArrow({ to, label, direction }: { to: number | null; label: string; direction: "prev" | "next" }) {
  const className = "flex h-12 w-12 items-center justify-center rounded-full text-2xl";
  const arrow = direction === "prev" ? "‹" : "›";
  if (to === null) {
    return (
      <span className={`${className} text-gray-300 dark:text-gray-700`} aria-hidden>
        {arrow}
      </span>
    );
  }
  return (
    <Link
      to={`/events/${to}`}
      aria-label={label}
      className={`${className} bg-gray-100 active:bg-gray-200 dark:bg-gray-800 dark:active:bg-gray-700`}
    >
      {arrow}
    </Link>
  );
}
