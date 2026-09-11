import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { streamContentMedia } from './media.service.js';

export const mediaRouter = Router();

/**
 * Public-ish media proxy for the local storage provider. The URL is opaque
 * (contentId), the storage path is never exposed. Devices cache these responses.
 */
mediaRouter.get(
  '/:contentId',
  asyncHandler(async (req, res) => {
    const { stream, mimeType, sizeBytes } = await streamContentMedia(req.params.contentId);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(sizeBytes));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Accept-Ranges', 'bytes');
    stream.pipe(res);
  }),
);
