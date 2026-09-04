'use client';

import { MapPin, Locate, X, AlertTriangle } from 'lucide-react';
import { LocationSearch, type SearchedLocation } from './LocationSearch';

export interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
}

export function LocationPromptModal({
  isOpen,
  onClose,
  onUseCurrentLocation,
  onChooseLocation,
  onSearchLocationSelect,
  mode = 'assessment',
}: {
  isOpen: boolean;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onChooseLocation: () => void;
  onSearchLocationSelect: (location: SearchedLocation) => void;
  mode?: 'assessment' | 'report';
}) {
  if (!isOpen) return null;

  const isReport = mode === 'report';

  return (
    <div className="fixed inset-0 z-[1400] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <div className="flex items-center gap-2">
            {isReport && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-gakit-maroon">
                <AlertTriangle className="h-3.5 w-3.5 text-gakit-maroon stroke-[2.5]" />
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                {isReport ? 'Report Flood Location' : 'Select Location to Assess'}
              </h3>
              <p className="text-xs text-slate-500">
                {isReport
                  ? 'Choose where the flood is occurring to file a report.'
                  : 'Check geohazard risk, rainfall, and elevation.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location picker"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 pt-3 space-y-3">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-700">
              {isReport ? 'Search flooded area or barangay' : 'Search for an address or barangay'}
            </div>
            <LocationSearch onSelect={onSearchLocationSelect} />
          </div>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-canvas-grey" />
            <span className="text-xs font-medium text-slate-400">
              or choose another way
            </span>
            <div className="h-px flex-1 bg-canvas-grey" />
          </div>

          <button
            onClick={onUseCurrentLocation}
            className="w-full p-4 rounded-xl border-2 border-gakit-maroon bg-maroon-50/60 text-left hover:bg-maroon-100/70 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs text-gakit-maroon">
                <Locate className="w-5 h-5 text-gakit-maroon" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">
                  Use my current location
                </div>
                <div className="text-xs text-slate-600">
                  {isReport ? 'Report flood at your GPS position.' : 'Assess hazards at your current GPS spot.'}
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={onChooseLocation}
            className="w-full p-4 rounded-xl border-2 border-slate-200 text-left hover:border-gakit-maroon hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-maroon-50 group-hover:text-gakit-maroon transition-colors">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">
                  Choose on the map
                </div>
                <div className="text-xs text-slate-600">
                  {isReport ? 'Tap the flooded spot manually.' : 'Tap any point on the map to evaluate risk.'}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
