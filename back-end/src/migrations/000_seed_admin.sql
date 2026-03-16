INSERT IGNORE INTO users (username, email, password, name, role, active, authorizationStatus, approved_at)
VALUES (
  'Wesley Cruz',
  'wesleyc09gomes@gmail.com',
  '$2b$10$8xFsrnz.TIfbFm1ktZmWbOBopRssfJYxYujc.c5ecRIucFwg6cBj6',
  'Wesley Cruz',
  'admin',
  1,
  'approved',
  NOW()
);
