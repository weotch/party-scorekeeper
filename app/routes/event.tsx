import {
  data,
  Link,
  redirect,
  useFetcher,
  useFetchers,
  useSearchParams,
} from "react-router";
import {
  getEvents,
  getHeatCompetitors,
  getHeatResults,
  setPlace,
} from "~/lib/data.server";
import {
  buildHeats,
  gameTotals,
  hasPlaceGap,
  isHeatComplete,
  nextHeatToScore,
  pointsForPlace,
  TEAMS,
  type TeamKey,
} from "~/lib/scoring";
import { skipOnSearchOnlyChange } from "~/lib/revalidate";
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

  const [results, competitors] = await Promise.all([
    getHeatResults(event.id),
    getHeatCompetitors(event.id),
  ]);
  const heats = buildHeats(results, competitors);
  if (heats.length === 0) throw new Error(`${event.name} has no heats. Re-run the import.`);

  // Pin the heat in the URL for multi-heat games, so finishing one heat doesn't
  // make the screen jump to the next.
  const requested = Number(new URL(request.url).searchParams.get("heat"));
  if (heats.length > 1 && !heats.some((h) => h.number === requested)) {
    throw redirect(`/events/${event.position}?heat=${nextHeatToScore(heats)}`);
  }

  return {
    event: { id: event.id, name: event.name, description: event.description, points: event.points },
    number: index + 1,
    total: events.length,
    prev: events[index - 1]?.position ?? null,
    next: events[index + 1]?.position ?? null,
    heats,
  };
}

/** Switching heats only changes the query string, and the loader already returned every heat. */
export const shouldRevalidate = skipOnSearchOnlyChange;

export async function action({ request, params }: Route.ActionArgs) {
  await requireOfficial(request);
  const form = await request.formData();
  const team = String(form.get("team")) as TeamKey;
  const heat = Number(form.get("heat"));
  const rawPlace = String(form.get("place") ?? "");
  const place = rawPlace === "" ? null : Number(rawPlace);
  const validPlace = place === null || (Number.isInteger(place) && place >= 1 && place <= TEAMS.length);
  if (!TEAMS.includes(team) || !Number.isInteger(heat) || heat < 1 || !validPlace) {
    return data({ error: "Invalid place" }, { status: 400 });
  }

  const event = (await getEvents()).find((e) => e.position === Number(params.position));
  if (!event) return data({ error: "Event not found" }, { status: 404 });

  try {
    await setPlace(event.id, heat, team, place);
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

const fetcherKey = (eventId: string, heat: number, team: TeamKey) =>
  `place:${eventId}:${heat}:${team}`;

export default function EventPage({ loaderData }: Route.ComponentProps) {
  const { event, number, total, prev, next } = loaderData;
  const [searchParams] = useSearchParams();

  // Optimistic places: an in-flight save wins over the last loaded value. When
  // the save settles, the reloaded data takes over, so a failed save rolls back.
  const pending = new Map<string, string>();
  for (const f of useFetchers()) {
    if (f.formData && f.key.startsWith(`place:${event.id}:`)) {
      pending.set(`${f.formData.get("heat")}:${f.formData.get("team")}`, String(f.formData.get("place")));
    }
  }
  const heats = loaderData.heats.map((heat) => ({
    ...heat,
    places: Object.fromEntries(
      TEAMS.map((team) => {
        const p = pending.get(`${heat.number}:${team}`);
        return [team, p === undefined ? heat.places[team] : p === "" ? null : Number(p)];
      }),
    ) as Record<TeamKey, number | null>,
  }));

  const requested = Number(searchParams.get("heat"));
  const current = heats.find((h) => h.number === requested) ?? heats[0];
  const gap = hasPlaceGap(TEAMS.map((t) => current.places[t]));
  const totals = gameTotals(event.points, heats);

  return (
    <main className="flex flex-col gap-4 pt-4">
      <header className="flex items-center gap-2">
        <NavArrow to={prev} label="Previous game" direction="prev" />
        <div className="flex-1 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Game {number} of {total}
          </p>
          <h1 className="text-2xl font-bold leading-tight">{event.name}</h1>
        </div>
        <NavArrow to={next} label="Next game" direction="next" />
      </header>

      {event.description && (
        <p className="text-center text-sm text-gray-500">{event.description}</p>
      )}

      {heats.length > 1 && (
        <nav
          aria-label="Heats"
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${heats.length}, minmax(0, 1fr))` }}
        >
          {heats.map((heat) => {
            const active = heat.number === current.number;
            return (
              <Link
                key={heat.number}
                to={{ search: `?heat=${heat.number}` }}
                replace
                preventScrollReset
                aria-current={active ? "true" : undefined}
                className={`rounded-lg py-3 text-center text-base font-semibold ${
                  active
                    ? "bg-gray-900 text-white dark:bg-white dark:text-gray-950"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                }`}
              >
                Heat {heat.number}
                {isHeatComplete(heat) && <span aria-label="complete"> ✓</span>}
              </Link>
            );
          })}
        </nav>
      )}

      <ul className="flex flex-col gap-3">
        {TEAMS.map((team) => (
          <TeamRow
            key={`${event.id}:${current.number}:${team}`}
            eventId={event.id}
            heat={current.number}
            team={team}
            competitors={current.competitors[team]}
            place={current.places[team]}
            points={pointsForPlace(event.points, current.places[team])}
          />
        ))}
      </ul>

      {gap && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Heads up: a place is skipped. After a tie, the next team should take the next place
          (for example 1st, 1st, 2nd).
        </p>
      )}

      {heats.length > 1 && (
        <section
          aria-label="Game total"
          className="rounded-xl bg-gray-100 px-4 py-3 dark:bg-gray-900"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Game total across heats
          </p>
          <ul className="mt-2 grid grid-cols-4 gap-2">
            {TEAMS.map((team) => (
              <li key={team} className="flex items-center justify-center gap-2">
                <span className={`h-3 w-3 rounded-full ${TEAM_STYLES[team].swatch}`} aria-hidden />
                <span className="sr-only">{TEAM_STYLES[team].label}</span>
                <span className="text-lg font-bold tabular-nums">{totals[team]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function TeamRow({
  eventId,
  heat,
  team,
  competitors,
  place,
  points,
}: {
  eventId: string;
  heat: number;
  team: TeamKey;
  competitors: string[];
  place: number | null;
  points: number;
}) {
  const fetcher = useFetcher<typeof clientAction>({ key: fetcherKey(eventId, heat, team) });
  const style = TEAM_STYLES[team];
  const error = fetcher.state === "idle" ? fetcher.data?.error : undefined;

  return (
    <li className={`rounded-xl border-2 ${style.ring} p-3`}>
      <div className="mb-3 flex items-center gap-3">
        <span className={`h-8 w-8 shrink-0 rounded-full ${style.swatch}`} aria-hidden />
        <div className="min-w-0 flex-1">
          {competitors.length > 0 ? (
            <>
              <p className="text-lg font-semibold leading-tight">{competitors.join(", ")}</p>
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

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${TEAMS.length}, minmax(0, 1fr))` }}>
        {TEAMS.map((_, i) => i + 1).map((n) => {
          const selected = place === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                fetcher.submit(
                  // Tapping the selected place again clears it
                  { team, heat: String(heat), place: selected ? "" : String(n) },
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
