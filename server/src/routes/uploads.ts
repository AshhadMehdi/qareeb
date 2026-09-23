import { Router } from 'express';
import multer from 'multer';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { uploadedImages } from '../db/schema.js';
import { env } from '../env.js';
import { authUser, requireAuth } from '../lib/auth.js';
import { asyncHandler, badRequest, notFound, ok } from '../lib/errors.js';
import { newId } from '../lib/ids.js';

export const uploadsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      callback(badRequest('Only JPEG, PNG, WebP and GIF images are supported'));
      return;
    }
    callback(null, true);
  },
});

uploadsRouter.post(
  '/',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest('Attach an image under the "file" field');
    const db = await getDb();
    const id = newId();
    await db.insert(uploadedImages).values({
      id,
      userId: authUser(req).id,
      mime: file.mimetype,
      // base64 keeps Vercel to one service: no bucket, no extra credentials
      data: file.buffer.toString('base64'),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(ok({ id, url: `/api/uploads/${id}`, bytes: file.size, mime: file.mimetype }));
  }),
);

uploadsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const [row] = await db.select().from(uploadedImages).where(eq(uploadedImages.id, String(req.params.id))).limit(1);
    if (!row) throw notFound('Image not found');
    res.setHeader('Content-Type', row.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(row.data, 'base64'));
  }),
);
