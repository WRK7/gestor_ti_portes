ALTER TABLE users MODIFY COLUMN role ENUM('superadmin', 'admin', 'gestor', 'dev', 'suporte', 'rh') DEFAULT 'dev';
