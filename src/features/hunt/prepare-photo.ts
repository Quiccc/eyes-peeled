import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PhotoFile } from '@/api/endpoints';

const MAX_EDGE = 1280;

/**
 * Downscale + re-encode the camera photo before upload. Keeps uploads small and
 * fast, and re-encoding drops EXIF metadata (including GPS location).
 */
export async function preparePhoto(photo: { uri: string; width: number; height: number }): Promise<PhotoFile> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  const longest = Math.max(photo.width, photo.height);
  if (longest > MAX_EDGE) {
    if (photo.width >= photo.height) ctx.resize({ width: MAX_EDGE, height: null });
    else ctx.resize({ width: null, height: MAX_EDGE });
  }
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: result.uri, name: 'photo.jpg', type: 'image/jpeg' };
}
