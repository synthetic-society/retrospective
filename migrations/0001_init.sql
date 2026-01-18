-- Sessions (retro boards)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);

-- Cards (sticky notes)
CREATE TABLE cards (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  column_type TEXT CHECK (column_type IN ('glad', 'wondering', 'sad', 'action')) NOT NULL,
  content TEXT NOT NULL,
  votes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Votes (prevent double-voting)
CREATE TABLE votes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  UNIQUE(card_id, voter_id)
);

-- Indexes for performance
CREATE INDEX idx_cards_session ON cards(session_id);
CREATE INDEX idx_votes_card ON votes(card_id);
CREATE INDEX idx_votes_voter ON votes(voter_id);
