'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { toast } from 'react-toastify';
import { reverseGeocode } from '@/lib/map/geoUtils';
import { requestCurrentPosition } from '@/lib/map/geolocation';
import { locationFromGps } from '@/lib/reports/observationMetadata';
import type { SelectedLocation } from '@/types/report';

interface UseMapGeolocationOptions {
  mapRef: MutableRefObject<any>;
  onLocationSelect: (location: SelectedLocation) => void;
  enableAddressLookup?: boolean;
}

export function useMapGeolocation({
  mapRef,
  onLocationSelect,
  enableAddressLookup = true,
}: UseMapGeolocationOptions) {
  const [isShareLocating, setIsShareLocating] = useState(false);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onLocationSelectRef = useRef(onLocationSelect);

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  const reverseGeocodeWithAbort = useCallback(
    async (location: SelectedLocation) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const address = await reverseGeocode(location.lat, location.lng, controller.signal);
        if (controller.signal.aborted) return;
        onLocationSelectRef.current({ ...location, address });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    },
    []
  );

  // Center both tapped and GPS selections in the map, including on mobile.
  const panToSelectedLocation = useCallback(
    (lat: number, lng: number, zoom?: number) => {
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({ center: [lng, lat], offset: [0, 0], zoom, duration: 400 });
    },
    [mapRef]
  );

  const handleLocationSelect = useCallback(
    (lat: number, lng: number, gpsLocation?: SelectedLocation) => {
      // Cancel the previous lookup before publishing a new selection.
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = null;
      abortControllerRef.current?.abort();

      // Immediately update with coordinates for instant pin placement.
      const location: SelectedLocation = gpsLocation ?? {
        lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, source: 'manual',
      };
      onLocationSelectRef.current(location);

      panToSelectedLocation(lat, lng, gpsLocation ? 16 : undefined);

      if (!enableAddressLookup) return;

      // Local spatial reverse-geocoding (0ms lookup against memory GeoJSON/Overture).
      // Micro-debounce of 25ms to coalesce rapid taps or trackpad settling.
      geocodeTimerRef.current = setTimeout(() => {
        geocodeTimerRef.current = null;
        void reverseGeocodeWithAbort(location);
      }, 25);
    },
    [panToSelectedLocation, enableAddressLookup, reverseGeocodeWithAbort]
  );

  const handleShareLocation = useCallback(async (): Promise<boolean> => {
    const result = await requestCurrentPosition();
    if (!result.ok) {
      toast.error(result.error.message, {
        position: 'top-right',
        autoClose: result.error.code === 'unsupported' ? 3000 : 4000,
      });
      return false;
    }

    const location = locationFromGps(result.position);
    handleLocationSelect(location.lat, location.lng, location);
    return true;
  }, [handleLocationSelect]);

  const clearPendingGeocoding = useCallback(() => {
    if (geocodeTimerRef.current) {
      clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = null;
    }
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  return {
    isShareLocating,
    setIsShareLocating,
    handleLocationSelect,
    handleShareLocation,
    clearPendingGeocoding,
  };
}
