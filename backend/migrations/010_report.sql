-- Slice 12: Report

CREATE TABLE reports (
  id                  SERIAL PRIMARY KEY,
  challenge_id        INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  problem_description TEXT    NOT NULL DEFAULT '',
  expected_benefits   TEXT    NOT NULL DEFAULT '',
  main_tasks          TEXT    NOT NULL DEFAULT '',
  results             TEXT    NOT NULL DEFAULT '',
  next_steps          TEXT    NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id)
);

CREATE TABLE report_idea_refs (
  id        SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  idea_id   INTEGER NOT NULL REFERENCES ideas(id)   ON DELETE CASCADE,
  UNIQUE (report_id, idea_id)
);

CREATE TABLE report_challenge_refs (
  id           SERIAL PRIMARY KEY,
  report_id    INTEGER NOT NULL REFERENCES reports(id)    ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  UNIQUE (report_id, challenge_id)
);

-- Backfill: one Report per existing Challenge
INSERT INTO reports (challenge_id)
SELECT id FROM challenges;
