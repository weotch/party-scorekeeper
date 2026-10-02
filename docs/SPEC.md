# Party Scorekeeper: Project Spec

A mobile-first web app that officials (2 to 3 people) use to run scoring for a
series of birthday party games on **October 11, 2026**. Guests never use the
app; they see their team assignments on printed sheets.

Status: **Draft**. Open questions are listed at the end.

---

## 1. How the party works

- About **20 to 30 players**.
- About **12 standard events** plus **1 or 2 bonus events** at the end, run in a
  fixed order that's decided ahead of time.
- Standard events use 4 team colors, fixed for the whole party: **Red,
  Yellow, Blue, Green**. Colored props match them.
- Every player belongs to exactly one team in every event. No one sits out.

### Standard events (4 teams)

- Each color team has one **competitor**, so 4 competitors per event.
- Every other player is a **supporter** on one of the 4 teams. Supporters are
  spread as evenly as possible (for example, 26 players means 22 supporters, so
  team sizes of 6/6/5/5 including the competitor).
- Points by place: **1st = 5, 2nd = 3, 3rd = 2, 4th = 1**.
- Every member of a team (competitor and supporters) gets that team's points.

### Bonus events (2 teams)

- The whole group is randomly split into **Team A** and **Team B** as evenly
  as possible (assigned in advance, like supporters). No colors and no
  designated competitor.
- The winning team's members each get **5 points**. The losing team gets 0.

### Ties within an event

- Officials can give two or more teams the same place.
- Places below a tie **move up** (dense ranking). There are no gaps; the last
  places just disappear. The official picks those places by hand (the app
  doesn't renumber anything), and points always come straight from the place
  that was picked.
  - Two tied for 1st: places 1, 1, 2, 3, so points 5, 5, 3, 2.
  - Two tied for 2nd: places 1, 2, 2, 3, so points 5, 3, 3, 2.

### Winning

- Each player's total is the sum of their points from every event, whether
  they earned them as a competitor or a supporter.
- Highest total wins. Overall ties are settled outside the app. The app just
  shows tied players at the same rank.

### Out of scope

- Tracking who's physically present (everyone is treated as present).
- Guest-facing views, guest logins, or guests using phones.
- Running more than one party (designed for this party only).
- Randomizing assignments live. Assignments are generated and stored ahead of
  time so the printed sheets always match the app.
- Printing. The organizer makes the printed sheets outside the app.
- Showing supporters in the app. They're on the printed sheets.

---

## 2. Data model (Supabase / Postgres)

All party configuration lives in the database. Nothing about players, events,
or assignments is hardcoded.

```sql
-- Team keys: 4 colors for standard events, A/B for bonus events
create type team_key as enum ('red', 'yellow', 'blue', 'green', 'a', 'b');

create table players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table events (
  id         uuid primary key default gen_random_uuid(),
  position   int  not null unique,          -- run order: 1, 2, 3...
  name       text not null,
  kind       text not null check (kind in ('standard', 'bonus')),
  -- points[1] = points for 1st place, points[2] = 2nd, etc.
  -- standard: {5,3,2,1}, bonus: {5,0}
  points     int[] not null,
  created_at timestamptz not null default now()
);

-- One row per team in an event. Holds the result.
-- Standard events use red/yellow/blue/green, bonus events use a/b.
create table event_teams (
  event_id uuid not null references events(id) on delete cascade,
  team     team_key   not null,
  place    int check (place >= 1),          -- null until results are entered
  primary key (event_id, team)
);

-- One row per player per event: which team they're on and their role.
create table event_members (
  event_id  uuid not null,
  player_id uuid not null references players(id) on delete cascade,
  team      team_key   not null,
  role      text not null check (role in ('competitor', 'supporter')),
  primary key (event_id, player_id),        -- a player is on exactly one team per event
  foreign key (event_id, team) references event_teams(event_id, team) on delete cascade
);

-- At most one competitor per team
create unique index one_competitor_per_team
  on event_members (event_id, team) where role = 'competitor';
```

Notes:

- **Event status is derived.** An event is complete when every team has a
  place. No separate status column to keep in sync.
- **Points aren't stored.** They're derived as `events.points[place]` (0 if
  out of range). Correcting a result automatically fixes every player's total.
- **Bonus events** have 2 `event_teams` rows (`a` and `b`) and no competitor
  members.
- Scoring math lives in one place: a pure, unit-tested TypeScript function.
  With about 30 players and 14 events the whole dataset is a few hundred rows,
  so loaders fetch the raw rows and compute totals in code.

### Data validation

A setup check (run by the import script) reports:

- A player missing from an event, or listed twice.
- A standard event without exactly 4 color teams and 4 competitors.
- A bonus event without exactly teams A and B.
- Team sizes that differ by more than 1 within an event.
- Results with gaps in the places (for example 1, 3, 4). Shown as a gentle
  warning in the app rather than blocking anything, since results are saved
  one tap at a time.

---

## 3. Seeding the party data

Since assignments are generated once and printed, seeding is a **one-time,
deterministic** script, not an app feature.

**Inputs** (CSV files in `data/`, imported by a script):

- `players.csv`: one name per row.
- `events.csv`: position, name, kind, and for standard events the competitor
  for each color.

**Script** (`scripts/seed.ts`):

1. Upserts players and events.
2. For each standard event, puts the 4 competitors on their colors, then
   shuffles the remaining players and deals them round-robin across the 4
   colors (as even as possible).
3. For each bonus event, shuffles everyone and splits them into Team A and
   Team B.
4. Uses a **fixed random seed** so a rerun produces the same assignments.
5. **Refuses to overwrite** existing assignments unless passed `--force`, so
   the printed sheets can't drift from the database by accident.
6. Runs the setup check at the end.

Nice to have: when dealing supporters, avoid putting the same person on the
same competitor's team over and over, so the mix of teammates changes.

---

## 4. Screens

Mobile-first with big tap targets. Two views, switched with a toggle that's
always visible (for example a bottom tab bar), plus a login screen.

| Route | Purpose |
| --- | --- |
| `/login` | Shared password entry. |
| `/events/:position` | **Event view (main screen).** Steps through events in order with previous/next controls. `/` redirects to the first event that doesn't have full results yet. |
| `/leaderboard` | **Leaderboard.** All players ranked by total points, with ties sharing a rank. |

### Event view

- Header: event number, name, and previous/next arrows.
- Standard event: 4 rows, one per color (Red, Yellow, Blue, Green), each
  showing the color and that event's competitor.
- Bonus event: 2 rows, Team A and Team B.
- Each row has a button for every place: 1st to 4th for standard events, 1st
  and 2nd for bonus events. The selected place is highlighted.
- **Tapping a place saves it right away.** There's no confirm step.
  - Tapping a different place on the same row changes it.
  - Tapping the selected place again clears it.
  - Two rows can pick the same place (ties).
- **Optimistic updates.** The button highlights right away while the save
  runs in the background. If the save fails, the row snaps back to its
  previous value and a short error message appears.
- If the places have a gap (for example 1, 1, 3), a small warning appears.
  It never blocks anything.

### Leaderboard

- Rank, name, and total points, sorted highest first.
- Ties share a rank (for example 1, 2, 2, 4).
- Possible addition: tap a player to see per-event points. Not required.

### Keeping officials in sync

With 2 or 3 officials on separate phones, data refreshes when a screen
regains focus and every 15 seconds while it's visible (React Router
revalidation).

