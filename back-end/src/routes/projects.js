const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getAllProjects,
  getProjectById,
  createProject,
  createFromTask,
  updateProject,
  deleteProject,
  getStats,
  getMonthlyStats,
  getMonthlyByUser,
  getPendingByUser,
  toggleBonificado,
  getBillingReport,
} = require('../controllers/projectController');

router.use(authMiddleware);

const denyRH = (req, res, next) => {
  if (req.user.role === 'rh') return res.status(403).json({ error: 'RH não tem permissão para esta ação' });
  next();
};

router.get('/stats',           getStats);
router.get('/stats/monthly',   getMonthlyStats);
router.get('/stats/by-user',   getMonthlyByUser);
router.get('/pending-by-user', getPendingByUser);
router.get('/billing',         getBillingReport);
router.post('/from-task/:taskId', denyRH, createFromTask);
router.get('/',    getAllProjects);
router.get('/:id', getProjectById);
router.post('/',   denyRH, createProject);
router.put('/:id', denyRH, updateProject);
router.patch('/:id/bonificar', toggleBonificado);
router.delete('/:id', denyRH, deleteProject);

module.exports = router;
