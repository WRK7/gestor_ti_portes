CREATE TABLE IF NOT EXISTS logs_ti (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  actor_id    INT NULL,
  actor_name  VARCHAR(255) NULL,
  actor_role  VARCHAR(50) NULL,
  action      VARCHAR(80) NOT NULL,
  entity      VARCHAR(50) NOT NULL,
  entity_id   INT NULL,
  entity_name VARCHAR(255) NULL,
  detail      TEXT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE projects_ti ADD COLUMN IF NOT EXISTS approved_value DECIMAL(14,2) NULL;
