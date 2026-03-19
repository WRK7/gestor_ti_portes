CREATE TABLE IF NOT EXISTS notifications_ti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('bonif_pending','bonif_ready','bonif_approved','task_overdue','task_assigned') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications_ti (user_id, is_read, created_at DESC);
