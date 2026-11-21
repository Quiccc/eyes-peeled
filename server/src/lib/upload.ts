import multer from 'multer';

/** Multer that keeps one JPEG file field in memory and caps everything else it would buffer. */
export const jpegUpload = (maxBytes: number) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 0, parts: 1, headerPairs: 20 },
  });

export const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
