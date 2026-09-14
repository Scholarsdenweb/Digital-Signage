import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env from repo root (two levels up from apps/backend/src)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // also allow local .env in backend

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: parseInt(process.env.PORT ?? '4000', 10),
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL ?? 'http://localhost:4000',

  databaseUrl: required('DATABASE_URL', 'postgresql://dsm:dsm@localhost:5432/dsm?schema=public'),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me-please-32chars'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-please-32char'),
    // Long-lived access token so management users log in about once a week.
    accessTtl: process.env.JWT_ACCESS_TTL ?? '7d',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  deviceTokenSecret: required('DEVICE_TOKEN_SECRET', 'dev-device-secret-change-me-please-32chars'),

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  storage: {
    provider: (process.env.STORAGE_PROVIDER ?? 'local') as 'local' | 's3',
    localDir: process.env.LOCAL_STORAGE_DIR ?? './storage-data',
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'auto',
      bucket: process.env.S3_BUCKET ?? 'dsm-media',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      publicUrl: process.env.S3_PUBLIC_URL ?? '',
      forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    },
  },

  maxUploadBytes: parseInt(process.env.MAX_UPLOAD_MB ?? '200', 10) * 1024 * 1024,
  historyRetentionDays: parseInt(process.env.HISTORY_RETENTION_DAYS ?? '7', 10),
};
