# Party Scorekeeper: Spec

A mobile-first web app that 2 to 3 officials use to keep score for the party
games on **October 11, 2026**. Guests never use the app; they see their team
assignments on printed sheets.

## 1. How the party works

- About **20 to 30 players** and about **12 games**, run in a fixed order. The
  order can change freely until the sheets are printed.
- There are four team colors, fixed for the whole party: **Red, Yellow, Blue,
  Green**. Colored props match them.
- Every player is on exactly one color in every game. Nobody sits out.

### A game

- A game has one or more **heats**. In a heat, the four colors compete and are
  ranked 1st to 4th. Balloon Bobble runs 2 heats.
- Each color fields one to three people in a heat. Usually that is one person;
  Hot Potato Tag fields 3 per color in a single heat, and Balloon Hustle fields
  a pre-assigned pair per color. A competitor plays in exactly one heat of a
  game.
- Everyone who isn't competing is a **supporter**. Supporters are dealt to a
  color in advance, as evenly as possible (counting the competitors), and the
  assignments are printed.

### Scoring

- Each heat pays by place: **1st = 5, 2nd = 3, 3rd = 2, 4th = 1**.
- A team's score for a game is the **sum of its points across the game's
  heats**. Everyone on that color for that game gets it: competitors from any
  heat and every supporter.
- A one-heat game pays at most 5 per person and a two-heat game at most 10.
  That is intentional: a game with more heats counts for more.
- A pair or a group of three on a team is not worth extra. If the team wins,
  everyone on it gets the same points.
- **Ties:** officials can give two teams the same place, and places below a tie
  move up (1st, 1st, 2nd, 3rd pay 5, 5, 3, 2). The app doesn't renumber
  anything; points come straight from the place that was picked.
- **Winning:** highest total wins. Overall ties are settled outside the app;
  the leaderboard shows tied players at the same rank.
- How elimination games (such as Hot Potato Tag) turn into four team places is
  up to the officials. The app only records the final order of the four teams.

### Out of scope

- Team A vs Team B bonus games (dropped).
- Tracking who is physically present (everyone is treated as present).
- Guest-facing views or logins.
- More than one party.
- Randomizing assignments live, or printing the sheets.

## 2. Data model (Supabase / Postgres)

The schema is in `supabase/migrations/`. In short:

| Table | Holds |
| --- | --- |
| `players` | name |
| `events` | `position` (running order), `name`, `description`, `points` (per heat, default `{5,3,2,1}`) |
| `event_teams` | the four colors for each game |
| `heats` | heat numbers for each game |
| `heat_results` | one row per color per heat, with its `place` (null until entered) |
| `event_members` | each player's color in each game, their `role`, and for competitors their `heat` |

- Points aren't stored. They are derived from `events.points[place]` and summed
  over heats, so correcting a result fixes every total.
- A game is **scored** when every `heat_results` row has a place.
- A check constraint requires competitors to have a heat and supporters to have
  none. A player can be in a game only once (primary key on `event_id,
  player_id`).
- Row Level Security is on with no policies. The app reads and writes from the
  server with the secret key, so the public keys can't touch the data.

## 3. Party data (CSV import)

Assignments are generated once and printed, so setup is a deterministic script
rather than an app feature. Three files in `data/`:

- `players.csv`: `name`
- `events.csv`: `position,name,description`
- `heats.csv`: `event,heat,red,yellow,blue,green`. One row per heat. Each color
  cell holds one or more names separated by `;`. Heats refer to a game by
  **name**, so reordering `events.csv` is safe.

`npm run import` validates the files and stops on typos, then deals supporters
and writes `data/import.sql`. It checks that:

- Every name exists, and nobody competes twice in a game.
- Every heat has at least one competitor for each color, and heat numbers run
  1, 2, 3 with none missing.
- No color has more than 3 people in a heat.
- Every game has at least one heat, there is at least one player and one game,
  and game names and positions are unique.
- (Warning only) a heat has uneven teams.

Dealing is seeded. Each game's supporters are dealt at random, then **mixed
across games**: supporters swap colors within a game whenever that lowers how
often the same two people end up together, so teams keep changing (with the
real lineups, no pair shares a color in more than 6 of 12 games, and most share
2 or 3). Supporters stay one color for the whole game (all heats) and never
include that game's competitors. Reordering games doesn't change the teams;
editing a lineup can reshuffle supporters in other games, so finish lineups
before printing. The script refuses to replace existing data without
`--force`, so printed sheets can't drift from the database by accident. Its
summary shows team sizes and how many games each player competes in.

## 4. Screens

Mobile-first with big tap targets. A bottom tab bar switches between the event
screen and the leaderboard.

- **`/login`**: the shared password.
- **`/events/:position`**: the main screen. Arrows step through the games, and
  `/` opens the first heat that still needs a result.
  - Shows the game's name and description.
  - Games with 2+ heats show a heat switcher (a check mark marks finished
    heats). The heat is kept in the URL (`?heat=2`) so finishing one heat
    doesn't move the screen. Switching heats is instant.
  - Each color has a card listing its competitors for that heat (one to three
    names) and a button for each place.
  - **Tapping a place saves immediately.** Tapping another place changes it, and
    tapping the selected place clears it. Two teams can share a place.
  - **Optimistic updates:** the button highlights at once and, if the save
    fails (including a dropped connection), snaps back with a short message.
  - A gentle warning appears if a place is skipped (for example 1st, 1st, 3rd).
  - Multi-heat games show each color's running total for the game.
- **`/leaderboard`**: every player ranked by total, ties sharing a rank, plus how
  many games are fully scored.

With several officials on separate phones, data refreshes when the app regains
focus and every 15 seconds while visible.

## 5. Tech stack and security

- **React Router 7** framework mode (v8 isn't supported by Vercel's preset yet),
  TypeScript, Tailwind 4.
- **Vercel** via `@vercel/react-router`, with functions in `sfo1` next to the
  database.
- **Supabase** Postgres, with migrations in `supabase/migrations`.
- **Vitest** for the scoring, dealing, CSV, and import logic.
- Auth is one shared password (`APP_PASSWORD`, a Vercel environment variable)
  and a signed, HTTP-only session cookie. Every protected loader and action
  checks it.
