CREATE TABLE IF NOT EXISTS projects_ti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('in_progress', 'completed', 'on_hold', 'cancelled') DEFAULT 'completed',
  link VARCHAR(1000) NULL,
  progress TINYINT UNSIGNED DEFAULT 100,
  dev_seconds INT DEFAULT 0,
  financial_return TEXT NULL,
  suggested_value DECIMAL(14, 2) NULL,
  responsible_id INT NULL,
  created_by INT NULL,
  awaiting_params TINYINT(1) NOT NULL DEFAULT 1,
  bonificado TINYINT(1) NOT NULL DEFAULT 0,
  bonificado_at DATETIME NULL,
  bonificado_by INT NULL,
  source_task_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE projects_ti MODIFY COLUMN financial_return TEXT NULL;
ALTER TABLE projects_ti MODIFY COLUMN suggested_value DECIMAL(14, 2) NULL;
