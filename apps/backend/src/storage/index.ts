import type { StorageProvider } from './StorageProvider.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';
import { S3StorageProvider } from './S3StorageProvider.js';
import { env } from '../env.js';

let instance: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (!instance) {
    instance = env.storage.provider === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
  }
  return instance;
}

export type { StorageProvider } from './StorageProvider.js';
