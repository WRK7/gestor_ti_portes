require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const projectRoutes = require('./routes/projects');
const userRoutes = require('./routes/users');
const managerRoutes = require('./routes/manager');
const logRoutes     = require('./routes/logs');
const notifRoutes   = require('./routes/notifications');

const app = express();

const defaultDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const explicitOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = explicitOrigins.length > 0 ? explicitOrigins : defaultDevOrigins;

/** Permite front em IP de rede local (ex.: http://10.x.x.x:5292) sem listar cada URL. */
const isPrivateLanOrigin = (origin) => {
  try {
    const u = new URL(origin);
    const h = u.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (/^10\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    const m = h.match(/^172\.(\d+)\./);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 16 && n <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
};

const allowLan =
  process.env.CORS_ALLOW_LAN === 'true' ||
  (process.env.CORS_ALLOW_LAN !== 'false' && process.env.NODE_ENV !== 'production');

const corsOptions = {
  origin: (origin, callback) => {
    // Allows non-browser requests (curl/Postman) and same-origin calls.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (allowLan && isPrivateLanOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origem não permitida pelo CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

app.use(cors({
  ...corsOptions,
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cookieParser());
app.use('/api', apiLimiter);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/logs',    logRoutes);
app.use('/api/notifications', notifRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  if (err && err.message === 'Origem não permitida pelo CORS') {
    return res.status(403).json({ error: 'Origem não permitida' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

module.exports = app;
