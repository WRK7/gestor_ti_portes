-- Negociação de bonificação (turnos gestor/dev) e parcelamento do valor aprovado
ALTER TABLE projects_ti ADD COLUMN IF NOT EXISTS bonif_pending_response ENUM('gestor','dev') NULL;
ALTER TABLE projects_ti ADD COLUMN IF NOT EXISTS gestor_offer_value DECIMAL(14, 2) NULL;
ALTER TABLE projects_ti ADD COLUMN IF NOT EXISTS gestor_offer_installments TINYINT UNSIGNED NULL;
ALTER TABLE projects_ti ADD COLUMN IF NOT EXISTS installment_count TINYINT UNSIGNED NOT NULL DEFAULT 1;

UPDATE projects_ti SET bonif_pending_response = 'gestor' WHERE awaiting_params = 0 AND bonificado = 0 AND bonif_pending_response IS NULL;
