# Party Scorekeeper

Mobile-first scorekeeping app for a birthday party on **October 11, 2026**.
Only 2 to 3 officials use it; guests never do. Full spec: `docs/SPEC.md`.

## Stack

- React Router **7** framework mode (not v8: `@vercel/react-router` only supports v7), TypeScript, Tailwind 4
- Supabase Postgres, accessed **only from the server** with the secret key (`app/lib/supabase.server.ts`). RLS is on with no policies, so public keys can't read or write.
- Vercel, deployed through the `@vercel/react-router` preset. Functions run in `sfo1`, next to the database (us-west-1).
- Auth is one shared password (`APP_PASSWORD`) plus a signed cookie (`app/lib/session.server.ts`). Every protected loader and action calls `requireOfficial`.

## Rules in one paragraph

A game has 1+ heats; each heat ranks the four colors (red, yellow, blue, green) and pays 5/3/2/1. A color's score for a game is the sum over its heats, and everyone on that color for that game (competitors of any heat plus supporters) gets it. A color can field 1 to 3 people per heat. No bonus (Team A/B) games.

## Commands

```sh
npm run dev         # needs .env (see .env.example)
npm test            # Vitest: scoring, dealing, CSV parsing, party validation
npm run typecheck
npm run build
npm run import      # data/*.csv -> data/import.sql (add -- --force to replace existing data)
npm run fake-db     # fake database on :54321 seeded from data/*.csv (see Testing)
```

CI runs typecheck, tests, and build on every PR.

## Layout

- `app/lib/scoring.ts`: points, ties, standings, heat helpers. Pure; keep scoring logic here and tested.
- `app/lib/assign.ts`: seeded, balanced supporter dealing (`dealEvent`).
- `app/lib/data.server.ts`: all Supabase queries.
- `app/lib/revalidate.ts`: skips loader reloads when only `?search` changes (heat tabs switch instantly).
- `app/routes/event.tsx`: main screen. Place buttons save on tap via per-team fetchers (`place:<eventId>:<heat>:<team>`); the optimistic state comes from `useFetchers()`. `clientAction` turns network failures into a row error so the row rolls back. Multi-heat games pin `?heat=` in the URL via a loader redirect.
- `app/routes/leaderboard.tsx`, `app/routes/home.tsx` (redirects to the first heat without a result), `app/routes/app-layout.tsx` (tab bar, refresh on focus and every 15s).
- `scripts/party.ts`: reads and validates the CSVs and deals every game (shared by `import.ts` and `fake-db.ts`). Each game is dealt from its own seed (seed + game name), so editing or reordering one game doesn't change the others.
- `supabase/migrations/`: schema. Points aren't stored; they come from `events.points[place]`.

## Workflow

- Changes go through PRs into `main`; merging to `main` deploys production at https://party-scorekeeper.vercel.app. PRs get Vercel preview deployments (preview URLs require a Vercel login). Previews use the **same database** as production.
- Schema changes: add a migration file in the PR and apply it to Supabase.
- Party data (players, games, lineups, assignments) is **not** changed through PRs. Edit the CSVs, run `npm run import`, and apply `data/import.sql` to the database. Assignments are printed on sheets, so never re-deal (`--force`) without the organizer's OK.
- Code freeze around Oct 9-10: only fixes after that.

## Supabase connector gotcha

The Supabase MCP tools (`apply_migration`, `execute_sql`) hang for 60 seconds and time out on any statement containing `DROP`, `DELETE`, or `TRUNCATE`, even a no-op like `drop table if exists nothing`. It looks like destructive statements wait for a user confirmation that never arrives. Reads, `CREATE`, `ALTER`, and `INSERT` work. For anything destructive (including `npm run import -- --force`), write the SQL to a file and have the user paste it into the Supabase SQL editor, then verify afterwards with read-only queries. A timed-out call may not have applied: check the state before retrying.

## IDs

- Supabase project: `uqaqqbgeykiwrdxnnwtk` (org "Weotch")
- Vercel project: `prj_eA5DUyt2ULETcbQmGnAbC0vNA3ro`, team `team_qO9anyoHJZCZtmNfVe4bsyVF`

## Testing without the secret key

Cloud sessions don't have `SUPABASE_SECRET_KEY`, and their network policy may block `*.vercel.app`. To exercise the UI locally:

```sh
npm run fake-db &   # seeded from data/*.csv; GET /fail?n=1 fails the next write, GET /latency?ms=600 slows writes
SUPABASE_URL=http://localhost:54321 SUPABASE_SECRET_KEY=x APP_PASSWORD=bopya SESSION_SECRET=test npm run dev
```

The secret key can be any non-empty value (the client requires one). Drive the app with Playwright (Chromium is at `/opt/pw-browsers`). Read the page only after it has painted: React Router changes the URL before React commits, so poll for the element instead of reading immediately after `waitForURL`. To check SQL changes without the real database, run the migration and `data/import.sql` against PGlite (`@electric-sql/pglite`), an in-process Postgres.
