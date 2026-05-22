-- Slice 8: Idea Discovery — Search, Filter, Sort

-- Full-text search vector on ideas (title + description)
ALTER TABLE ideas ADD COLUMN search_vector tsvector;

UPDATE ideas
SET search_vector = to_tsvector('english', title || ' ' || description);

CREATE INDEX ideas_search_vector_idx ON ideas USING GIN (search_vector);

-- Keep search_vector in sync via trigger
CREATE FUNCTION ideas_update_search_vector() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.title || ' ' || NEW.description);
  RETURN NEW;
END;
$$;

CREATE TRIGGER ideas_tsvector_update
  BEFORE INSERT OR UPDATE OF title, description ON ideas
  FOR EACH ROW EXECUTE FUNCTION ideas_update_search_vector();

-- Stub tables for promotion-status filter (columns expanded by future Challenge/Innovation Day slices)
CREATE TABLE innovation_days (
  id         SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE challenges (
  id                SERIAL PRIMARY KEY,
  idea_id           INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  innovation_day_id INTEGER NOT NULL REFERENCES innovation_days(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
