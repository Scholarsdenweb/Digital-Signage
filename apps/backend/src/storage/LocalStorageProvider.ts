import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { StorageProvider, PutObjectInput } from './StorageProvider.js';
import { env } from '../env.js';

/**
 * Free/low-cost default provider: writes to local disk.
 * Media is served back through the backend `/media/:contentId` proxy route,
 * so the disk path is never exposed to the browser.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private root: string;

  constructor() {
    this.root = path.resolve(env.storage.localDir);
  }

  private full(key: string) {
    return path.join(this.root, key);
  }

  async put({ key, body }: PutObjectInput): Promise<void> {
    const full = this.full(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async getStream(key: string): Promise<Readable> {
    return createReadStream(this.full(key));
  }

  async getBuffer(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.full(key));
  }

  async resolveUrl(_key: string, contentId: string): Promise<string> {
    // Served through backend proxy which streams from disk.
    return `${env.backendPublicUrl}/media/${contentId}`;
  }
}
