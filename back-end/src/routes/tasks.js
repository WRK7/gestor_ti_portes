const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getTodayStats,
  getAllTasks,
  createTask,
  updateTask,
  completeTask,
  pauseTask,
  resumeTask,
  deleteTask,
  getCategories,
  getUsers,
} = require('../controllers/taskController');

router.use(authMiddleware);

const denyRH = (req, res, next) => {
  if (req.user.role === 'rh') return res.status(403).json({ error: 'RH não tem permissão para esta ação' });
  next();
};

router.get('/stats/today', getTodayStats);
router.get('/categories', getCategories);
router.get('/users', getUsers);

router.get('/', getAllTasks);
router.post('/', denyRH, createTask);
router.put('/:id', denyRH, updateTask);
router.patch('/:id/complete', denyRH, completeTask);
router.patch('/:id/pause', denyRH, pauseTask);
router.patch('/:id/resume', denyRH, resumeTask);
router.delete('/:id', denyRH, deleteTask);

module.exports = router;
