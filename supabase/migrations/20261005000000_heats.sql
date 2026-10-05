-- Rebuild for heats, several competitors per team, and game descriptions, and
-- without the Team A/B bonus games. There was no real data yet, so the old
-- tables are dropped and recreated instead of migrated. Safe to run on any
-- earlier state of this database.

drop table if exists heat_results, heats, event_members, event_teams, events, players cascade;
drop type if exists team_key cascade;

create type team_key as enum ('red', 'yellow', 'blue', 'green');

create table players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table events (
  id          uuid primary key default gen_random_uuid(),
  position    int  not null unique,          -- running order: 1, 2, 3...
  name        text not null unique,
  description text,
  -- Points per heat: points[1] is 1st place, points[2] is 2nd, and so on
  points      int[] not null default '{5,3,2,1}',
  created_at  timestamptz not null default now()
);

-- The four colors playing in each game (the target of the foreign keys below)
create table event_teams (
  event_id uuid not null references events(id) on delete cascade,
  team     team_key not null,
  primary key (event_id, team)
);

create table heats (
  event_id uuid not null references events(id) on delete cascade,
  number   int  not null check (number >= 1),
  primary key (event_id, number)
);

-- One row per team per heat. A team's score for a game is the sum over its heats.
create table heat_results (
  event_id uuid not null,
  heat     int  not null,
  team     team_key not null,
  place    int check (place >= 1),           -- null until the result is entered
  primary key (event_id, heat, team),
  foreign key (event_id, heat) references heats (event_id, number) on delete cascade,
  foreign key (event_id, team) references event_teams (event_id, team) on delete cascade
);

-- Which color each player is on in each game. Competitors also record their
-- heat; supporters leave it null.
create table event_members (
  event_id  uuid not null,
  player_id uuid not null references players(id) on delete cascade,
  team      team_key not null,
  role      text not null check (role in ('competitor', 'supporter')),
  heat      int,
  primary key (event_id, player_id),         -- a player is on exactly one team per game
  foreign key (event_id, team) references event_teams (event_id, team) on delete cascade,
  foreign key (event_id, heat) references heats (event_id, number) on delete cascade,
  constraint competitor_has_heat check ((role = 'competitor') = (heat is not null))
);

create index event_members_player_id on event_members (player_id);

-- The app only talks to Supabase from the server with the secret key, which
-- bypasses RLS. RLS with no policies locks out the public keys.
alter table players       enable row level security;
alter table events        enable row level security;
alter table event_teams   enable row level security;
alter table heats         enable row level security;
alter table heat_results  enable row level security;
alter table event_members enable row level security;
