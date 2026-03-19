const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getAllUsers, createUser, updateUser, deleteUser, toggleActive } = require('../controllers/userController');

router.use(authMiddleware);

const requireManager = (req, res, next) => {
  if (!['superadmin', 'admin', 'gestor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Sem permissão para esta ação' });
  }
  next();
};

router.get('/', getAllUsers);
router.post('/', requireManager, createUser);
router.put('/:id', updateUser);
router.patch('/:id/toggle-active', requireManager, toggleActive);
router.delete('/:id', requireManager, deleteUser);

module.exports = router;
