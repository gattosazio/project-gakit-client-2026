'use client';

import { memo, useState, type ReactNode } from 'react';
import { FloodDepthScale } from './FloodDepthScale';
import { FloodReferenceIllustration } from './FloodReferenceIllustration';
import type { FloodReference } from '@/lib/reports/depthReferences';

/** Drag previews stay inside this small component; the form updates on release. */
export const FloodDepthPicker = memo(function FloodDepthPicker({ reference, label, value, onSelect, disabled, referenceControl }: {
  reference: FloodReference;
  label: string;
  value: number | null;
  onSelect: (cm: number) => void;
  disabled: boolean;
  referenceControl?: ReactNode;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;
  return <div className="rounded-xl border border-slate-200 bg-white p-2">
    <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
      {referenceControl ?? <span className="text-[10px] text-slate-400">Drag to estimate water depth</span>}
      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700">{shown == null ? 'Drag to set depth' : `${shown} cm`}</span>
    </div>
    <div className={`flex items-stretch gap-2 ${referenceControl ? 'h-32' : 'h-40'}`}>
      <FloodReferenceIllustration reference={reference} depthCm={shown ?? 0} label={label} className="min-w-0 flex-1" />
      <FloodDepthScale value={value} preview={preview} onPreview={setPreview} onSelect={onSelect} disabled={disabled} />
    </div>
  </div>;
});
