import { Router } from 'express';
import { studentSchema, updateStudentSchema, bulkStudentsSchema, PERMISSIONS } from '@dsm/shared';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { prisma } from '../../lib/prisma.js';
import { NotFound } from '../../lib/errors.js';

export const studentsRouter = Router();
studentsRouter.use(requireAuth, requirePermission(PERMISSIONS.MANAGE_STUDENTS));

function dobParts(dob: string) {
  const [y, m, d] = dob.split('-').map(Number);
  return { date: new Date(Date.UTC(y, m - 1, d)), birthMonth: m, birthDay: d };
}

studentsRouter.get(
  '/',
  asyncHandler(async (_req, res) =>
    res.json(await prisma.student.findMany({ orderBy: { name: 'asc' } })),
  ),
);

// Bulk import (from CSV parsed on the client). Upserts by studentCode.
studentsRouter.post(
  '/bulk',
  validateBody(bulkStudentsSchema),
  asyncHandler(async (req, res) => {
    let created = 0;
    let updated = 0;
    for (const s of req.body.students) {
      const { date, birthMonth, birthDay } = dobParts(s.dateOfBirth);
      const existing = await prisma.student.findUnique({ where: { studentCode: s.studentCode } });
      const data = {
        name: s.name,
        dateOfBirth: date,
        batch: s.batch,
        course: s.course,
        birthMonth,
        birthDay,
        active: true,
      };
      if (existing) {
        await prisma.student.update({ where: { studentCode: s.studentCode }, data });
        updated++;
      } else {
        await prisma.student.create({ data: { studentCode: s.studentCode, ...data } });
        created++;
      }
    }
    res.json({ ok: true, created, updated, total: req.body.students.length });
  }),
);

studentsRouter.post(
  '/',
  validateBody(studentSchema),
  asyncHandler(async (req, res) => {
    const { date, birthMonth, birthDay } = dobParts(req.body.dateOfBirth);
    const student = await prisma.student.create({
      data: {
        studentCode: req.body.studentCode,
        name: req.body.name,
        dateOfBirth: date,
        batch: req.body.batch,
        course: req.body.course,
        birthMonth,
        birthDay,
      },
    });
    res.status(201).json(student);
  }),
);

studentsRouter.patch(
  '/:id',
  validateBody(updateStudentSchema),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) throw NotFound('Student not found');
    const data: Record<string, unknown> = { ...req.body };
    if (req.body.dateOfBirth) {
      const { date, birthMonth, birthDay } = dobParts(req.body.dateOfBirth);
      data.dateOfBirth = date;
      data.birthMonth = birthMonth;
      data.birthDay = birthDay;
    }
    res.json(await prisma.student.update({ where: { id: req.params.id }, data }));
  }),
);

studentsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.student.update({ where: { id: req.params.id }, data: { active: false } });
    res.json({ ok: true });
  }),
);
