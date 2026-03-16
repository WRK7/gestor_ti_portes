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

router.get('/stats/today', getTodayStats);
router.get('/categories', getCategories);
router.get('/users', getUsers);

router.get('/', getAllTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id/complete', completeTask);
router.patch('/:id/pause', pauseTask);
router.patch('/:id/resume', resumeTask);
router.delete('/:id', deleteTask);

module.exports = router;
