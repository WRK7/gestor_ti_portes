# Copiar usuários do banco antigo para gestor_ti_app

Se o banco antigo (`gestor_tarefas`) ainda está no mesmo servidor, rode no MySQL/MariaDB:

```sql
INSERT INTO gestor_ti_app.users
  (id, username, password, name, role, active, created_at, updated_at, approved_at, approved_by_id, authorizationStatus, rejected_at, reject_reason, requested_at)
SELECT id, username, password, name, role, active, created_at, updated_at, approved_at, approved_by_id, authorizationStatus, rejected_at, reject_reason, requested_at
FROM gestor_tarefas.users;
```

Depois reinicie o back-end. Se o banco novo foi criado do zero, rode as migrations primeiro (subir o servidor uma vez), depois execute o INSERT acima.
