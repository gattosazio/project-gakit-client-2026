import type { DecisionReason } from '@/lib/reports/decisionReasons';
import { Camera, MapPin } from 'lucide-react';
import {
  DEPTH_BAR_COLOR, DEPTH_LABELS, formatDateTime, formatReportDepth,
  getReportAssessmentBasis, timeAgo,
} from '@/lib/reports/reportFormatting';
import type { Report, ReportStatus } from '@/types/report';
import { ReportActions, StatusDropdown } from './ReportActions';

export const REPORT_TABLE_COLUMNS = 'xl:grid-cols-[minmax(0,1fr)_180px_72px_132px_88px_120px_120px]';

export function ReportTableRow({ report, highlighted, selected, updating, onInspect, onViewDetails, onUpdateStatus, compactTable = false }: {
  report: Report;
  highlighted: boolean;
  selected: boolean;
  updating: boolean;
  onInspect: () => void;
  onViewDetails: () => void;
  onUpdateStatus: (report: Report, status: ReportStatus, reason?: DecisionReason) => Promise<boolean>;
  compactTable?: boolean;
}) {
  const evidence = getReportAssessmentBasis(report);
  const needsReview = report.status === 'UNVERIFIED' && ['head', 'overhead'].includes(report.depth.code);
  const address = report.location.address || 'Unknown location';
  const reporterType = report.reporterType ?? (report.validationFlags?.includes('STAFF_REPORTER') ? 'staff' : null);
  const isStaffReporter = reporterType === 'staff';
  const rowColor = highlighted ? 'bg-maroon-100' : selected ? 'bg-maroon-100/80' : 'hover:bg-slate-50';
  const reporterLabel = isStaffReporter ? 'Staff' : reporterType === 'public' ? 'Public' : 'Unknown reporter';
  const numericDepth = typeof report.depthCm === 'number' && Number.isFinite(report.depthCm) ? report.depthCm : null;
  const depthLabel = DEPTH_LABELS[report.depth.code];
  return (
    <>
    {!compactTable && <div role="row" data-highlighted-report={highlighted ? report.id : undefined}
      className={`report-row-compact border-l-2 px-3 py-2.5 xl:hidden ${rowColor} ${needsReview ? 'border-l-amber-500' : 'border-l-transparent'}`}>
      <div role="cell" aria-colspan={7} className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={onViewDetails} title={address}
            className="min-w-0 text-left text-xs font-semibold leading-4 text-slate-900 hover:text-gakit-maroon focus-visible:outline-gakit-maroon">
            <span className="line-clamp-2 break-words">{address}</span>
          </button>
          <time dateTime={report.createdAt} title={formatDateTime(report.createdAt)} className="shrink-0 pt-0.5 text-[10px] text-slate-400">{timeAgo(report.createdAt)}</time>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[11px] font-semibold text-slate-700">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: DEPTH_BAR_COLOR[report.depth.code] }} aria-hidden="true" />
            {formatReportDepth(report.depth, report.depthCm)}
          </p>
          {report.photoUrl && <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Camera className="h-3 w-3" aria-hidden="true" />Photo</span>}
          {needsReview && <span className="text-[10px] font-semibold text-amber-800">Needs review</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-[10px] leading-4 text-slate-500">
          <span className={isStaffReporter ? 'font-semibold text-gakit-maroon' : ''}>{reporterLabel}</span>
          <span aria-hidden="true">·</span>
          <span title={evidence.title}>{evidence.label}</span>
          <span className="font-mono text-slate-400" title={report.id}>#{report.id.slice(0, 8)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <StatusDropdown report={report} isUpdating={updating} onUpdateStatus={onUpdateStatus} />
          <div className="flex items-center gap-1">
            <button type="button" onClick={onInspect} aria-label={`View report ${report.id.slice(0, 8)} on map`} title="View on map"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-gakit-maroon focus-visible:outline-gakit-maroon">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <ReportActions report={report} showInspect={false} onInspect={onInspect} onViewDetails={onViewDetails} />
          </div>
        </div>
      </div>
    </div>}
    <div role="row" data-highlighted-report={highlighted ? report.id : undefined}
      className={`report-row-wide hidden xl:grid grid-cols-2 items-start gap-x-3 gap-y-3 border-l-2 px-4 py-3 sm:grid-cols-3 xl:items-center ${REPORT_TABLE_COLUMNS} ${
        highlighted ? 'bg-maroon-100' : selected ? 'bg-maroon-100/80' : 'hover:bg-slate-50'
      } ${needsReview ? 'border-l-amber-500' : 'border-l-transparent'}`}>
      <div role="cell" className="col-span-2 min-w-0 sm:col-span-3 xl:col-span-1">
        <button type="button" onClick={onViewDetails} title={address}
          className={`block max-w-full text-left font-semibold text-slate-900 underline-offset-2 hover:text-gakit-maroon hover:underline focus-visible:rounded focus-visible:outline-gakit-maroon ${compactTable ? 'text-[11px] leading-4' : 'text-sm leading-5'}`}>
          <span className="line-clamp-2 break-words">{address}</span>
        </button>
        {!compactTable && <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[10px] text-slate-400" title={report.id}>#{report.id.slice(0, 8)}</span>
          {report.photoUrl && <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Camera className="h-3 w-3" aria-hidden="true" />Photo</span>}
          {needsReview && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Needs review</span>}
          {!compactTable && <button type="button" onClick={onInspect} aria-label={`View report ${report.id.slice(0, 8)} on map`}
            className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-slate-500 hover:text-gakit-maroon hover:underline focus-visible:outline-gakit-maroon">
            <MapPin className="h-3 w-3" aria-hidden="true" />View on map
          </button>}
        </div>}
      </div>
      <div role="cell" className="col-span-2 min-w-0 xl:col-span-1">
        <span className="report-cell-label mb-1 block text-[10px] text-slate-400 xl:hidden">Flood depth</span>
        {compactTable ? <div className="text-[11px] font-semibold leading-4 text-slate-800">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: DEPTH_BAR_COLOR[report.depth.code] }} aria-hidden="true" />
          {numericDepth === null ? depthLabel : `${numericDepth}${report.depth.code === 'overhead' ? '+' : ''} cm`}
          {numericDepth !== null && <span className="block text-[9px] font-normal text-slate-500">{depthLabel}</span>}
        </div> : <p className="whitespace-nowrap text-xs font-semibold leading-5 text-slate-800">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: DEPTH_BAR_COLOR[report.depth.code] }} aria-hidden="true" />
          {formatReportDepth(report.depth, report.depthCm)}
        </p>}
      </div>
      <div role="cell">
        <span className="report-cell-label mb-1 block text-[10px] text-slate-400 xl:hidden">Reporter</span>
        <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${isStaffReporter ? 'bg-maroon-50 text-gakit-maroon' : 'bg-slate-100 text-slate-600'}`}>
          {isStaffReporter ? 'Staff' : reporterType === 'public' ? 'Public' : 'Unknown'}
        </span>
      </div>
      {!compactTable && <div role="cell" title={evidence.title}>
        <span className="report-cell-label mb-1 block text-[10px] text-slate-400 xl:hidden">Assessment basis</span>
        <span className={`block leading-4 text-slate-600 ${compactTable ? 'text-[10px]' : 'text-[11px]'}`}>{evidence.label}</span>
      </div>}
      {compactTable && <div role="cell" className="flex min-w-0 items-center gap-1">
        {needsReview && <span role="img" aria-label="Needs review" title="High reported depth needs review" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
        <StatusDropdown report={report} isUpdating={updating} onUpdateStatus={onUpdateStatus} compact />
      </div>}
      <div role="cell">
        <span className="report-cell-label mb-1 block text-[10px] text-slate-400 xl:hidden">Submitted</span>
        <time dateTime={report.createdAt} title={formatDateTime(report.createdAt)} className={`${compactTable ? 'text-[10px]' : 'text-xs'} text-slate-600`}>{timeAgo(report.createdAt)}</time>
      </div>
      {!compactTable && <div role="cell" className="min-w-0">
        <span className="report-cell-label mb-1 block text-[10px] text-slate-400 xl:hidden">Status</span>
        <StatusDropdown report={report} isUpdating={updating} onUpdateStatus={onUpdateStatus} compact={compactTable} />
      </div>}
      <div role="cell" className="col-span-2 sm:col-span-2 xl:col-span-1">
        <ReportActions report={report} showInspect={compactTable} compact={compactTable} onInspect={onInspect} onViewDetails={onViewDetails} />
      </div>
    </div>
    </>
  );
}
