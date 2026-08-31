'use client';

import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import { toast } from 'react-toastify';
import { reverseGeocode } from '@/lib/map/geoUtils';

interface UseMapGeolocationOptions {
  mapRef: MutableRefObject<any>;
  onLocationSelect: (location: { lat: number; lng: number; address: string }) => void;
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

  const reverseGeocodeWithAbort = useCallback(
    async (lat: number, lng: number) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const address = await reverseGeocode(lat, lng, controller.signal);
        if (controller.signal.aborted) return;
        onLocationSelect({ lat, lng, address });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    },
    [onLocationSelect]
  );

  // Re-centers the camera on a selected point so the marker stays visible above
  // the mobile report bottom-sheet (which covers the lower part of the map).
  const panToSelectedLocation = useCallback(
    (lat: number, lng: number, zoom?: number) => {
      const map = mapRef.current;
      if (!map) return;
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const offsetY = isMobile ? -map.getCanvas().clientHeight * 0.3 : 0;
      map.easeTo({ center: [lng, lat], offset: [0, offsetY], zoom, duration: 400 });
    },
    [mapRef]
  );

  const handleLocationSelect = useCallback(
    (lat: number, lng: number) => {
      // Immediately update with coordinates.
      onLocationSelect({
        lat,
        lng,
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });

      panToSelectedLocation(lat, lng);

      if (!enableAddressLookup) return;

      // Debounce reverse-geocoding so rapid clicks only send one request to OSM Nominatim
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = setTimeout(() => {
        geocodeTimerRef.current = null;
        void reverseGeocodeWithAbort(lat, lng);
      }, 500);
    },
    [onLocationSelect, reverseGeocodeWithAbort, enableAddressLookup, panToSelectedLocation]
  );

  const handleShareLocation = useCallback((): Promise<boolean> => {
    const attempt = (canRetry: boolean): Promise<boolean> =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          toast.error('Location sharing is not supported by this browser.', {
            position: 'top-right',
            autoClose: 3000,
          });
          resolve(false);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            try {
              panToSelectedLocation(latitude, longitude, 16);
              handleLocationSelect(latitude, longitude);
            } finally {
              resolve(true);
            }
          },
          (error) => {
            // Transient failures (timeout, position unavailable) get one retry;
            // permission state is not retried — it needs a real user action.
            if (canRetry && error.code !== 1) {
              void attempt(false).then(resolve);
              return;
            }
            if (error.code === 1) {
              toast.error('To use your location, allow location access for this site.', {
                position: 'top-right',
                autoClose: 4000,
              });
            } else if (error.code === 3) {
              toast.error('Location request timed out. Please try again.', {
                position: 'top-right',
                autoClose: 4000,
              });
            } else {
              toast.error("Couldn't get your location. Please try again.", {
                position: 'top-right',
                autoClose: 4000,
              });
            }
            resolve(false);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
        );
      });
    return attempt(true);
  }, [handleLocationSelect, panToSelectedLocation]);

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
    panToSelectedLocation,
    handleLocationSelect,
    handleShareLocation,
    clearPendingGeocoding,
  };
}
