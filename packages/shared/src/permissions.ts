import { ROLES, type RoleName } from './constants.js';

/**
 * Centralised permission catalogue. The backend is the ONLY authority — the web app
 * uses these helpers merely to hide/show UI. Never trust the client for permissions.
 */
export const PERMISSIONS = {
  // user & role management
  MANAGE_USERS: 'MANAGE_USERS',
  // screens
  MANAGE_SCREENS: 'MANAGE_SCREENS', // create/edit/disable/pair, assign handlers, groups
  VIEW_ALL_SCREENS: 'VIEW_ALL_SCREENS',
  // content / playlist (handlers act on assigned screens only — enforced separately)
  MANAGE_CONTENT: 'MANAGE_CONTENT',
  PUBLISH_PLAYLIST: 'PUBLISH_PLAYLIST',
  // history
  RESTORE_ANY_HISTORY: 'RESTORE_ANY_HISTORY', // admin: any item
  RESTORE_OWN_HISTORY: 'RESTORE_OWN_HISTORY', // handler: only own uploads
  // birthday / students
  MANAGE_STUDENTS: 'MANAGE_STUDENTS',
  MANAGE_BIRTHDAY_TEMPLATES: 'MANAGE_BIRTHDAY_TEMPLATES',
  // devices / monitoring
  MONITOR_DEVICES: 'MONITOR_DEVICES',
  SEND_DEVICE_COMMANDS: 'SEND_DEVICE_COMMANDS',
  MANAGE_MAINTENANCE: 'MANAGE_MAINTENANCE',
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ADMIN_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

const HANDLER_PERMISSIONS: Permission[] = [
  PERMISSIONS.MANAGE_CONTENT,
  PERMISSIONS.PUBLISH_PLAYLIST,
  PERMISSIONS.RESTORE_OWN_HISTORY,
];

const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.HANDLER]: HANDLER_PERMISSIONS,
};

export function permissionsFor(role: RoleName): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role: RoleName, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
