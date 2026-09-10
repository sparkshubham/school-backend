import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './utils/errors.js';
import { prisma } from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function corsOrigins() {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        const allowed = corsOrigins();
        if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
        return cb(null, true);
      },
      credentials: true,
    })
  );
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

  const health = async (req, res) => {
    let db = 'unknown';
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch (err) {
      db = 'down';
      console.error('Health DB check failed:', err.message);
    }
    const status = db === 'down' ? 503 : 200;
    res.status(status).json({ ok: db !== 'down', name: 'EduNest API', db });
  };

  app.get('/', health);
  app.get('/api/health', health);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', apiRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
