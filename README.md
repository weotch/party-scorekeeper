# Party Scorekeeper

Mobile-first scorekeeping for the October 11, 2026 party. See [docs/SPEC.md](docs/SPEC.md).

## Development

```sh
npm install
cp .env.example .env   # fill in the values
npm run dev
npm test
npm run typecheck
```

## Party data

1. Edit `data/players.csv`, `data/events.csv` (position, name, description), and
   `data/heats.csv` (one row per heat; each color cell lists one or more names
   separated by `;`).
2. Run `npm run import` (add `-- --force` to replace existing data). It checks
   the CSVs, deals supporters, and writes `data/import.sql`.
3. Run `data/import.sql` in the Supabase SQL editor.

Dealing is seeded per game, so the same CSVs always produce the same teams, and
changing one game's lineup doesn't change the others. See `docs/SPEC.md`.

## Database

Schema changes live in `supabase/migrations/`.
