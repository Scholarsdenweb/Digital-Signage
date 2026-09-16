import { Router } from 'express';
import { birthdayTemplateSchema, assignBirthdaySchema, PERMISSIONS } from '@dsm/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import { uploadLimiter } from '../../middleware/rateLimit.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../storage/index.js';
import { storeUploadedMedia } from '../media/media.service.js';
import * as birthday from './birthday.service.js';
import { logActivity } from '../activity/activity.service.js';

export const birthdayRouter = Router();
birthdayRouter.use(requireAuth);

// Resolve each template's background image URL (if it has one uploaded).
async function withBackgroundUrl(t: { design: unknown }) {
  const design = (t.design ?? {}) as Record<string, unknown>;
  let backgroundUrl: string | null = null;
  if (typeof design.backgroundMediaObjectId === 'string') {
    const m = await prisma.mediaObject.findUnique({ where: { id: design.backgroundMediaObjectId } });
    if (m) backgroundUrl = await storage().resolveUrl(m.storageKey, `bg-${m.id}`);
  }
  return { ...t, backgroundUrl };
}

// Templates
birthdayRouter.get(
  '/templates',
  asyncHandler(async (_req, res) => {
    const tpls = await prisma.birthdayTemplate.findMany();
    res.json(await Promise.all(tpls.map(withBackgroundUrl)));
  }),
);

// Upload the exact birthday background image for a template (player overlays name/date).
birthdayRouter.post(
  '/templates/:id/background',
  requirePermission(PERMISSIONS.MANAGE_BIRTHDAY_TEMPLATES),
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const tpl = await prisma.birthdayTemplate.findUnique({ where: { id: req.params.id } });
    if (!tpl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
    const mediaObjectId = await storeUploadedMedia(req.file as never);
    const design = { ...((tpl.design ?? {}) as Record<string, unknown>), backgroundMediaObjectId: mediaObjectId };
    const updated = await prisma.birthdayTemplate.update({ where: { id: tpl.id }, data: { design } });
    await logActivity({ actorId: req.auth!.userId, action: 'BIRTHDAY_TEMPLATE_BACKGROUND', entityType: 'BirthdayTemplate', entityId: tpl.id });
    res.json(await withBackgroundUrl(updated));
  }),
);
birthdayRouter.post(
  '/templates',
  requirePermission(PERMISSIONS.MANAGE_BIRTHDAY_TEMPLATES),
  validateBody(birthdayTemplateSchema),
  asyncHandler(async (req, res) => {
    if (req.body.isDefault) await prisma.birthdayTemplate.updateMany({ data: { isDefault: false } });
    res.status(201).json(await prisma.birthdayTemplate.create({ data: req.body }));
  }),
);
birthdayRouter.patch(
  '/templates/:id',
  requirePermission(PERMISSIONS.MANAGE_BIRTHDAY_TEMPLATES),
  validateBody(birthdayTemplateSchema.partial()),
  asyncHandler(async (req, res) => {
    if (req.body.isDefault) await prisma.birthdayTemplate.updateMany({ data: { isDefault: false } });
    res.json(await prisma.birthdayTemplate.update({ where: { id: req.params.id }, data: req.body }));
  }),
);

// Today's birthdays (instances)
birthdayRouter.get(
  '/today',
  asyncHandler(async (_req, res) => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    res.json(
      await prisma.birthdayInstance.findMany({
        where: { forDate: start },
        include: { student: true, content: true },
      }),
    );
  }),
);

// Manual generation trigger (also runs automatically via scheduler)
birthdayRouter.post(
  '/generate',
  requirePermission(PERMISSIONS.MANAGE_BIRTHDAY_TEMPLATES),
  asyncHandler(async (req, res) => {
    // Manual trigger forces a fresh re-render (picks up template/design changes).
    const instances = await birthday.generateForDate(undefined, true);
    await logActivity({ actorId: req.auth!.userId, action: 'BIRTHDAY_GENERATE', metadata: { count: instances.length } });
    res.json({ ok: true, count: instances.length });
  }),
);

// Assign today's birthday content to screens / groups
birthdayRouter.post(
  '/assign',
  requirePermission(PERMISSIONS.MANAGE_BIRTHDAY_TEMPLATES),
  validateBody(assignBirthdaySchema),
  asyncHandler(async (req, res) => {
    const result = await birthday.assignToday(req.body.screenIds, req.body.screenGroupIds);
    await logActivity({ actorId: req.auth!.userId, action: 'BIRTHDAY_ASSIGN', metadata: result });
    res.json({ ok: true, ...result });
  }),
);
