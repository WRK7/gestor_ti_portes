const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const {
  getAllProjects,
  getProjectById,
  createProject,
  createFromTask,
  updateProject,
  updateParticipant,
  deleteProject,
  getStats,
  getMonthlyStats,
  getMonthlyByUser,
  getPendingByUser,
  bonificarAction,
  getBillingReport,
} = require('../controllers/projectController');

router.use(authMiddleware);

const denyRH = (req, res, next) => {
  if (req.user.role === 'rh') return res.status(403).json({ error: 'RH não tem permissão para esta ação' });
  next();
};

router.get('/stats', getStats);
router.get('/stats/monthly', getMonthlyStats);
router.get('/stats/by-user', getMonthlyByUser);
router.get(
  '/pending-by-user',
  [query('user_id').optional().isInt({ min: 1 })],
  handleValidation,
  getPendingByUser
);
router.get(
  '/billing',
  [
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('year').optional().isInt({ min: 2000, max: 2100 }),
    query('responsible_id').optional().isInt({ min: 1 }),
  ],
  handleValidation,
  getBillingReport
);
router.post(
  '/from-task/:taskId',
  denyRH,
  [param('taskId').isInt({ min: 1 })],
  handleValidation,
  createFromTask
);
router.get('/', getAllProjects);
router.get('/:id', [param('id').isInt({ min: 1 })], handleValidation, getProjectById);
router.post(
  '/',
  denyRH,
  [body('name').trim().isLength({ min: 1, max: 255 })],
  handleValidation,
  createProject
);
router.put(
  '/:id/participants/:participantId',
  denyRH,
  [
    param('id').isInt({ min: 1 }),
    param('participantId').isInt({ min: 1 }),
  ],
  handleValidation,
  updateParticipant
);
router.put(
  '/:id',
  denyRH,
  [param('id').isInt({ min: 1 })],
  handleValidation,
  updateProject
);
router.patch(
  '/:id/bonificar',
  [
    param('id').isInt({ min: 1 }),
    body('action')
      .isIn(['gestor_accept_dev', 'gestor_propose', 'dev_accept', 'dev_counter'])
      .withMessage('Ação inválida'),
    body('approved_value').optional().isFloat({ min: 0 }),
    body('installment_count').optional().isInt({ min: 1, max: 12 }),
    body('participant_id').optional().isInt({ min: 1 }),
  ],
  handleValidation,
  bonificarAction
);
router.delete('/:id', denyRH, [param('id').isInt({ min: 1 })], handleValidation, deleteProject);

module.exports = router;
