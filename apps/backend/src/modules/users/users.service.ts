import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/password.js';
import { Conflict, NotFound } from '../../lib/errors.js';
import type { RoleName } from '@dsm/shared';

const publicSelect = {
  id: true,
  email: true,
  name: true,
  active: true,
  createdAt: true,
  role: { select: { name: true } },
};

export async function listUsers() {
  const users = await prisma.user.findMany({ select: publicSelect, orderBy: { createdAt: 'desc' } });
  return users.map((u) => ({ ...u, role: u.role.name }));
}

export async function listHandlers() {
  const users = await prisma.user.findMany({
    where: { role: { name: 'HANDLER' }, active: true },
    select: publicSelect,
    orderBy: { name: 'asc' },
  });
  return users.map((u) => ({ ...u, role: u.role.name }));
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: RoleName;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('Email already in use');
  const role = await prisma.role.findUnique({ where: { name: input.role } });
  if (!role) throw NotFound('Role not found');
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      roleId: role.id,
    },
    select: publicSelect,
  });
  return { ...user, role: user.role.name };
}

export async function updateUser(
  id: string,
  input: Partial<{ email: string; name: string; password: string; role: RoleName; active: boolean }>,
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw NotFound('User not found');
  const data: Record<string, unknown> = {};
  if (input.email) data.email = input.email;
  if (input.name) data.name = input.name;
  if (typeof input.active === 'boolean') data.active = input.active;
  if (input.password) data.passwordHash = await hashPassword(input.password);
  if (input.role) {
    const role = await prisma.role.findUnique({ where: { name: input.role } });
    if (!role) throw NotFound('Role not found');
    data.roleId = role.id;
  }
  const updated = await prisma.user.update({ where: { id }, data, select: publicSelect });
  return { ...updated, role: updated.role.name };
}

export async function deleteUser(id: string) {
  await prisma.user.update({ where: { id }, data: { active: false } });
}
