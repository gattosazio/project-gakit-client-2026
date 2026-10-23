import { PRIMARY_TYPHOON_CATEGORIES, normalizeTyphoonCategory } from './typhoon';

/** Original, unmodified PNGs from PAGASA's public TAMSS/KMZ icon directory. */
export function typhoonIconURL(category: string): string {
  return `/icons/pagasa/${normalizeTyphoonCategory(category)}.png`;
}

export function typhoonIconId(category: string): string {
  return `pagasa-cyclone-${normalizeTyphoonCategory(category)}`;
}

/** Register again after style reloads; the browser caches the local PNGs. */
export async function registerTyphoonIcons(map: any): Promise<void> {
  await Promise.all(PRIMARY_TYPHOON_CATEGORIES.map(async category => {
    const id = typhoonIconId(category);
    if (map.hasImage(id)) return;
    try {
      const image = await map.loadImage(typhoonIconURL(category));
      // Downsample before uploading to the sprite atlas: filtering a 600px
      // source directly down to a 20px marker makes the official curves jagged.
      const pixels = typeof createImageBitmap === 'function'
        ? await createImageBitmap(image.data, { resizeWidth: 96, resizeHeight: 96, resizeQuality: 'high' })
        : image.data;
      if (!map.hasImage(id)) map.addImage(id, pixels, { pixelRatio: pixels.width / 30 });
      if (pixels !== image.data) pixels.close();
    } catch (error) {
      console.error(`Failed to load PAGASA ${category} icon`, error);
    }
  }));
}
