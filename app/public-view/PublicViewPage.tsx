'use client';

import { useState, useCallback, lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { PublicHeader } from '@/components/PublicHeader';
import { ReportModal } from './ReportModal';
import { toast } from 'react-toastify';

// Dynamically import the map to avoid window is not defined errors
const PublicMap = dynamic(() => import('@/components/PublicMap').then(mod => ({ default: mod.PublicMap })), {
  loading: () => <div className="w-full h-full bg-canvas-grey flex items-center justify-center">Loading map...</div>,
  ssr: false,
});

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
  elevation?: number;
}

export function PublicViewPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(
    null
  );

  const handleLocationSelect = useCallback((location: SelectedLocation) => {
    setSelectedLocation(location);
    setIsModalOpen(true);
    toast.info(`Location selected: ${location.address}`, {
      position: 'top-right',
      autoClose: 2000,
    });
  }, []);

  const handleReportSubmit = async (data: {
    location: { lat: number; lng: number; elevation?: number };
    depth: 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
    image?: File;
  }): Promise<void> => {
    // Optimistic response pattern - simulate submission
    console.log('Report submitted:', data);
    if (data.image) {
      console.log('Image attached:', data.image.name, data.image.size, 'bytes');
    }

    // Simulate API call
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // In a real app, this would call your backend API with FormData
        // to handle both the JSON data and the image file
        console.log('Report confirmed by backend');
        resolve();
      }, 1500);
    });
  };

  return (
    <div className="w-screen h-screen bg-canvas-grey flex flex-col">
      <PublicHeader />

      <main className="flex-1 mt-16 w-full h-full flex overflow-hidden">
        <div className="flex-1 w-full h-full min-h-0">
          <Suspense fallback={<div className="w-full h-full bg-canvas-grey" />}>
            <PublicMap
              onLocationSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
            />
          </Suspense>
        </div>

        <ReportModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedLocation(null);
          }}
          selectedLocation={selectedLocation}
          onSubmit={handleReportSubmit}
        />
      </main>
    </div>
  );
}
