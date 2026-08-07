'use client';

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';

export type OperationalReportStatus = 'Pending' | 'Verified' | 'Anomaly' | 'Rejected';

export interface OperationalMapReport {
  id: string;
  lat: number;
  lng: number;
  location: string;
  barangay: string;
  depth: string;
  status: OperationalReportStatus;
  submittedAt: string;
}

const ILIGAN_CENTER = { lat: 8.2312, lng: 124.2470 };

const statusColors: Record<OperationalReportStatus, string> = {
  Pending: '#F59E0B',
  Verified: '#10B981',
  Anomaly: '#64748B',
  Rejected: '#94A3B8',
};

function createStatusIcon(status: OperationalReportStatus, isSelected: boolean) {
  const color = statusColors[status];
  const size = isSelected ? 38 : 30;

  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 999px;
        border: ${isSelected ? 4 : 3}px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 14px rgba(15,23,42,0.25);
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 999px;
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    className: 'leaflet-div-icon-hazard',
  });
}

interface OperationalHazardMapProps {
  reports: OperationalMapReport[];
  selectedReportId: string;
  onSelectReport: (reportId: string) => void;
}

export function OperationalHazardMap({
  reports,
  selectedReportId,
  onSelectReport,
}: OperationalHazardMapProps) {
  return (
    <MapContainer
      center={[ILIGAN_CENTER.lat, ILIGAN_CENTER.lng]}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />

      {reports.map((report) => (
        <Marker
          key={report.id}
          position={[report.lat, report.lng]}
          icon={createStatusIcon(report.status, selectedReportId === report.id)}
          eventHandlers={{
            click: () => onSelectReport(report.id),
          }}
        >
          <Popup className="gakit-map-popup">
            <div className="max-w-xs">
              <div className="font-semibold text-slate-900">{report.location}</div>
              <div className="text-xs text-slate-600 mt-1">{report.depth}</div>
              <div className="text-xs text-slate-500 mt-1">{report.submittedAt}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
