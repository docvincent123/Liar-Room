CREATE TABLE IF NOT EXISTS rooms (
 code TEXT PRIMARY KEY CHECK (code ~ '^[A-Z2-9]{6}$'),
 state JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY,
 room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 player_id TEXT NOT NULL,
 UNIQUE(room_code, player_id)
);
CREATE INDEX IF NOT EXISTS rooms_expiry ON rooms(expires_at);
