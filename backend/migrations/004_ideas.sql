-- Slice 4: Idea Submission & Viewing

CREATE TABLE ideas (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  submitter_id INTEGER NOT NULL REFERENCES employees(id),
  anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  image_url    TEXT,
  archived     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
