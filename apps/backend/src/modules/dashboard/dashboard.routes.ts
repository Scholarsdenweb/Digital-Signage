import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { listScreens } from '../screens/screens.query.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const actor = { userId: req.auth!.userId, role: req.auth!.role };
    const screens = await listScreens(actor);
    const online = screens.filter((s) => s.online).length;

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);

    const [activeHandlers, publishedContent, historyCount, birthdaysToday] = await Promise.all([
      prisma.user.count({ where: { role: { name: 'HANDLER' }, active: true } }),
      prisma.content.count({ where: { status: 'LIVE' } }),
      prisma.contentHistory.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.birthdayInstance.count({ where: { forDate: start } }),
    ]);

    res.json({
      totalScreens: screens.length,
      onlineScreens: online,
      offlineScreens: screens.length - online,
      activeHandlers,
      publishedContent,
      contentInHistory: historyCount,
      todaysBirthdays: birthdaysToday,
    });
  }),
);

// Screen table for the dashboard (role-scoped)
dashboardRouter.get(
  '/screens',
  asyncHandler(async (req, res) =>
    res.json(await listScreens({ userId: req.auth!.userId, role: req.auth!.role })),
  ),
);
