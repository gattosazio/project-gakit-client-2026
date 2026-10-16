import { Camera, MapPin } from 'lucide-react';
import {
  DEPTH_BAR_COLOR, formatDateTime, formatReportDepth,
  getReportScoreDisplay, timeAgo,
} from '@/lib/reports/reportFormatting';
import type { Report, ReportStatus } from '@/types/report';
import { ReportActions, StatusDropdown } from './ReportActions';

export const REPORT_TABLE_COLUMNS = 'xl:grid-cols-[minmax(0,1fr)_180px_72px_76px_88px_120px_120px]';

export function ReportTableRow({ report, highlighted, selected, updating, onInspect, onViewDetails, onUpdateStatus }: {
  report: Report;
  highlighted: boolean;
  selected: boolean;
  updating: boolean;
  onInspect: () => void;
  onViewDetails: () => void;
  onUpdateStatus: (report: Report, status: ReportStatus, reason?: string) => Promise<boolean>;
}) {
  const evidence = getReportScoreDisplay(report);
  const needsReview = report.status === 'UNVERIFIED' && ['head', 'overhead'].includes(report.depth.code);
  const address = report.location.address || 'Unknown location';
  const reporterType = report.reporterType ?? (report.validationFlags?.includes('STAFF_REPORTER') ? 'staff' : null);
  const isStaffReporter = reporterType === 'staff';
  const rowColor = highlighted ? 'bg-maroon-100' : selected ? 'bg-maroon-100/80' : 'hover:bg-slate-50';
  const reporterLabel = isStaffReporter ? 'Staff' : reporterType === 'public' ? 'Public' : 'Unknown reporter';
  return (
    <>
    <div role="row" data-highlighted-report={highlighted ? report.id : undefined}
      className={`border-l-2 px-3 py-2.5 xl:hidden ${rowColor} ${needsReview ? 'border-l-violet-500' : 'border-l-transparent'}`}>
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
          {needsReview && <span className="text-[10px] font-semibold text-violet-700">Needs review</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-[10px] leading-4 text-slate-500">
          <span className={isStaffReporter ? 'font-semibold text-gakit-maroon' : ''}>{reporterLabel}</span>
          <span aria-hidden="true">·</span>
          <span title={evidence.title}>{evidence.score == null ? 'Awaiting assessment' : `${evidence.score} evidence points`}</span>
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
    </div>
    <div role="row" data-highlighted-report={highlighted ? report.id : undefined}
      className={`hidden xl:grid grid-cols-2 items-start gap-x-3 gap-y-3 border-l-2 px-4 py-3 sm:grid-cols-3 xl:items-center ${REPORT_TABLE_COLUMNS} ${
        highlighted ? 'bg-maroon-100' : selected ? 'bg-maroon-100/80' : 'hover:bg-slate-50'
      } ${needsReview ? 'border-l-violet-500' : 'border-l-transparent'}`}>
      <div role="cell" className="col-span-2 min-w-0 sm:col-span-3 xl:col-span-1">
        <button type="button" onClick={onViewDetails} title={address}
          className="block max-w-full text-left text-sm font-semibold leading-5 text-slate-900 underline-offset-2 hover:text-gakit-maroon hover:underline focus-visible:rounded focus-visible:outline-gakit-maroon">
          <span className="line-clamp-2 break-words">{address}</span>
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[10px] text-slate-400" title={report.id}>#{report.id.slice(0, 8)}</span>
          {report.photoUrl && <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Camera className="h-3 w-3" aria-hidden="true" />Photo</span>}
          {needsReview && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Needs review</span>}
          <button type="button" onClick={onInspect} aria-label={`View report ${report.id.slice(0, 8)} on map`}
            className="inline-flex items-center gap-1 rounded text-[11px] font-medium text-slate-500 hover:text-gakit-maroon hover:underline focus-visible:outline-gakit-maroon">
            <MapPin className="h-3 w-3" aria-hidden="true" />View on map
          </button>
        </div>
      </div>
      <div role="cell" className="col-span-2 min-w-0 xl:col-span-1">
        <span className="mb-1 block text-[10px] text-slate-400 xl:hidden">Flood depth</span>
        <p className="whitespace-nowrap text-xs font-semibold leading-5 text-slate-800">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: DEPTH_BAR_COLOR[report.depth.code] }} aria-hidden="true" />
          {formatReportDepth(report.depth, report.depthCm)}
        </p>
      </div>
      <div role="cell">
        <span className="mb-1 block text-[10px] text-slate-400 xl:hidden">Reporter</span>
        <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${isStaffReporter ? 'bg-maroon-50 text-gakit-maroon' : 'bg-slate-100 text-slate-600'}`}>
          {isStaffReporter ? 'Staff' : reporterType === 'public' ? 'Public' : 'Unknown'}
        </span>
      </div>
      <div role="cell" title={evidence.title}>
        <span className="mb-1 block text-[10px] text-slate-400 xl:hidden">Evidence</span>
        {evidence.score == null ? <span className="text-[11px] text-slate-400">Awaiting assessment</span>
          : <p className="text-xs text-slate-500"><strong className="font-semibold tabular-nums text-slate-800">{evidence.score}</strong> points</p>}
      </div>
      <div role="cell">
        <span className="mb-1 block text-[10px] text-slate-400 xl:hidden">Submitted</span>
        <time dateTime={report.createdAt} title={formatDateTime(report.createdAt)} className="text-xs text-slate-600">{timeAgo(report.createdAt)}</time>
      </div>
      <div role="cell" className="min-w-0">
        <span className="mb-1 block text-[10px] text-slate-400 xl:hidden">Status</span>
        <StatusDropdown report={report} isUpdating={updating} onUpdateStatus={onUpdateStatus} />
      </div>
      <div role="cell" className="col-span-2 sm:col-span-2 xl:col-span-1">
        <ReportActions report={report} showInspect={false} onInspect={onInspect} onViewDetails={onViewDetails} />
      </div>
    </div>
    </>
  );
}
