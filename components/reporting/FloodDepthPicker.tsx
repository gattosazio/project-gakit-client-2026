'use client';

import { memo, useState } from 'react';
import { FloodDepthScale } from './FloodDepthScale';
import { FloodReferenceIllustration } from './FloodReferenceIllustration';
import type { FloodReference } from '@/lib/reports/depthReferences';

/** Drag previews stay inside this small component; the form updates on release. */
export const FloodDepthPicker = memo(function FloodDepthPicker({ reference, label, value, onSelect, disabled }: {
  reference: FloodReference;
  label: string;
  value: number | null;
  onSelect: (cm: number) => void;
  disabled: boolean;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;
  return <div className="rounded-xl border border-slate-200 bg-white p-2.5">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-[10px] text-slate-400">Drag to estimate water depth</span>
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-700">{shown == null ? 'Choose depth' : `${shown} cm`}</span>
    </div>
    <div className="flex h-40 items-stretch gap-2">
      <FloodReferenceIllustration reference={reference} depthCm={shown ?? 0} label={label} className="min-w-0 flex-1" />
      <FloodDepthScale value={value} preview={preview} onPreview={setPreview} onSelect={onSelect} disabled={disabled} />
    </div>
  </div>;
});
