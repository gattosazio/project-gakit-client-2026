'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  MapPin,
  ShieldAlert,
} from 'lucide-react';

const metrics = [
  { label: 'Reports Today', value: '38', detail: '+12 from yesterday', icon: FileText, color: 'text-[#004aad]' },
  { label: 'Pending Validation', value: '14', detail: 'Needs review', icon: Clock, color: 'text-hazard-pending' },
  { label: 'Critical Reports', value: '6', detail: 'Impassable areas', icon: AlertTriangle, color: 'text-hazard-critical' },
  { label: 'Verified Reports', value: '21', detail: 'Trusted map pins', icon: CheckCircle2, color: 'text-hazard-safe' },
];

const reports = [
  { id: 'GAKIT-284190', location: 'Hinaplanon Road', depth: 'Waist Deep', status: 'Pending', time: '10:42 AM' },
  { id: 'GAKIT-284191', location: 'Tibanga Bridge', depth: 'Knee Deep', status: 'Verified', time: '10:31 AM' },
  { id: 'GAKIT-284192', location: 'San Miguel', depth: 'Overhead', status: 'Critical', time: '10:18 AM' },
  { id: 'GAKIT-284193', location: 'Pala-o Market', depth: 'Ankle Deep', status: 'Anomaly', time: '09:54 AM' },
];

const heatmapMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const heatmapRows = ['Mon', 'Wed', 'Fri'];
const heatmapData = [
  [1, 2, 0, 3, 1, 0, 2, 1, 4, 3, 0, 2, 1, 2, 3, 0, 1, 2, 4, 3, 2, 1, 0, 2],
  [0, 1, 2, 2, 0, 1, 3, 2, 2, 1, 4, 3, 1, 0, 2, 4, 3, 2, 1, 1, 2, 3, 4, 2],
  [2, 3, 1, 0, 2, 4, 3, 1, 0, 2, 2, 1, 3, 4, 2, 1, 0, 2, 3, 4, 2, 1, 3, 4],
  [1, 0, 2, 3, 4, 2, 1, 0, 2, 3, 1, 0, 2, 2, 4, 3, 2, 1, 0, 2, 4, 3, 2, 1],
  [0, 2, 4, 3, 1, 0, 2, 4, 3, 2, 1, 0, 2, 3, 4, 2, 1, 0, 2, 4, 3, 1, 0, 2],
  [3, 4, 2, 1, 0, 2, 4, 3, 2, 1, 0, 2, 3, 4, 2, 1, 0, 2, 4, 3, 2, 1, 0, 2],
  [2, 1, 0, 2, 3, 4, 2, 1, 0, 2, 4, 3, 1, 0, 2, 3, 4, 2, 1, 0, 2, 3, 4, 2],
];

function getHeatmapClass(level: number) {
  if (level >= 4) return 'admin-heatmap-cell admin-heatmap-cell-4';
  if (level === 3) return 'admin-heatmap-cell admin-heatmap-cell-3';
  if (level === 2) return 'admin-heatmap-cell admin-heatmap-cell-2';
  if (level === 1) return 'admin-heatmap-cell admin-heatmap-cell-1';
  return 'admin-heatmap-cell admin-heatmap-cell-0';
}

export function DashboardOverview() {
  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div key={metric.label} className="bg-white border border-canvas-grey rounded-lg p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-500">{metric.label}</div>
                  <div className="text-3xl font-bold text-slate-900 mt-2">{metric.value}</div>
                </div>
                <Icon className={`w-6 h-6 ${metric.color}`} />
              </div>
              <div className="text-xs text-slate-500 mt-4">{metric.detail}</div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
          <div className="p-5 border-b border-canvas-grey flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Latest Reports</h2>
              <p className="text-sm text-slate-500">Newest flood reports from the public map.</p>
            </div>
            <MapPin className="w-5 h-5 text-[#004aad]" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas-light text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">ID</th>
                  <th className="text-left font-semibold px-5 py-3">Location</th>
                  <th className="text-left font-semibold px-5 py-3">Depth</th>
                  <th className="text-left font-semibold px-5 py-3">Status</th>
                  <th className="text-left font-semibold px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-grey">
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-5 py-4 font-semibold text-slate-900">{report.id}</td>
                    <td className="px-5 py-4 text-slate-600">{report.location}</td>
                    <td className="px-5 py-4 text-slate-600">{report.depth}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-blue-50 text-[#004aad] px-2.5 py-1 text-xs font-semibold">
                        {report.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{report.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#004aad] text-white rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6" />
            <h2 className="font-bold">Emergency Status</h2>
          </div>
          <div className="text-4xl font-bold mt-6">Elevated</div>
          <p className="text-sm text-white/80 mt-3">
            Six reports are marked critical. Prioritize validation and responder review.
          </p>
          <button className="mt-6 w-full py-3 rounded-lg bg-white text-[#004aad] font-semibold hover:bg-white/90 transition-colors">
            Review Critical Reports
          </button>
        </div>
      </section>

      <section className="bg-white border border-canvas-grey rounded-lg p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-bold text-slate-900">Reports Over Time</h2>
            <p className="text-sm text-slate-500">
              Report intensity by week and day across the last 6 months.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4" />
            Darker cells mean more reports submitted.
          </div>
        </div>

        <div className="admin-heatmap-layout">
          <div className="admin-heatmap-months">
            {heatmapMonths.map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>

          <div className="admin-heatmap-body">
            <div className="admin-heatmap-days">
              {Array.from({ length: 7 }).map((_, index) => (
                <span key={index}>
                  {heatmapRows.includes(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index])
                    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]
                    : ''}
                </span>
              ))}
            </div>

            <div className="admin-heatmap-grid">
              {heatmapData.map((row, rowIndex) =>
                row.map((value, columnIndex) => (
                  <div
                    key={`${rowIndex}-${columnIndex}`}
                    className={getHeatmapClass(value)}
                    title={`${value} reports`}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3 text-xs text-slate-500">
          <span>Less</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((level) => (
              <div key={level} className={getHeatmapClass(level)} />
            ))}
          </div>
          <span>More</span>
        </div>
      </section>
    </>
  );
}
