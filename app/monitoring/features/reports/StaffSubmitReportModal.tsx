'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { ReportModal } from '@/components/ReportModal';
import type { PublicMapHandle } from '@/components/PublicMap';
import type { FloodDepthCode, FloodReference, SelectedLocation } from '@/types/report';
// The elevation-bearing variant of the shared location shape.
export type { SelectedLocation };

const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
  ssr: false,
});

export function StaffSubmitReportModal({
  selectedLocation,
  isReportModalOpen,
  onClose,
  onLocationSelect,
  onReportModalClose,
  onSubmit,
}: {
  selectedLocation: SelectedLocation | null;
  isReportModalOpen: boolean;
  onClose: () => void;
  onLocationSelect: (location: SelectedLocation) => void;
  onReportModalClose: () => void;
  onSubmit: (data: {
    location: { lat: number; lng: number };
    depth: FloodDepthCode;
    depthCm?: number;
    reference: { id: FloodReference; label: string; landmark: string };
  }) => Promise<void>;
}) {
  const mapRef = useRef<PublicMapHandle | null>(null);

  return (
    <div className="fixed inset-0 z-[1400] bg-slate-950/60 p-3 md:p-6">
      <div className="h-full overflow-hidden rounded-lg bg-white shadow-2xl flex flex-col">
        <div className="h-16 shrink-0 border-b border-canvas-grey px-4 md:px-6 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Submit Staff Report</h2>
            <p className="text-xs text-slate-500">Select the affected location on the map, then complete the report.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-canvas-grey text-slate-600 hover:bg-canvas-light"
            aria-label="Close submit report"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 flex overflow-hidden">
          <div className="relative min-h-0 flex-1">
            <div className="absolute top-4 left-4 z-[1000] max-w-xs rounded-lg border border-canvas-grey bg-white/95 p-4 shadow-lg">
              <div className="text-sm font-semibold text-slate-900">Choose report location</div>
              <div className="text-xs text-slate-600 mt-1">
                Click the flooded location on the map to open the report form.
              </div>
            </div>
            <PublicMap
              mapApiRef={mapRef}
              onLocationSelect={onLocationSelect}
              selectedLocation={selectedLocation}
              hideWeather
            />
          </div>

          <ReportModal
            isOpen={isReportModalOpen}
            onClose={onReportModalClose}
            selectedLocation={selectedLocation}
            onSubmit={onSubmit}
            onCheckLocation={(location) =>
              mapRef.current?.checkLocation(location) ??
              Promise.resolve({ hazardLevel: null, precipMm: null })
            }
          />
        </div>
      </div>
    </div>
  );
}
