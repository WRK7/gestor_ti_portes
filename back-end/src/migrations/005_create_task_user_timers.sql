CREATE TABLE IF NOT EXISTS task_user_timers_ti (
  task_id          INT NOT NULL,
  user_id          INT NOT NULL,
  dev_seconds      INT DEFAULT 0,
  timer_started_at DATETIME NULL,
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (task_id) REFERENCES tasks_ti(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Populate from existing data: for each assignee, copy the task-level timer info.
-- If task has a running timer, only the first assignee gets it; others start paused.
INSERT IGNORE INTO task_user_timers_ti (task_id, user_id, dev_seconds, timer_started_at)
SELECT
  ta.task_id,
  ta.user_id,
  CASE
    WHEN ta.user_id = (SELECT MIN(ta2.user_id) FROM task_assignees_ti ta2 WHERE ta2.task_id = ta.task_id)
    THEN t.dev_seconds
    ELSE 0
  END,
  CASE
    WHEN ta.user_id = (SELECT MIN(ta2.user_id) FROM task_assignees_ti ta2 WHERE ta2.task_id = ta.task_id)
    THEN t.timer_started_at
    ELSE NULL
  END
FROM task_assignees_ti ta
JOIN tasks_ti t ON t.id = ta.task_id;
