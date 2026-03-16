const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getAllUsers, createUser, updateUser, deleteUser, toggleActive } = require('../controllers/userController');

router.use(authMiddleware);

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.patch('/:id/toggle-active', toggleActive);
router.delete('/:id', deleteUser);

module.exports = router;
