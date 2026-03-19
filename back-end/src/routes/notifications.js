const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require('../controllers/notificationController');

router.use(authMiddleware);

router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

module.exports = router;
