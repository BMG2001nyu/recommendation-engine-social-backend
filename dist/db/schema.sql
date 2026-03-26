-- Luna Social — SQLite Schema

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  lat         REAL DEFAULT 40.7128,
  lng         REAL DEFAULT -74.0060,
  city        TEXT DEFAULT 'New York',
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interests (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category         TEXT NOT NULL,
  weight           REAL DEFAULT 0.5,
  source           TEXT DEFAULT 'explicit',
  engagement_count INTEGER DEFAULT 1,
  created_at       TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, category)
);

CREATE TABLE IF NOT EXISTS venues (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  tags             TEXT NOT NULL DEFAULT '[]',
  lat              REAL,
  lng              REAL,
  address          TEXT,
  city             TEXT DEFAULT 'New York',
  rating           REAL DEFAULT 4.0,
  price_level      INTEGER DEFAULT 2,
  busyness_pattern TEXT NOT NULL DEFAULT '[]',
  photos           TEXT DEFAULT '[]',
  vibe_description TEXT,
  quality_score    REAL DEFAULT 0.5,
  trending_score   REAL DEFAULT 0.0,
  engagement_count INTEGER DEFAULT 0,
  created_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS social_edges (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strength       REAL DEFAULT 0.5,
  initiator_score REAL DEFAULT 0.5,
  mutual_friends INTEGER DEFAULT 0,
  created_at     TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS venue_engagements (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id   TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  level      TEXT NOT NULL DEFAULT 'viewed',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, venue_id)
);

CREATE TABLE IF NOT EXISTS plans (
  id               TEXT PRIMARY KEY,
  venue_id         TEXT NOT NULL REFERENCES venues(id),
  created_by       TEXT NOT NULL REFERENCES users(id),
  scheduled_time   TEXT NOT NULL,
  status           TEXT DEFAULT 'draft',
  booking_reference TEXT,
  booking_details  TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plan_participants (
  plan_id      TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'invited',
  invited_by   TEXT REFERENCES users(id),
  responded_at TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (plan_id, user_id)
);

-- Append-only event log — never UPDATE or DELETE
CREATE TABLE IF NOT EXISTS engagement_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  venue_id   TEXT REFERENCES venues(id),
  plan_id    TEXT REFERENCES plans(id),
  event_type TEXT NOT NULL,
  metadata   TEXT DEFAULT '{}',
  timestamp  TEXT DEFAULT (datetime('now'))
);

-- Cached propagation signals: when user A acts on venue V, boost V for friends
CREATE TABLE IF NOT EXISTS propagation_signals (
  id           TEXT PRIMARY KEY,
  source_user_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id),
  venue_id     TEXT NOT NULL REFERENCES venues(id),
  signal_strength REAL NOT NULL DEFAULT 0.0,
  source_level TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now')),
  expires_at   TEXT,
  consumed     INTEGER DEFAULT 0
);

-- Simple availability model (per user, day-of-week + hour)
CREATE TABLE IF NOT EXISTS availability_slots (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,  -- 0=Sun … 6=Sat
  hour        INTEGER NOT NULL,  -- 0–23
  available   INTEGER DEFAULT 1,
  UNIQUE(user_id, day_of_week, hour)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interests_user        ON interests(user_id);
CREATE INDEX IF NOT EXISTS idx_engagements_user      ON venue_engagements(user_id);
CREATE INDEX IF NOT EXISTS idx_engagements_venue     ON venue_engagements(venue_id);
CREATE INDEX IF NOT EXISTS idx_edges_user            ON social_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_edges_friend          ON social_edges(friend_id);
CREATE INDEX IF NOT EXISTS idx_events_user           ON engagement_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_venue          ON engagement_events(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_ts             ON engagement_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_plans_venue           ON plans(venue_id);
CREATE INDEX IF NOT EXISTS idx_participants_user     ON plan_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_propagation_target    ON propagation_signals(target_user_id, venue_id);
CREATE INDEX IF NOT EXISTS idx_availability_user     ON availability_slots(user_id);
