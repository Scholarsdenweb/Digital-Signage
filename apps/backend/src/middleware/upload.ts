import multer from 'multer';
import { env } from '../env.js';
import { ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME } from '@dsm/shared';

const allowed = new Set<string>([...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME]);

/** In-memory upload; file is validated then handed to the storage provider. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});
