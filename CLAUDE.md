# Party Scorekeeper

Mobile-first scorekeeping app for a birthday party on **October 11, 2026**.
Only 2 to 3 officials use it; guests never do. Full spec: `docs/SPEC.md`.

## Stack

- React Router **7** framework mode (not v8: `@vercel/react-router` only supports v7), TypeScript, Tailwind 4
- Supabase Postgres, accessed **only from the server** with the secret key (`app/lib/supabase.server.ts`). RLS is on with no policies, so public keys can't read or write.
- Vercel, deployed through the `@vercel/react-router` preset. Functions run in `sfo1`, next to the database (us-west-1).
- Auth is one shared password (`APP_PASSWORD`) plus a signed cookie (`app/lib/session.server.ts`). Every protected loader and action calls `requireOfficial`.

## Commands

```sh
npm run dev         # needs .env (see .env.example)
npm test            # Vitest: scoring, dealing, CSV parsing
npm run typecheck
npm run build
npm run import      # data/*.csv -> data/import.sql (add -- --force to replace existing data)
```

CI runs typecheck, tests, and build on every PR.

## Layout

- `app/lib/scoring.ts`: points, ties, standings. Pure; keep scoring logic here and tested.
- `app/lib/assign.ts`: seeded, balanced supporter and bonus-team dealing.
- `app/lib/data.server.ts`: all Supabase queries.
- `app/routes/event.tsx`: main screen. Place buttons save on tap via per-team fetchers (`place:<eventId>:<team>`); the optimistic state comes from `useFetchers()`. `clientAction` turns network failures into a row error so the row rolls back.
- `app/routes/leaderboard.tsx`, `app/routes/home.tsx` (redirects to the first event without full results), `app/routes/app-layout.tsx` (tab bar, refresh on focus and every 15s).
- `supabase/migrations/`: schema. Points aren't stored; they come from `events.points[place]`.

## Workflow

- Changes go through PRs into `main`; merging to `main` deploys production at https://party-scorekeeper.vercel.app. PRs get Vercel preview deployments (preview URLs require a Vercel login).
- Schema changes: add a migration file in the PR and apply it to Supabase when merging.
- Party data (players, events, assignments) is **not** changed through PRs. Edit the CSVs, run `npm run import`, and apply `data/import.sql` to the database. Assignments are printed on sheets, so never re-deal (`--force`) without the organizer's OK.
- Code freeze around Oct 9-10: only fixes after that.

## IDs

- Supabase project: `uqaqqbgeykiwrdxnnwtk` (org "Weotch")
- Vercel project: `prj_eA5DUyt2ULETcbQmGnAbC0vNA3ro`, team `team_qO9anyoHJZCZtmNfVe4bsyVF`

## Testing without the secret key

Cloud sessions don't have `SUPABASE_SECRET_KEY`, and their network policy may block `*.vercel.app`. To exercise the UI locally, point `SUPABASE_URL` at a small fake PostgREST server seeded from the CSVs, set `SUPABASE_SECRET_KEY` to any non-empty dummy value (the client requires one), and drive it with Playwright (Chromium is at `/opt/pw-browsers`).
