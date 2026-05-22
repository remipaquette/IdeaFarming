-- Slice 9: Innovation Day Lifecycle

-- Expand innovation_days stub (created in migration 007)
ALTER TABLE innovation_days
  ADD COLUMN name          TEXT    NOT NULL DEFAULT 'Unnamed',
  ADD COLUMN date          DATE    NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN description   TEXT    NOT NULL DEFAULT '',
  ADD COLUMN team_size_cap INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN status        TEXT    NOT NULL DEFAULT 'draft'
             CHECK (status IN ('draft', 'open', 'in_progress', 'completed'));

-- Expand challenges stub (created in migration 007)
ALTER TABLE challenges
  ADD COLUMN challenge_type TEXT    NOT NULL DEFAULT 'implementation_of_improvements'
             CHECK (challenge_type IN (
               'implementation_of_improvements',
               'experimentation_and_exploration',
               'problem_solving_and_brainstorming'
             )),
  ADD COLUMN framing        TEXT,
  ADD COLUMN promoted_by    INTEGER REFERENCES employees(id),
  ADD COLUMN featured       BOOLEAN NOT NULL DEFAULT FALSE;

-- Unique: one Challenge per Idea per Innovation Day
ALTER TABLE challenges
  ADD CONSTRAINT challenges_idea_innovation_day_unique UNIQUE (idea_id, innovation_day_id);

-- Team members table (stub; used for team size cap enforcement and Challenge pruning)
CREATE TABLE team_members (
  id           SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, employee_id)
);
