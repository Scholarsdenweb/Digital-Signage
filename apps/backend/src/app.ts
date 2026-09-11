import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { screensRouter } from './modules/screens/screens.routes.js';
import { devicesRouter } from './modules/devices/devices.routes.js';
import { groupsRouter } from './modules/groups/groups.routes.js';
import { contentRouter } from './modules/content/content.routes.js';
import { historyRouter } from './modules/history/history.routes.js';
import { studentsRouter } from './modules/students/students.routes.js';
import { birthdayRouter } from './modules/birthday/birthday.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { mediaRouter } from './modules/media/media.routes.js';

export function createApp() {
  const app = express();

  // Behind one reverse proxy (nginx/Caddy). Trust it so req.ip and the rate-limiter
  // use the real client IP from X-Forwarded-For. The backend is never exposed
  // directly to the internet in either deploy topology, so trusting 1 hop is safe.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // media served to player origin
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(generalLimiter);

  app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // Media proxy (local provider) — before API auth, opaque contentId URLs.
  app.use('/media', mediaRouter);

  // REST API
  app.use('/auth', authRouter);
  app.use('/users', usersRouter);
  app.use('/screens', screensRouter);
  app.use('/devices', devicesRouter);
  app.use('/screen-groups', groupsRouter);
  app.use('/content', contentRouter);
  app.use('/history', historyRouter);
  app.use('/students', studentsRouter);
  app.use('/birthday', birthdayRouter);
  app.use('/dashboard', dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
