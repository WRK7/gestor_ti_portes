const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { login, me, refresh, logout } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.REFRESH_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em instantes.' },
});

const validateLogin = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 80 })
    .withMessage('Usuário inválido'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Senha inválida'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Dados de login inválidos' });
    }
    return next();
  },
];

router.post('/login', loginLimiter, validateLogin, login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);

module.exports = router;
