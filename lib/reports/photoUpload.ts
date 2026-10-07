/**
 * Client-side image preparation for report evidence photos.
 *
 * Phone cameras produce multi-megabyte files, which is both slow on a rural
 * connection and wasteful on the free Supabase Storage tier. Every photo is
 * therefore downscaled and re-encoded in the browser before upload.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const TARGET_BYTES = 2 * 1024 * 1024;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export interface PreparedPhoto {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The photo could not be processed.'));
      },
      type,
      quality
    );
  });
}

/**
 * Downscale to at most {@link MAX_DIMENSION} on the long edge and re-encode as
 * JPEG. PNG sources with transparency are flattened onto white, which is the
 * right background for a flood photo and keeps the encoder simple.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('This browser cannot process the photo.');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);

  // Step quality down for very large frames rather than dropping resolution.
  for (const quality of [0.7, 0.6]) {
    if (blob.size <= TARGET_BYTES) break;
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
  };
}

export function formatPhotoSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}