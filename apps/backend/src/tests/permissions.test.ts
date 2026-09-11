import { describe, it, expect } from 'vitest';
import { ROLES, PERMISSIONS, can, permissionsFor } from '@dsm/shared';

describe('role permissions', () => {
  // Scenario 4 (part): handler permission scope
  it('handler can manage content and publish but not manage screens/users', () => {
    expect(can(ROLES.HANDLER, PERMISSIONS.MANAGE_CONTENT)).toBe(true);
    expect(can(ROLES.HANDLER, PERMISSIONS.PUBLISH_PLAYLIST)).toBe(true);
    expect(can(ROLES.HANDLER, PERMISSIONS.MANAGE_SCREENS)).toBe(false);
    expect(can(ROLES.HANDLER, PERMISSIONS.MANAGE_USERS)).toBe(false);
  });

  // Scenario 16 / 17: restore permissions
  it('handler may restore own history only; admin may restore any', () => {
    expect(can(ROLES.HANDLER, PERMISSIONS.RESTORE_OWN_HISTORY)).toBe(true);
    expect(can(ROLES.HANDLER, PERMISSIONS.RESTORE_ANY_HISTORY)).toBe(false);
    expect(can(ROLES.ADMIN, PERMISSIONS.RESTORE_ANY_HISTORY)).toBe(true);
  });

  it('admin holds every permission', () => {
    expect(permissionsFor(ROLES.ADMIN).length).toBe(Object.keys(PERMISSIONS).length);
  });
});
