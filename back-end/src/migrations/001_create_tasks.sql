CREATE TABLE IF NOT EXISTS task_categories_ti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#6B7280',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks_ti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('pending', 'paused', 'completed', 'overdue') DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  due_date DATETIME NOT NULL,
  completed_at DATETIME NULL,
  dev_seconds INT DEFAULT 0,
  timer_started_at DATETIME NULL,
  assigned_to INT NULL,
  created_by INT NULL,
  category_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_assignees_ti (
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, user_id)
);

INSERT IGNORE INTO task_categories_ti (name, color) VALUES
  ('Infraestrutura', '#3B82F6'),
  ('Suporte', '#10B981'),
  ('Desenvolvimento', '#8B5CF6'),
  ('Segurança', '#EF4444'),
  ('Reunião', '#F59E0B'),
  ('Documentação', '#6B7280');

ALTER TABLE tasks_ti MODIFY COLUMN status ENUM('pending', 'paused', 'completed', 'overdue') DEFAULT 'pending';
