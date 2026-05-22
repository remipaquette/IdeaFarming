-- Slice 6: Two-axis Rating

CREATE TYPE effort_level AS ENUM ('low', 'medium', 'high');

CREATE TABLE ratings (
  idea_id         INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  employee_id     INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  business_impact SMALLINT CHECK (business_impact BETWEEN 1 AND 5),
  effort_required effort_level,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (idea_id, employee_id)
);
