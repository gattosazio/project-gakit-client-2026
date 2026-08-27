'use client';

import { MapPin, Locate } from 'lucide-react';
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
}: {
  isOpen: boolean;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onChooseLocation: () => void;
  onSearchLocationSelect: (location: SearchedLocation) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[1300] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="p-5 space-y-3">
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-900">
              Search for a location
            </div>
            <LocationSearch onSelect={onSearchLocationSelect} />
          </div>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-canvas-grey" />
            <span className="text-xs font-medium text-slate-500">
              or choose another way
            </span>
            <div className="h-px flex-1 bg-canvas-grey" />
          </div>

          <button
            onClick={onUseCurrentLocation}
            className="w-full p-4 rounded-xl border-2 border-gakit-maroon bg-maroon-50 text-left hover:bg-maroon-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Locate className="w-5 h-5 text-gakit-maroon" />
              <div>
                <div className="font-semibold text-slate-900">Use my current location</div>
                <div className="text-xs text-slate-600">Turn on location access and continue.</div>
              </div>
            </div>
          </button>

          <button
            onClick={onChooseLocation}
            className="w-full p-4 rounded-xl border-2 border-canvas-grey text-left hover:border-gakit-maroon hover:bg-maroon-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gakit-maroon" />
              <div>
                <div className="font-semibold text-slate-900">Choose on the map</div>
                <div className="text-xs text-slate-600">Tap the flooded location manually.</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
