import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PhotoFile } from '@/api/endpoints';

const SIZE = 512;

/**
 * Center-crop the picked image to a square (the picker's crop is square on iOS and asked for on
 * Android, but a cancelled or skipped crop isn't), shrink it to 512px and re-encode it as JPEG.
 * Re-encoding drops EXIF metadata, including GPS location.
 */
export async function prepareAvatar(image: { uri: string; width: number; height: number }): Promise<PhotoFile> {
  const ctx = ImageManipulator.manipulate(image.uri);
  const { width, height } = image;
  if (width > 0 && height > 0) {
    const side = Math.min(width, height);
    if (width !== height) {
      ctx.crop({ originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side });
    }
    if (side > SIZE) ctx.resize({ width: SIZE, height: SIZE });
  } else {
    // The system didn't report a size: just cap the width.
    ctx.resize({ width: SIZE, height: null });
  }
  const rendered = await ctx.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: result.uri, name: 'avatar.jpg', type: 'image/jpeg' };
}
