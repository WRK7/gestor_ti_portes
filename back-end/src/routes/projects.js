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
} = require('../controllers/projectController');

router.use(authMiddleware);

router.get('/stats',          getStats);
router.get('/stats/monthly',  getMonthlyStats);
router.get('/stats/by-user',  getMonthlyByUser);
router.get('/pending-by-user', getPendingByUser);
router.post('/from-task/:taskId', createFromTask);
router.get('/',    getAllProjects);
router.get('/:id', getProjectById);
router.post('/',   createProject);
router.put('/:id', updateProject);
router.patch('/:id/bonificar', toggleBonificado);
router.delete('/:id', deleteProject);

module.exports = router;
