ALTER TABLE tasks_ti
  ADD COLUMN IF NOT EXISTS pause_reason VARCHAR(500) NULL AFTER timer_started_at;
