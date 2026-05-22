-- Slice 7: Threaded Comments

CREATE TABLE comments (
  id          SERIAL PRIMARY KEY,
  idea_id     INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  parent_id   INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- parent_id is NULL for top-level comments; non-NULL for replies (one level deep only)
-- Nesting depth enforced at the application layer (cannot reply to a reply)
