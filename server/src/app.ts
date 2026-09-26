import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { ensureDatabase } from './db/bootstrap.js';
import { env } from './env.js';
import { HttpError } from './lib/errors.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { configRouter } from './routes/config.js';
import { merchantRouter } from './routes/merchant.js';
import { ordersRouter } from './routes/orders.js';
import { realtimeRouter } from './routes/realtime.js';
import { runnerRouter } from './routes/runner.js';
import { shopsRouter } from './routes/shops.js';
import { uploadsRouter } from './routes/uploads.js';
import { usersRouter } from './routes/users.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // the API is consumed by a separate origin during development
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = [
          ...env.corsOrigins,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ];
        // same-origin requests and the Vercel preview/production hosts are fine
        if (allowed.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.e2b.app')) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    }),
  );
  if (!env.isProduction) app.use(morgan('dev'));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Everything under /api makes sure the schema (and demo data) is in place first.
  app.use('/api', (req, _res, next) => {
    if (req.path === '/health') return next();
    ensureDatabase().then(() => next()).catch(next);
  });

  app.use('/api', configRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/shops', shopsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/merchant', merchantRouter);
  app.use('/api/runner', runnerRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/realtime', realtimeRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, error: 'Unknown API route', code: 'not_found' });
  });

  // When the built client is present (`npm start` after `npm run build`) the same
  // process serves the app, so the whole product runs on one port.
  const clientDist = path.resolve(here, '..', '..', 'client', 'dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ ok: false, error: error.message, code: error.code, details: error.details });
      return;
    }
    const message = error instanceof Error ? error.message : 'Something went wrong';
    if (/duplicate key|unique constraint/i.test(message)) {
      res.status(409).json({ ok: false, error: 'That record already exists', code: 'conflict' });
      return;
    }
    console.error('[qareeb] unhandled error:', error);
    res.status(500).json({
      ok: false,
      error: env.isProduction ? 'The server hit an unexpected error' : message,
      code: 'server_error',
    });
  });

  return app;
}
