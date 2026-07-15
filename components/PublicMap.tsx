'use client';

import { useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvent } from 'react-leaflet';
import L from 'leaflet';
import { Navigation } from 'lucide-react';
import { toast } from 'react-toastify';

interface HazardReport {
  id: string;
  lat: number;
  lng: number;
  location: string;
  status: 'critical' | 'verified' | 'pending' | 'safe';
  depth?: string;
  time: string;
}

// Hardcoded hazard data for Iligan City
const HARDCODED_HAZARDS: HazardReport[] = [
  {
    id: '1',
    lat: 8.2312,
    lng: 124.2570,
    location: 'Hinaplanon Road: Waist Deep',
    status: 'verified',
    depth: 'Waist Deep',
    time: '10:42 AM',
  },
  {
    id: '2',
    lat: 8.2265,
    lng: 124.2545,
    location: 'Impasable',
    status: 'critical',
    time: '07:24 PM',
  },
  {
    id: '3',
    lat: 8.2290,
    lng: 124.2548,
    location: 'Waist Deep',
    status: 'pending',
    depth: 'Waist Deep',
    time: '07:23 PM',
  },
  {
    id: '4',
    lat: 8.2245,
    lng: 124.2530,
    location: 'Ankle Deep',
    status: 'pending',
    depth: 'Ankle Deep',
    time: '10:15 AM',
  },
];

const ILIGAN_CENTER = { lat: 8.2312, lng: 124.2470 };

// Create custom icons for different hazard statuses
const createHazardIcon = (status: string) => {
  const colorMap: Record<string, string> = {
    critical: '#EF4444',
    verified: '#3B82F6',
    pending: '#F59E0B',
    safe: '#10B981',
  };

  const color = colorMap[status] || '#6B7280';

  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        cursor: pointer;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: 'leaflet-div-icon-hazard',
  });
};

interface MapClickHandlerProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

function MapClickHandler({ onLocationSelect }: MapClickHandlerProps) {
  useMapEvent('click', (e) => {
    const { lat, lng } = e.latlng;
    onLocationSelect(lat, lng);
  });
  return null;
}

interface MapControlsProps {
  onShareLocation: (lat: number, lng: number) => void;
}

function MapControls({ onShareLocation }: MapControlsProps) {
  const map = useMap();

  // Force Leaflet to recalculate container size after mounting
  useMapEvent('load', () => {
    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  });

  const handleShareLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        map.flyTo([latitude, longitude], 16);
        onShareLocation(latitude, longitude);
      }, () => {
        toast.error('Unable to get your location. Please allow location access.', {
          position: 'top-right',
          autoClose: 3000,
        });
      });
    } else {
      toast.error('Location sharing is not supported by this browser.', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  }, [map, onShareLocation]);

  return (
    <button
      onClick={handleShareLocation}
      className="absolute bottom-20 md:bottom-6 right-4 md:right-6 z-[1000] bg-white p-3 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200 border border-canvas-grey"
      title="Share my location"
      aria-label="Share my location"
    >
      <Navigation className="w-5 h-5 text-gakit-blue" />
    </button>
  );
}

interface PublicMapProps {
  onLocationSelect: (location: { lat: number; lng: number; address: string; elevation?: number }) => void;
  selectedLocation: { lat: number; lng: number; elevation?: number } | null;
  submittedReports?: Array<{
    id: string;
    location: { lat: number; lng: number; address: string };
    depth: 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';
    submittedAt: string;
  }>;
}

export function PublicMap({
  onLocationSelect,
  selectedLocation,
  submittedReports = [],
}: PublicMapProps) {
  const handleLocationSelect = useCallback(
    async (lat: number, lng: number) => {
      onLocationSelect({
        lat,
        lng,
        address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
      
      try {
        // Fetch address via reverse geocoding
        const addressResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );
        const addressData = await addressResponse.json();
        
        const address = addressData.address?.road || addressData.address?.village || addressData.address?.city || 
                       addressData.address?.town || addressData.display_name?.split(',')[0] || 
                       `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        // Fetch elevation via Open-Elevation API
        let elevation: number | undefined;
        try {
          const elevationResponse = await fetch(
            `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`
          );
          const elevationData = await elevationResponse.json();
          elevation = elevationData.results?.[0]?.elevation;
        } catch (error) {
          console.warn('Elevation API error:', error);
          // Elevation is optional, continue without it
        }
        
        onLocationSelect({
          lat,
          lng,
          address: address.trim(),
          elevation,
        });
      } catch (error) {
        console.error('Geocoding error:', error);
        // Fallback to coordinates if API fails
        onLocationSelect({
          lat,
          lng,
          address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
      }
    },
    [onLocationSelect]
  );

  return (
    <div className="relative w-full h-full bg-canvas-grey">
      <MapContainer
        center={[ILIGAN_CENTER.lat, ILIGAN_CENTER.lng]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        <MapClickHandler onLocationSelect={handleLocationSelect} />

        {/* Render hazard markers */}
        {HARDCODED_HAZARDS.map((hazard) => (
          <Marker
            key={hazard.id}
            position={[hazard.lat, hazard.lng]}
            icon={createHazardIcon(hazard.status)}
          >
            <Popup className="gakit-map-popup">
              <div className="max-w-xs">
                <div className="font-semibold text-slate-900 mb-1">
                  {hazard.location}
                </div>
                <div className="text-xs text-slate-600 mb-2">
                  {hazard.status === 'critical' && (
                    <span className="font-medium text-hazard-critical">
                      Status: Impassable
                    </span>
                  )}
                  {hazard.status === 'verified' && (
                    <span className="font-medium text-hazard-verified">
                      Status: Verified
                    </span>
                  )}
                  {hazard.status === 'pending' && (
                    <span className="font-medium text-hazard-pending">
                      Status: Pending
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">Time: {hazard.time}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {submittedReports.map((report) => (
          <Marker
            key={report.id}
            position={[report.location.lat, report.location.lng]}
            icon={createHazardIcon('pending')}
          >
            <Popup className="gakit-map-popup">
              <div className="max-w-xs">
                <div className="font-semibold text-slate-900 mb-1">
                  Your submitted report
                </div>
                <div className="text-xs text-slate-600 mb-2">
                  {report.location.address}
                </div>
                <div className="text-xs font-medium text-hazard-pending">
                  Status: Pending validation
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Submitted: {report.submittedAt}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Selected location marker */}
        {selectedLocation && (
          <Marker
            position={[selectedLocation.lat, selectedLocation.lng]}
            icon={L.icon({
              iconUrl:
                'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
              shadowUrl:
                'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowSize: [41, 41],
            })}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold mb-1">Selected Location</div>
                <div className="text-xs text-slate-600">
                  {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                </div>
                {selectedLocation.elevation !== undefined && (
                  <div className="text-xs text-slate-600 mt-1">
                    Elevation: {selectedLocation.elevation.toFixed(1)}m
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        <MapControls onShareLocation={handleLocationSelect} />
      </MapContainer>
    </div>
  );
}
