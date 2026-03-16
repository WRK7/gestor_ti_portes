CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role ENUM('admin', 'dev', 'suporte', 'gestor') DEFAULT 'dev',
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  approved_at DATETIME NULL,
  approved_by_id INT NULL,
  authorizationStatus VARCHAR(50) DEFAULT 'approved',
  rejected_at DATETIME NULL,
  reject_reason TEXT NULL,
  requested_at DATETIME NULL,
  UNIQUE KEY (username),
  UNIQUE KEY (email)
);
