import type { Readable } from 'node:stream';

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StorageProvider {
  readonly name: string;
  put(input: PutObjectInput): Promise<void>;
  getStream(key: string): Promise<Readable>;
  getBuffer(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /**
   * Resolve a URL the client can use to fetch the object.
   * Local provider returns a backend-proxied path; S3/R2 returns a signed URL
   * (credentials are never exposed to the browser).
   */
  resolveUrl(key: string, contentId: string): Promise<string>;
}
