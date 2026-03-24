-- Bonificação por membro (projetos de tarefa com um participante por assignee)
CREATE TABLE IF NOT EXISTS project_bonif_participants_ti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  dev_seconds INT DEFAULT 0,
  financial_return TEXT NULL,
  suggested_value DECIMAL(14, 2) NULL,
  awaiting_params TINYINT(1) NOT NULL DEFAULT 1,
  bonif_pending_response ENUM('gestor','dev') NULL,
  gestor_offer_value DECIMAL(14, 2) NULL,
  gestor_offer_installments TINYINT UNSIGNED NULL,
  bonificado TINYINT(1) NOT NULL DEFAULT 0,
  approved_value DECIMAL(14, 2) NULL,
  installment_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
  bonificado_at DATETIME NULL,
  bonificado_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_bonif_user (project_id, user_id),
  KEY idx_project_bonif_proj (project_id),
  KEY idx_project_bonif_user (user_id),
  CONSTRAINT fk_pbp_project FOREIGN KEY (project_id) REFERENCES projects_ti(id) ON DELETE CASCADE,
  CONSTRAINT fk_pbp_user FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE projects_ti ADD COLUMN IF NOT EXISTS collaborative TINYINT(1) NOT NULL DEFAULT 0;

-- 1 assignee (ou nenhum): espelha dados atuais do projeto numa linha de participante
INSERT INTO project_bonif_participants_ti (
  project_id, user_id, dev_seconds, financial_return, suggested_value, awaiting_params,
  bonif_pending_response, gestor_offer_value, gestor_offer_installments,
  bonificado, approved_value, installment_count, bonificado_at, bonificado_by
)
SELECT
  p.id,
  COALESCE(
    p.responsible_id,
    (SELECT MIN(ta.user_id) FROM task_assignees_ti ta WHERE ta.task_id = p.source_task_id)
  ),
  p.dev_seconds,
  p.financial_return,
  p.suggested_value,
  p.awaiting_params,
  p.bonif_pending_response,
  p.gestor_offer_value,
  p.gestor_offer_installments,
  p.bonificado,
  p.approved_value,
  COALESCE(p.installment_count, 1),
  p.bonificado_at,
  p.bonificado_by
FROM projects_ti p
WHERE p.source_task_id IS NOT NULL
  AND (SELECT COUNT(*) FROM task_assignees_ti ta WHERE ta.task_id = p.source_task_id) <= 1
  AND NOT EXISTS (SELECT 1 FROM project_bonif_participants_ti x WHERE x.project_id = p.id);

-- 2+ assignees: uma linha por pessoa (valor sugerido legado dividido entre o time como referência)
INSERT INTO project_bonif_participants_ti (
  project_id, user_id, dev_seconds, financial_return, suggested_value, awaiting_params,
  bonif_pending_response, gestor_offer_value, gestor_offer_installments,
  bonificado, approved_value, installment_count, bonificado_at, bonificado_by
)
SELECT
  p.id,
  ta.user_id,
  COALESCE(tut.dev_seconds, 0),
  p.financial_return,
  CASE WHEN p.suggested_value IS NOT NULL THEN ROUND(p.suggested_value / ac.c, 2) ELSE NULL END,
  p.awaiting_params,
  NULL,
  NULL,
  NULL,
  0,
  NULL,
  1,
  NULL,
  NULL
FROM projects_ti p
INNER JOIN task_assignees_ti ta ON ta.task_id = p.source_task_id
INNER JOIN (
  SELECT task_id, COUNT(*) AS c
  FROM task_assignees_ti
  GROUP BY task_id
  HAVING c >= 2
) ac ON ac.task_id = p.source_task_id
LEFT JOIN task_user_timers_ti tut ON tut.task_id = p.source_task_id AND tut.user_id = ta.user_id
WHERE p.source_task_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM project_bonif_participants_ti x WHERE x.project_id = p.id AND x.user_id = ta.user_id
  );

-- Marca colaborativo e agrega flags no projeto (fonte de verdade passa a ser os participantes)
UPDATE projects_ti p
SET collaborative = IF(
  (SELECT COUNT(*) FROM project_bonif_participants_ti bp WHERE bp.project_id = p.id) > 1,
  1,
  0
)
WHERE p.source_task_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM project_bonif_participants_ti bp WHERE bp.project_id = p.id);

UPDATE projects_ti p
INNER JOIN (
  SELECT
    project_id,
    MAX(awaiting_params) AS any_awaiting,
    MIN(bonificado) AS all_bonif
  FROM project_bonif_participants_ti
  GROUP BY project_id
) agg ON agg.project_id = p.id
SET
  p.awaiting_params = agg.any_awaiting,
  p.bonificado = IF(agg.all_bonif = 1, 1, 0),
  p.suggested_value = NULL,
  p.financial_return = NULL,
  p.bonif_pending_response = NULL,
  p.gestor_offer_value = NULL,
  p.gestor_offer_installments = NULL,
  p.approved_value = NULL,
  p.installment_count = 1,
  p.bonificado_at = NULL,
  p.bonificado_by = NULL
WHERE p.source_task_id IS NOT NULL;
