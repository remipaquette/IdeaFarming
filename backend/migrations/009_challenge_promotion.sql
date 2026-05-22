-- Slice 10: Challenge Promotion

-- Notifications table (used by Challenge promotion trigger and future notification slices)
CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  payload     JSONB   NOT NULL DEFAULT '{}',
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_employee_id_idx ON notifications (employee_id);
CREATE INDEX notifications_employee_read_idx ON notifications (employee_id, read);
