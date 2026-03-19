ALTER TABLE users MODIFY COLUMN role ENUM('superadmin', 'admin', 'gestor', 'dev', 'suporte', 'rh') DEFAULT 'dev';

-- Conta criada pelo seed (000_seed_admin): promove de admin → superadmin após o ENUM aceitar o valor
UPDATE users SET role = 'superadmin'
WHERE email = 'wesleyc09gomes@gmail.com'
  AND username = 'Wesley Cruz'
  AND role = 'admin';
