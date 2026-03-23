const { validationResult } = require('express-validator');

/**
 * Retorna 400 com a primeira mensagem de validação (e lista opcional em `details`).
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const list = errors.array();
    const first = list[0];
    return res.status(400).json({
      error: first?.msg || 'Dados inválidos',
      details: list.map((e) => ({ field: e.path, msg: e.msg })),
    });
  }
  return next();
};

module.exports = { handleValidation };
