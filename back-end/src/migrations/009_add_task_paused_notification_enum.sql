-- Adiciona tipo de notificação para tarefa pausada (com motivo)
ALTER TABLE notifications_ti
  MODIFY COLUMN type ENUM(
    'bonif_pending',
    'bonif_ready',
    'bonif_approved',
    'task_overdue',
    'task_assigned',
    'task_paused'
  ) NOT NULL;
