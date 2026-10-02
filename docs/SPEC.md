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
- There are 4 team colors, fixed for the whole party: **Red, Yellow, Blue,
  Green**. Colored props match them.
- Every player belongs to exactly one team in every event. No one sits out.

### Standard events (4 teams)

- Each color team has one **competitor**, so 4 competitors per event.
- Every other player is a **supporter** on one of the 4 teams. Supporters are
  spread as evenly as possible (for example, 26 players means 22 supporters, so
  team sizes of 6/6/5/5 including the competitor).
- Points by place: **1st = 5, 2nd = 3, 3rd = 2, 4th = 1**.
- Every member of a team (competitor and supporters) gets that team's points.

### Bonus events (2 teams)

- The whole group splits into 2 teams as evenly as possible. There is no
  designated competitor.
- The winning team's members each get **5 points**. The losing team gets 0.

### Ties within an event

- Officials can give two or more teams the same place.
- Places below a tie **move up** (dense ranking). There are no gaps; the last
  places just disappear.
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

---

## 2. Data model (Supabase / Postgres)

All party configuration lives in the database. Nothing about players, events,
or assignments is hardcoded.

```sql
-- Fixed set of team colors
create type team_color as enum ('red', 'yellow', 'blue', 'green');

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
create table event_teams (
  event_id uuid not null references events(id) on delete cascade,
  color    team_color not null,
  place    int check (place >= 1),          -- null until results are entered
  primary key (event_id, color)
);

-- One row per player per event: which team they're on and their role.
create table event_members (
  event_id  uuid not null,
  player_id uuid not null references players(id) on delete cascade,
  color     team_color not null,
  role      text not null check (role in ('competitor', 'supporter')),
  primary key (event_id, player_id),        -- a player is on exactly one team per event
  foreign key (event_id, color) references event_teams(event_id, color) on delete cascade
);

-- At most one competitor per team
create unique index one_competitor_per_team
  on event_members (event_id, color) where role = 'competitor';
```

Notes:

- **Event status is derived.** An event is complete when every team has a
  place. No separate status column to keep in sync.
- **Points aren't stored.** They're derived as `events.points[place]` (0 if
  out of range). Correcting a result automatically fixes every player's total.
- **Bonus events** have 2 `event_teams` rows and no competitor members.
- Scoring math lives in one place: a pure, unit-tested TypeScript function.
  With about 30 players and 14 events the whole dataset is a few hundred rows,
  so loaders fetch the raw rows and compute totals in code.

### Data validation

A setup check (a script and/or an in-app page) reports:

- A player missing from an event, or listed twice.
- A standard event without exactly 4 teams and 4 competitors.
- A bonus event without exactly 2 teams.
- Team sizes that differ by more than 1 within an event.
- Results with gaps in the places (for example 1, 3, 4).

---

## 3. Seeding the party data

Since assignments are generated once and printed, seeding is a **one-time,
deterministic** script, not an app feature.

**Inputs** (files checked into `data/`, or edited in the Supabase table editor):

- `players.csv`: one name per row.
- `events.csv`: position, name, kind, and for standard events the competitor
  for each color.

**Script** (`scripts/seed.ts`):

1. Upserts players and events.
2. For each standard event, puts the 4 competitors on their colors, then
   shuffles the remaining players and deals them round-robin across the 4
   colors (as even as possible).
3. For each bonus event, shuffles everyone and splits them across 2 colors.
4. Uses a **fixed random seed** so a rerun produces the same assignments.
5. **Refuses to overwrite** existing assignments unless passed `--force`, so
   the printed sheets can't drift from the database by accident.
6. Runs the setup check at the end.

Nice to have: when dealing supporters, avoid putting the same person on the
same competitor's team over and over, so the mix of teammates changes.

---

## 4. Screens

Mobile-first, big tap targets, team colors used heavily so they match the
props.

| Route | Purpose |
| --- | --- |
| `/login` | Official sign-in. |
| `/` | **Schedule.** Ordered event list showing status (upcoming / done) and the winning color for finished events. The next event is highlighted. |
| `/events/:position` | **Event.** One card per color showing the competitor (big) and supporters. Enter or edit results here. Previous/next links to move through the night. |
| `/leaderboard` | **Standings.** All players ranked by total, with ties sharing a rank. Tap a player to see their breakdown. |
| `/players/:id` | **Player breakdown.** Per event: color, role, place, points. |
| `/print` | **Printable sheets.** One page per event with the team breakdown by color, styled for paper. Generated from the same data the app uses. |
| `/setup-check` | Shows the validation report from section 2. |

### Entering results

- Each color card has place buttons (1st to 4th, or 1st/2nd for bonus events).
- Ties are allowed: two cards can both pick 1st.
- Before saving, the app checks the places are dense (no gaps) and shows a
  points preview, for example "Red +5 (7 players)".
- Saving writes `event_teams.place`. Results can be edited or cleared later.

### Keeping officials in sync

With 2 or 3 officials on separate phones, the app should refresh data when a
screen regains focus. Stretch goal: Supabase Realtime subscriptions on
`event_teams` so standings update live on everyone's device.

---

## 5. Tech stack

- **React Router v7, framework mode** (SSR with loaders and actions),
  TypeScript.
- **Vercel** hosting via the `@vercel/react-router` preset.
- **Supabase** Postgres, with migrations in `supabase/migrations` (Supabase
  CLI) and `@supabase/ssr` for server-side access.
- **Tailwind CSS** for styling, plus print styles for `/print`.
- **Vitest** for unit tests on scoring, tie handling, and assignment dealing.

### Auth and security

- Officials sign in with **Supabase Auth (email and password)**. You create
  their accounts by hand in the Supabase dashboard; there's no public sign-up.
- Row Level Security: authenticated users can read and write everything;
  anonymous users get nothing.
- Secrets (Supabase URL, keys) go in Vercel environment variables. The service
  role key is used only by the local seed script, never in the deployed app.

---

## 6. Build plan

Target: feature complete with time for a dry run before October 11.

1. **Foundation.** Scaffold React Router + Tailwind, write the Supabase
   migration, and set up deploys to Vercel with environment variables. Add
   the scoring module and its tests.
2. **Seeding.** CSV format, seed script with seeded shuffle, setup check. Load
   placeholder data.
3. **Core screens.** Schedule, event view, results entry, leaderboard, player
   breakdown.
4. **Auth and print.** Login, RLS policies, `/print` sheets.
5. **Polish.** Refresh on focus (Realtime if time allows), loading and error
   states, testing on real phones.
6. **Real data and dry run.** Load the real roster and schedule, print the
   sheets, and run a mock party with the officials.

---

## 7. Open questions

1. **Bonus event colors.** Which 2 colors do bonus teams use? Is the split
   random and seeded in advance like supporters?
2. **Bonus losers.** Confirm the losing team gets 0 points.
3. **Auth.** Is per-official email and password OK, or would you rather share
   one passcode among the officials?
4. **Print sheets.** Should the app generate the printed sheets (`/print`), or
   will you make your own from the data?
5. **Accounts.** Do the Supabase and Vercel projects exist yet?