---

## 5. Tech stack

- **React Router v7, framework mode** (SSR with loaders and actions),
  TypeScript.
- **Vercel** hosting via the `@vercel/react-router` preset.
- **Supabase** Postgres, with migrations in `supabase/migrations` (Supabase
  CLI) and `@supabase/ssr` for server-side access.
- **Tailwind CSS** for styling.
- **Vitest** for unit tests on scoring, tie handling, and assignment dealing.
- Optimistic updates use React Router's `useFetcher`: while a save is in
  flight the UI shows the submitted value, and when it settles the loader
  data (the real database state) takes over. A failed save rolls back on its
  own.

### Auth and security

Kept deliberately small:

- One **shared password**, stored as a Vercel environment variable.
- `/login` checks it in a React Router action and sets a signed, HTTP-only
  session cookie (`createCookieSessionStorage`). Every other route's loader
  and action checks for that cookie and redirects to `/login` if it's
  missing. This is roughly 30 lines of code.
- The app only talks to Supabase from the server, using the Supabase secret
  key. Row Level Security is turned on with no policies, so the public
  (anon) key can't read or write anything.
- Why not Google sign-in: Supabase supports it, but it means setting up a
  Google Cloud OAuth client, redirect URLs, and an allowlist check. That's
  more setup and code than a shared password for 3 trusted people. Vercel's
  built-in password protection is a paid add-on.

---

## 6. Build plan

Target: feature complete with time for a dry run before October 11.

1. **Foundation.** Scaffold React Router + Tailwind, write the Supabase
   migration, set up Vercel deploys with environment variables. Add the
   scoring module and its tests.
2. **CSV import.** CSV format, import script with seeded shuffle, setup
   check. Load placeholder data.
3. **Event view.** Event stepping, place buttons with optimistic saves and
   rollback, gap warning.
4. **Leaderboard and auth.** Leaderboard view, tab toggle, shared password
   login.
5. **Polish.** Refresh on focus (Realtime if time allows), error states,
   testing on real phones.
6. **Real data and dry run.** Import the real roster and schedule, and run a
   mock party with the officials.

---

## 7. Open questions

1. **Accounts.** The Supabase and Vercel projects still need to be created
   and connected.
