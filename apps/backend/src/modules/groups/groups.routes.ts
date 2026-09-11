import { Router } from 'express';
import { z } from 'zod';
import { screenGroupSchema, PERMISSIONS } from '@dsm/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { NotFound } from '../../lib/errors.js';

export const groupsRouter = Router();
groupsRouter.use(requireAuth);

groupsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const groups = await prisma.screenGroup.findMany({
      include: { _count: { select: { screens: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(groups.map((g) => ({ id: g.id, name: g.name, description: g.description, screenCount: g._count.screens })));
  }),
);

groupsRouter.use(requirePermission(PERMISSIONS.MANAGE_SCREENS));

groupsRouter.post(
  '/',
  validateBody(screenGroupSchema),
  asyncHandler(async (req, res) => res.status(201).json(await prisma.screenGroup.create({ data: req.body }))),
);

groupsRouter.patch(
  '/:id',
  validateBody(screenGroupSchema.partial()),
  asyncHandler(async (req, res) => {
    const group = await prisma.screenGroup.findUnique({ where: { id: req.params.id } });
    if (!group) throw NotFound('Group not found');
    res.json(await prisma.screenGroup.update({ where: { id: req.params.id }, data: req.body }));
  }),
);

groupsRouter.post(
  '/:id/members',
  validateBody(z.object({ screenIds: z.array(z.string().uuid()) })),
  asyncHandler(async (req, res) => {
    await prisma.screen.updateMany({
      where: { id: { in: req.body.screenIds } },
      data: { screenGroupId: req.params.id },
    });
    res.json({ ok: true });
  }),
);

groupsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.screen.updateMany({ where: { screenGroupId: req.params.id }, data: { screenGroupId: null } });
    await prisma.screenGroup.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);
