import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import type { StorageProvider, PutObjectInput } from './StorageProvider.js';
import { env } from '../env.js';

/**
 * S3-compatible provider. Works with Cloudflare R2 (free egress) or AWS S3.
 * Downloads use short-lived signed URLs — storage credentials never reach the browser.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private client: S3Client;
  private bucket: string;

  constructor() {
    const s3 = env.storage.s3;
    this.bucket = s3.bucket;
    this.client = new S3Client({
      region: s3.region,
      endpoint: s3.endpoint || undefined,
      forcePathStyle: s3.forcePathStyle,
      credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
    });
  }

  async put({ key, body, contentType }: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getStream(key: string): Promise<Readable> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return res.Body as Readable;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const c of res.Body as Readable) chunks.push(c as Buffer);
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async resolveUrl(key: string): Promise<string> {
    // If a public CDN URL is configured, use it; otherwise sign a URL (24h).
    if (env.storage.s3.publicUrl) {
      return `${env.storage.s3.publicUrl.replace(/\/$/, '')}/${key}`;
    }
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: 60 * 60 * 24,
    });
  }
}
