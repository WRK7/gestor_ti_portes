const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getDashboard } = require('../controllers/managerController');

router.use(authMiddleware);

// Only gestor or admin may call these routes
router.use((req, res, next) => {
  if (!['gestor', 'admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso restrito a gestores e admins' });
  }
  next();
});

router.get('/dashboard', getDashboard);

module.exports = router;
