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

1. Edit `data/players.csv` and `data/events.csv`. For standard events, fill in
   the red/yellow/blue/green competitor columns; leave them blank for bonus events.
2. Run `npm run import` (add `-- --force` to replace existing data). It
   checks the CSVs, deals supporters and bonus teams, and writes `data/import.sql`.
3. Run `data/import.sql` in the Supabase SQL editor.

Dealing is seeded, so the same CSVs always produce the same teams.

## Database

Schema changes live in `supabase/migrations/`.
