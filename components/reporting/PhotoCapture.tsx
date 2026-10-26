'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import {
  ACCEPTED_IMAGE_TYPES,
  formatPhotoSize,
  MAX_UPLOAD_BYTES,
  preparePhoto,
  type PreparedPhoto,
} from '@/lib/reports/photoUpload';

interface PhotoCaptureProps {
  photo: PreparedPhoto | null;
  onChange: (photo: PreparedPhoto | null) => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Optional evidence photo for a flood report. Uses the device camera directly
 * on mobile (`capture="environment"`) and falls back to the file picker on
 * desktop. The image is downscaled in the browser before it is ever uploaded.
 */
export function PhotoCapture({ photo, onChange, disabled = false, compact = false }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Release the object URL when the photo is replaced or the modal unmounts.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (file.size > MAX_UPLOAD_BYTES * 4) {
      setError('That photo is too large. Please choose a smaller one.');
      return;
    }

    setIsProcessing(true);
    try {
      const prepared = await preparePhoto(file);
      onChange(prepared);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The photo could not be processed.'
      );
    } finally {
      setIsProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function clearPhoto() {
    onChange(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (compact) {
    return <div>
      {photo ? <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
        <img src={photo.previewUrl} alt="Selected flood evidence preview" className="h-7 w-7 shrink-0 rounded object-cover" />
        <span className="min-w-0 flex-1 truncate text-xs text-slate-700">Photo added</span>
        <button type="button" onClick={clearPhoto} disabled={disabled} aria-label="Remove photo"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-white hover:text-red-600 disabled:opacity-50">
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div> : <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || isProcessing}
        className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-gakit-maroon hover:bg-maroon-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gakit-maroon disabled:opacity-50">
        {isProcessing ? <Spinner size="xs" label="Preparing photo" /> : <Camera className="h-3.5 w-3.5" aria-hidden="true" />}
        {isProcessing ? 'Preparing…' : 'Add photo'}<span className="text-[10px] font-normal text-slate-500">(optional)</span>
      </button>}
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} capture="environment" className="sr-only"
        onChange={event => void handleFile(event.target.files?.[0])} />
      {error && <p role="alert" className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>;
  }

  if (photo) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob preview, not optimizable */}
          <img
            src={photo.previewUrl}
            alt="Selected flood evidence preview"
            className="h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-slate-900/5"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800">Photo attached</p>
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
              {photo.width}×{photo.height} · {formatPhotoSize(photo.blob.size)}
            </p>
            <button
              type="button"
              onClick={clearPhoto}
              disabled={disabled}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-gakit-maroon ring-1 ring-slate-900/5">
          {isProcessing ? (
            <Spinner label="Preparing photo" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800">
            Add a photo <span className="font-normal text-slate-400">(optional)</span>
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
            Show the water level.
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isProcessing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gakit-maroon px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-maroon-800 disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
          Take photo
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isProcessing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Choose file
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        capture="environment"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {error && (
        <p role="alert" className="mt-2 text-[11px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
