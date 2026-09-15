import { Router } from 'express';
import { z } from 'zod';
import { screenGroupSchema, groupPublishSchema, PERMISSIONS, WS } from '@dsm/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { NotFound, BadRequest } from '../../lib/errors.js';
import { publishItemsToScreens } from '../playlist/playlist.service.js';
import { wsHub } from '../../ws/hub.js';
import { logActivity } from '../activity/activity.service.js';

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

// Publish content to a whole group: REPLACES the live playlist on every screen
// in the group with the given content (each screen's previous content goes to history).
groupsRouter.post(
  '/:id/publish',
  validateBody(groupPublishSchema),
  asyncHandler(async (req, res) => {
    const group = await prisma.screenGroup.findUnique({ where: { id: req.params.id } });
    if (!group) throw NotFound('Group not found');
    const screens = await prisma.screen.findMany({ where: { screenGroupId: req.params.id }, select: { id: true } });
    if (screens.length === 0) throw BadRequest('This group has no screens');

    const results = await publishItemsToScreens(screens.map((s) => s.id), req.body.items);
    for (const r of results) {
      wsHub.broadcastToScreen(r.screenId, {
        event: WS.PLAYLIST_UPDATED,
        playlistVersion: r.version,
        data: { screenId: r.screenId, playlistVersion: r.version, urgent: true },
      });
      wsHub.broadcastToDashboard({ event: WS.PLAYLIST_UPDATED, data: { screenId: r.screenId, playlistVersion: r.version } });
    }
    await logActivity({
      actorId: req.auth!.userId,
      action: 'GROUP_PUBLISH',
      entityType: 'ScreenGroup',
      entityId: req.params.id,
      metadata: { screens: results.length, items: req.body.items.length },
    });
    res.json({ ok: true, screens: results.length });
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
