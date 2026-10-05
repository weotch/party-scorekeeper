# Plan: heats and multi-person teams

Status: **Proposal**. It needs your answers to the questions in section 9
before we build. Written Oct 5, 2026. The party is Oct 11 and the code freeze
is Oct 9.

## 1. What's changing

Two rule changes:

1. A game can have several **heats**. Each heat is its own ranking of the four
   color teams, with one competitor per color by default. Balloon Bobble runs
   2 heats, so 8 people play across the game.
2. A team can field **more than one person in a heat**. Hot Potato Tag is 1
   heat with 12 people, 3 per color.

We are also adding the 12 real game names and their descriptions, which show
on the event screen so whoever runs a game has the rules in front of them.

Unchanged: supporters, the 5/3/2/1 points table, ties (places below a tie move
up), Team A/B bonus games, the shared password, tap-to-save with rollback, and
the leaderboard.

## 2. Scoring rule (proposed)

- A heat ranks the four colors 1st to 4th using the game's points table.
  Ties work exactly as they do now.
- A team's score for a game is the **sum of its points across the game's
  heats**.
- Everyone on that color for that game gets the team's score: competitors from
  any heat and every supporter. This is today's rule, with "event" meaning the
  whole game.
- A one-heat game scores exactly as it does today, however many people per
  team play.

Worked example, Balloon Bobble with 2 heats:

| Team | Heat 1 | Heat 2 | Game score (everyone on the team) |
| --- | --- | --- | --- |
| Red | 1st (5) | 3rd (2) | 7 |
| Yellow | 4th (1) | 2nd (3) | 4 |
| Blue | 2nd (3) | 1st (5) | 8 |
| Green | 3rd (2) | 4th (1) | 3 |

Two consequences to be aware of:

- **A two-heat game is worth up to 10 points per person, versus 5 for a
  one-heat game.** If you would rather every game count the same, multi-heat
  games can use a smaller per-heat table (for example 2.5/1.5/1/0.5). That
  means letting the points column hold decimals, so we would only do it if you
  want it.
