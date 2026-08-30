PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT    NOT NULL,
  external_id  TEXT,
  handle       TEXT,
  name         TEXT,
  locale       TEXT    NOT NULL DEFAULT 'fa',
  score        INTEGER NOT NULL DEFAULT 0,
  route        TEXT    NOT NULL DEFAULT 'cold',
  stage        TEXT    NOT NULL DEFAULT 'new',
  owner        TEXT,
  value_toman  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One lead per (source, external_id); repeated webhooks update instead of duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS leads_source_external
  ON leads (source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_route ON leads (route);
CREATE INDEX IF NOT EXISTS leads_stage ON leads (stage);

-- Append-only. Scores and timelines are derived from this table, never stored ahead of it.
CREATE TABLE IF NOT EXISTS lead_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  type         TEXT    NOT NULL,
  payload_json TEXT,
  at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS lead_events_lead ON lead_events (lead_id, at);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  channel     TEXT    NOT NULL,
  direction   TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  status      TEXT    NOT NULL,
  external_id TEXT,
  at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS messages_lead ON messages (lead_id, at);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  sequence   TEXT    NOT NULL,
  step_index INTEGER NOT NULL,
  due_at     TEXT    NOT NULL,
  sent_at    TEXT,
  status     TEXT    NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS sequence_due ON sequence_steps (status, due_at);

CREATE TABLE IF NOT EXISTS deals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  stage        TEXT    NOT NULL DEFAULT 'open',
  amount_toman INTEGER NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  closed_at    TEXT
);
CREATE INDEX IF NOT EXISTS deals_lead ON deals (lead_id);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id      INTEGER NOT NULL REFERENCES deals (id) ON DELETE CASCADE,
  provider     TEXT    NOT NULL,
  provider_ref TEXT    NOT NULL UNIQUE,
  amount_toman INTEGER NOT NULL,
  status       TEXT    NOT NULL,
  at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- The growth loop: a slice of every payment goes back to a channel budget.
CREATE TABLE IF NOT EXISTS allocations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  source_payment_id INTEGER NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
  channel           TEXT    NOT NULL,
  amount_toman      INTEGER NOT NULL,
  at                TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_pieces (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  channel    TEXT,
  title      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Single-row profile for the app shell, plus per-level stage progress.
CREATE TABLE IF NOT EXISTS app_profile (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  display_name  TEXT    NOT NULL DEFAULT 'کاربر موج ابزار',
  full_name     TEXT,
  phone         TEXT,
  headline      TEXT    NOT NULL DEFAULT 'اولین پلتفرم',
  plan          TEXT    NOT NULL DEFAULT 'free',
  plan_expires  TEXT,
  points        INTEGER NOT NULL DEFAULT 0,
  bot_id        TEXT,
  bot_username  TEXT,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS level_progress (
  level_id    INTEGER PRIMARY KEY,
  stages_done INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS coach_messages (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  role    TEXT NOT NULL,
  content TEXT NOT NULL,
  at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per AI tool run: the inputs and the structured answer, so a user can
-- come back to what a tool told them.
CREATE TABLE IF NOT EXISTS tool_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_id     TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  produced_by TEXT NOT NULL,
  at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS tool_runs_tool ON tool_runs (tool_id, id DESC);

-- What the owner tells us about their business. Every AI call reads this, so a
-- generated post or call brief is about their offer rather than a generic one.
CREATE TABLE IF NOT EXISTS business_profile (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  name          TEXT NOT NULL DEFAULT '',
  what_we_sell  TEXT NOT NULL DEFAULT '',
  audience      TEXT NOT NULL DEFAULT '',
  tone          TEXT NOT NULL DEFAULT 'friendly',
  price_toman   INTEGER NOT NULL DEFAULT 0,
  channels_json TEXT NOT NULL DEFAULT '[]',
  cta_url       TEXT,
  notes         TEXT,
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── content pipeline ─────────────────────────────────────────────────────
-- content_pieces above says what a piece is; this says when it goes out and
-- what happened when it did. One row per piece rather than new columns on
-- content_pieces: ALTER TABLE in a re-runnable schema file only works once.
CREATE TABLE IF NOT EXISTS content_schedule (
  content_piece_id INTEGER PRIMARY KEY REFERENCES content_pieces (id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  locale           TEXT NOT NULL DEFAULT 'fa',
  angle            TEXT,
  -- Where a live channel should put it (a Telegram chat id, say). Null means
  -- the adapter has no address for this piece and can only record it.
  target           TEXT,
  due_at           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  produced_by      TEXT NOT NULL DEFAULT 'template',
  published_at     TEXT,
  note             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS content_schedule_due ON content_schedule (status, due_at);

-- ── media production ─────────────────────────────────────────────────────
-- One row per voiceover or ad-video run, whichever half produced it. The row
-- keeps the input and the whole artefact: with no paid account that artefact
-- is the timed script or the storyboard, which is real work on its own, so the
-- ELEVENLABS and HIGGSFIELD nodes count something that exists either way.
CREATE TABLE IF NOT EXISTS media_jobs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL,
  -- rendered | scripted | storyboarded | failed — never 'rendered' without media.
  status       TEXT NOT NULL,
  -- Which adapter answered ('elevenlabs', 'script-only', …), so the UI never guesses.
  adapter      TEXT NOT NULL,
  locale       TEXT NOT NULL DEFAULT 'fa',
  input_json   TEXT NOT NULL,
  output_json  TEXT NOT NULL,
  external_id  TEXT,
  url          TEXT,
  duration_sec REAL,
  at           TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS media_jobs_kind ON media_jobs (kind, id DESC);

-- ── calls ────────────────────────────────────────────────────────────────
-- One row per prepared call. The brief is the work product and exists whether
-- or not a voice provider ever dialled, so `status` is the honest record of
-- what happened: dialled by a provider, simulated (brief only), or failed.
CREATE TABLE IF NOT EXISTS calls (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  provider    TEXT    NOT NULL,
  status      TEXT    NOT NULL,
  external_id TEXT,
  brief_json  TEXT    NOT NULL,
  produced_by TEXT    NOT NULL,
  at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS calls_lead ON calls (lead_id, id DESC);

-- The meeting itself. `start_at` is UTC ISO; the working window that produced
-- it lives in server/domain/booking.ts, never in a column.
CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  start_at   TEXT    NOT NULL,
  minutes    INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'booked',
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS bookings_start ON bookings (status, start_at);
CREATE INDEX IF NOT EXISTS bookings_lead ON bookings (lead_id, id DESC);

CREATE TABLE IF NOT EXISTS call_reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  due_at     TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending',
  sent_at    TEXT
);
CREATE INDEX IF NOT EXISTS call_reminders_due ON call_reminders (status, due_at);

-- One row per lead, ever: the primary key is what makes the referral pass ask
-- exactly once no matter how often the worker runs.
CREATE TABLE IF NOT EXISTS referral_asks (
  lead_id INTEGER PRIMARY KEY REFERENCES leads (id) ON DELETE CASCADE,
  status  TEXT NOT NULL DEFAULT 'pending',
  at      TEXT NOT NULL DEFAULT (datetime('now'))
);
