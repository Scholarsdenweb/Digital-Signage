import { Router } from 'express';
import { birthdayTemplateSchema, assignBirthdaySchema, PERMISSIONS } from '@dsm/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import * as birthday from './birthday.service.js';
import { logActivity } from '../activity/activity.service.js';

export const birthdayRouter = Router();
birthdayRouter.use(requireAuth);

// Templates
birthdayRouter.get(
  '/templates',
  asyncHandler(async (_req, res) => res.json(await prisma.birthdayTemplate.findMany())),
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
