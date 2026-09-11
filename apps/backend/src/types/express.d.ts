import type { RoleName } from '@dsm/shared';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        role: RoleName;
      };
      device?: {
        screenId: string;
        screenKey: string;
        credentialId: string;
      };
    }
  }
}

export {};
