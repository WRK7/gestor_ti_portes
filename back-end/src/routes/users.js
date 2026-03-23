const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { getAllUsers, createUser, updateUser, deleteUser, toggleActive } = require('../controllers/userController');

const ROLES = ['superadmin', 'admin', 'gestor', 'dev', 'suporte', 'rh'];

router.use(authMiddleware);

const requireManager = (req, res, next) => {
  if (!['superadmin', 'admin', 'gestor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão para esta ação' });
  }
  next();
};

router.get('/', requireManager, getAllUsers);
router.post(
  '/',
  requireManager,
  [
    body('username').trim().isLength({ min: 3, max: 80 }).withMessage('Usuário deve ter entre 3 e 80 caracteres'),
    body('password').isLength({ min: 6, max: 128 }).withMessage('Senha deve ter entre 6 e 128 caracteres'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('E-mail inválido'),
    body('name').optional().trim().isLength({ max: 255 }).withMessage('Nome muito longo (máx. 255 caracteres)'),
    body('role').optional().isIn(ROLES).withMessage('Cargo inválido'),
  ],
  handleValidation,
  createUser
);
router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('ID inválido'),
    body('name').optional().trim().isLength({ max: 255 }).withMessage('Nome muito longo (máx. 255 caracteres)'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('E-mail inválido'),
    body('role').optional().isIn(ROLES).withMessage('Cargo inválido'),
    body('active').optional().isIn([0, 1, true, false]).withMessage('Status ativo inválido'),
    // Só valida tamanho se o usuário digitou algo; vazio = manter senha atual
    body('password').optional({ checkFalsy: true }).isLength({ min: 6, max: 128 }).withMessage('Nova senha deve ter entre 6 e 128 caracteres'),
  ],
  handleValidation,
  updateUser
);
router.patch('/:id/toggle-active', requireManager, [param('id').isInt({ min: 1 })], handleValidation, toggleActive);
router.delete('/:id', requireManager, [param('id').isInt({ min: 1 })], handleValidation, deleteUser);

module.exports = router;
