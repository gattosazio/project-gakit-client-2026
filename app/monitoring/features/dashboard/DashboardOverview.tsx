'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
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

const monthlyReports = [
  { month: 'Jan', reports: 42 },
  { month: 'Feb', reports: 58 },
  { month: 'Mar', reports: 73 },
  { month: 'Apr', reports: 51 },
  { month: 'May', reports: 88 },
  { month: 'Jun', reports: 126 },
  { month: 'Jul', reports: 142 },
  { month: 'Aug', reports: 118 },
  { month: 'Sep', reports: 96 },
  { month: 'Oct', reports: 84 },
  { month: 'Nov', reports: 67 },
  { month: 'Dec', reports: 53 },
];
const years = ['2026', '2025', '2024'];
const maxMonthlyReports = Math.max(...monthlyReports.map((item) => item.reports));

export function DashboardOverview() {
  const [selectedYear, setSelectedYear] = useState(years[0]);

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
        <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Reports Over Time</h2>
            <p className="text-sm text-slate-500">
              Monthly public report volume for {selectedYear}.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
            >
              {years.map((year) => (
                <option key={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-bar-chart">
          {monthlyReports.map((item) => (
            <div key={item.month} className="admin-bar-item">
              <div className="admin-bar-value">{item.reports}</div>
              <div
                className="admin-bar"
                style={{ height: `${Math.max(12, (item.reports / maxMonthlyReports) * 100)}%` }}
                title={`${item.month} ${selectedYear}: ${item.reports} reports`}
              />
              <div className="admin-bar-label">{item.month}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