- **Hot Potato Tag is elimination, but the app only records the final order of
  the four teams.** How you turn eliminations into team places (for example,
  the order in which each team's last player went out) is up to you at the
  event.

An alternative scoring model is described in section 10.

## 3. Data model

Results move from `event_teams.place` to a new per-heat table. A competitor
now records which heat they play in. Supporters stay tied to a color for the
whole game, not to a heat.

Migration 1 (additive, safe while production still runs the old code):

```sql
alter table events add column description text;

create table heats (
  event_id uuid not null references events(id) on delete cascade,
  number   int  not null check (number >= 1),
  primary key (event_id, number)
);

-- One row per team per heat. Replaces event_teams.place.
create table heat_results (
  event_id uuid not null,
  heat     int  not null,
  team     team_key not null,
  place    int check (place >= 1),
  primary key (event_id, heat, team),
  foreign key (event_id, heat) references heats (event_id, number) on delete cascade,
  foreign key (event_id, team) references event_teams (event_id, team) on delete cascade
);

-- Competitors record their heat; supporters leave it null.
alter table event_members add column heat int;
alter table event_members
  add foreign key (event_id, heat) references heats (event_id, number);

-- Backfill: every existing event becomes a one-heat event
insert into heats (event_id, number) select id, 1 from events;
insert into heat_results (event_id, heat, team, place)
  select event_id, 1, team, place from event_teams;
update event_members set heat = 1 where role = 'competitor';

alter table event_members add constraint competitor_has_heat
  check ((role = 'competitor') = (heat is not null));

-- Several competitors per team are now allowed
drop index one_competitor_per_team;

alter table heats        enable row level security;
alter table heat_results enable row level security;
```

Migration 2 (after the new code is live):

```sql
alter table event_teams drop column place;
```

Notes:

- `points` stays on `events` and now means points per heat.
- A game is complete when every `heat_results` row has a place.
- Bonus games get one heat with teams `a` and `b` and no competitors.
- A player can compete in at most one heat of a game (the existing primary key
  on `event_members` already enforces this).

## 4. Code changes

| File | Change |
| --- | --- |
| `app/lib/scoring.ts` | `computeStandings` takes heat results and sums a team's heat points per game. Gap checking stays per heat. |
| `app/lib/assign.ts` | New `dealEvent` that accepts competitors per heat and per color. Supporters are dealt starting from each team's competitor count, so total team sizes stay within 1 of each other. Bonus dealing is unchanged. |
| `app/lib/data.server.ts` | `getHeatResults`, competitors grouped by heat and team, `setPlace(eventId, heat, team, place)`, and `description` on events. |
| `app/routes/event.tsx` | Heat switcher, per-heat team cards, new fetcher key (see section 6). |
| `app/routes/home.tsx` | Redirect to the first incomplete heat, for example `/events/5?heat=2`. |
| `app/routes/leaderboard.tsx` | Use heat results. The "events scored" count only counts games with every heat done. |
| `scripts/import.ts` | New CSV format and validation (section 5). |
| `CLAUDE.md`, `docs/SPEC.md` | Updated to match. |

## 5. CSV format

`data/events.csv` loses the four competitor columns and gains a description
and an optional points override:

```
position,name,kind,description,points
1,Balloon Bobble,standard,"Keep a balloon aloft, but you lose the use of a limb as time elapses.",
2,Hot Potato Tag,standard,"Tag where the ""it"" player is eliminated when time is up until only one remains.",
```

`kind` is `standard` or `bonus`. `points` is optional (`5;3;2;1`), defaulting
by kind as today.

New `data/heats.csv` has one row per heat. Each color cell holds one or more
names separated by `;`:

```
event,heat,red,yellow,blue,green
Balloon Bobble,1,Avery,Blake,Casey,Dakota
Balloon Bobble,2,Emerson,Finley,Gray,Harper
Hot Potato Tag,1,Indigo;Jordan;Kai,Logan;Morgan;Noel,Oakley;Parker;Quinn,Reese;Sage;Taylor
```

Heats reference the game by **name**, so you can reorder `events.csv` freely.
Bonus games have no heat rows; everyone is dealt to Team A or B.

The import script already stops on typos. It will also check that:

- Every heat's event exists, and event names are unique.
- Heat numbers run 1, 2, 3 with no gaps.
- Every color has at least one competitor in every heat (a warning, not an
  error, if the counts differ between colors in a heat).
- Nobody competes twice in the same game.
- Every standard game has at least one heat.

Its summary keeps printing team sizes per game and how many games each player
competes in, so you can check the lineup is fair.

## 6. Screens

The event screen keeps its shape. New pieces:

```
‹    EVENT 1 OF 12    ›
     Balloon Bobble
Keep a balloon aloft, but you
lose the use of a limb as time
elapses.

 [ Heat 1 ✓ ] [ Heat 2 ]        <- only when the game has 2+ heats

 Red                       +5
 Avery
 [1st] [2nd] [3rd] [4th]
 ...
```

- **Heat switcher** appears only for multi-heat games. A check mark shows a
  finished heat. The screen opens on the first unfinished heat.
- **Team cards** list every competitor in that heat, comma separated. Three
  names per card wrap to two lines at most on a phone.
- **Saving** works as now. The fetcher key becomes
  `place:<eventId>:<heat>:<team>` and the form sends the heat, so each heat's
  buttons save and roll back independently.
- **Gap warning** is checked per heat.
- **Game total**: for multi-heat games, a small line under the cards shows
  each color's running total for the game.
- **URL**: `/events/5?heat=2`. The arrows still move between games.

## 7. Rollout

1. Apply migration 1 to Supabase. The current production code ignores the new
   tables and columns, so nothing breaks.
2. Open a PR with the code. CI runs and Vercel builds a preview. Preview
   builds use the **same database** as production, so scores entered while
   testing are real rows until we clear them.
3. You try the preview on your phone, then merge.
4. Apply migration 2.
5. Once you have the final roster and lineups, run the import with `--force`.
   That replaces the placeholder data and test scores. After you print the
   sheets, assignments are frozen.

## 8. Testing

- Unit tests: multi-heat sums, ties inside a heat, a 3-per-team single heat,
  incomplete games, unequal competitor counts balancing team sizes, and the
  new CSV validation.
- Browser run against a fake database: a 2-heat game, switching heats,
  optimistic saves and a simulated failed save per heat, a 3-per-team card, the
  home redirect landing on heat 2, and leaderboard totals.
- `CLAUDE.md` mentions a fake database server for testing that is not in the
  repo yet. Since this change reshapes the tables, I will commit it as
  `scripts/fake-db.ts` so future sessions can run the same checks.

## 9. Questions

1. **Scoring model.** Do you want the shared color score from section 2
   (recommended), or per-heat groups where each supporter backs one specific
   competitor (section 10)?
2. **Game weight.** Is it fine that a two-heat game is worth up to 10 points
   per person (recommended for simplicity), or should every game be worth the
   same?
3. **Balloon Hustle** says "choose a partner". If partners are picked on the
   spot, the app treats it as one competitor per team and does not track the
   partner. If you pre-assign pairs, list two names per color in the heat; that
   works with no extra changes.
4. **Bonus games.** Are the full-group Team A vs Team B games still planned?
   They were not in your list. If so, what are they called?
5. **Order.** Should the list you sent be the running order?

What I need to load real data: the final roster, and for each game how many
heats it has, how many people per color play in each heat, and who they are.
Unless you say otherwise I will assume one heat with one person per color.

## 10. Alternative: per-heat groups

Instead of one score per color, each heat is a self-contained group. Every
person, supporters included, belongs to exactly one (heat, color) group for the
game and earns that heat's points. Nothing is summed, so every game is worth at
most 5 per person.

What would differ:

- `event_members.heat` is set for supporters too, and results are looked up by
  the member's own heat.
- Supporters are dealt across 8 groups in a 2-heat game, so groups are smaller.
- Your printed sheet needs one column per (heat, color) instead of one per
  color.
- Supporters only have something at stake during their own heat. In the shared
  model, everyone on a color cares about every heat.

I recommend the shared color score. It keeps your 4-column printed sheet, keeps
everyone invested in every heat, and matches how you described the colors.

## 11. Schedule

| Dates | Work |
| --- | --- |
| Oct 5 to 6 | Answer the questions. I build and open the PR. |
| Oct 6 to 7 | You send the roster and lineups. I import them. You print sheets. |
| Oct 7 to 8 | Dry run with your helpers on their phones. Fixes. |
| Oct 9 | Code freeze. Only fixes after this. |

The roster and lineups are what gate printing. The app work is not.
