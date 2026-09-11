import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Roles
  const admin = await prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN' } });
  const handler = await prisma.role.upsert({ where: { name: 'HANDLER' }, update: {}, create: { name: 'HANDLER' } });

  // Users
  const adminPass = await bcrypt.hash('Admin@12345', 12);
  const handlerPass = await bcrypt.hash('Handler@12345', 12);
  await prisma.user.upsert({
    where: { email: 'admin@display.local' },
    update: {},
    create: { email: 'admin@display.local', name: 'System Admin', passwordHash: adminPass, roleId: admin.id },
  });
  const h = await prisma.user.upsert({
    where: { email: 'handler@display.local' },
    update: {},
    create: { email: 'handler@display.local', name: 'Reception Handler', passwordHash: handlerPass, roleId: handler.id },
  });

  // Screen group
  await prisma.screenGroup.upsert({
    where: { name: 'Reception Screens' },
    update: {},
    create: { name: 'Reception Screens', description: 'Front-desk displays' },
  });

  // Birthday template
  const tplCount = await prisma.birthdayTemplate.count();
  if (tplCount === 0) {
    await prisma.birthdayTemplate.create({
      data: {
        name: 'Default',
        isDefault: true,
        defaultDurationSec: 10,
        design: { width: 1920, height: 1080, background: '#0f172a', accent: '#f59e0b', message: 'Happy Birthday!' },
      },
    });
  }

  // A couple of students (one with today's birthday for demo)
  const today = new Date();
  const mkDob = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
  const students = [
    { studentCode: 'STU-001', name: 'Rahul Sharma', y: 2008, m: today.getUTCMonth() + 1, d: today.getUTCDate() },
    { studentCode: 'STU-002', name: 'Aman Verma', y: 2007, m: today.getUTCMonth() + 1, d: today.getUTCDate() },
    { studentCode: 'STU-003', name: 'Priya Singh', y: 2008, m: 1, d: 15 },
  ];
  for (const s of students) {
    await prisma.student.upsert({
      where: { studentCode: s.studentCode },
      update: {},
      create: {
        studentCode: s.studentCode,
        name: s.name,
        dateOfBirth: mkDob(s.y, s.m, s.d),
        birthMonth: s.m,
        birthDay: s.d,
        batch: 'NEET 2026',
      },
    });
  }

  console.log('Seed complete.');
  console.log('  Admin:   admin@display.local / Admin@12345');
  console.log('  Handler: handler@display.local / Handler@12345', `(id ${h.id})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
