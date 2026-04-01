const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const {
  getTodayStats,
  getAllTasks,
  createTask,
  updateTask,
  completeTask,
  pauseTask,
  resumeTask,
  deleteTask,
  fixTaskTimer,
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

const taskStatuses = ['pending', 'paused', 'overdue', 'completed'];

router.get(
  '/',
  [
    query('date').optional({ checkFalsy: true }).isISO8601(),
    query('status').optional().isIn(taskStatuses),
  ],
  handleValidation,
  getAllTasks
);
router.post(
  '/',
  denyRH,
  [
    body('title').trim().isLength({ min: 1, max: 500 }),
    body('due_date').notEmpty(),
    body('assignees').isArray({ min: 1 }),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('category_id').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  handleValidation,
  createTask
);
router.put(
  '/:id',
  denyRH,
  [
    param('id').isInt({ min: 1 }),
    body('title').optional().trim().isLength({ min: 1, max: 500 }),
    body('status').optional().isIn(taskStatuses),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('category_id').optional({ nullable: true }).isInt({ min: 1 }),
  ],
  handleValidation,
  updateTask
);
router.patch('/:id/complete', denyRH, [param('id').isInt({ min: 1 })], handleValidation, completeTask);
router.patch('/:id/pause', denyRH, [param('id').isInt({ min: 1 })], handleValidation, pauseTask);
router.patch('/:id/resume', denyRH, [param('id').isInt({ min: 1 })], handleValidation, resumeTask);
router.patch('/:id/fix-timer', [param('id').isInt({ min: 1 })], handleValidation, fixTaskTimer);
router.delete('/:id', denyRH, [param('id').isInt({ min: 1 })], handleValidation, deleteTask);

module.exports = router;
