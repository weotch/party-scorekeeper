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
  team     team_key not null,
  place    int check (place >= 1),          -- null until results are entered
  primary key (event_id, team)
);

-- One row per player per event: which team they're on and their role.
create table event_members (
  event_id  uuid not null,
  player_id uuid not null references players(id) on delete cascade,
  team      team_key not null,
  role      text not null check (role in ('competitor', 'supporter')),
  primary key (event_id, player_id),        -- a player is on exactly one team per event
  foreign key (event_id, team) references event_teams(event_id, team) on delete cascade
);

-- At most one competitor per team
create unique index one_competitor_per_team
  on event_members (event_id, team) where role = 'competitor';

create index event_members_player_id on event_members (player_id);

-- The app only talks to Supabase from the server with the secret key, which
-- bypasses RLS. Enabling RLS with no policies locks out the public keys.
alter table players       enable row level security;
alter table events        enable row level security;
alter table event_teams   enable row level security;
alter table event_members enable row level security;
