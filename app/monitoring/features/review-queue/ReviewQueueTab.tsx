'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Layers,
  MapPinned,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { FeaturePageShell } from '../shared/FeaturePageShell';

type AIVerdict = 'Verified' | 'Anomaly' | 'Needs Review';
type Priority = 'High' | 'Medium' | 'Low';
type FlagReason = 'AI Conflict' | 'Depth Mismatch' | 'Weak Evidence' | 'Duplicate Pattern';
type EvidenceSupport = 'Strong' | 'Partial' | 'Weak' | 'Mismatch';

interface ReviewItem {
  id: string;
  location: string;
  barangay: string;
  reportedDepth: string;
  aiVerdict: AIVerdict;
  confidence: number;
  priority: Priority;
  flagReason: FlagReason;
  submittedAt: string;
  recommendedAction: string;
  explanation: string;
  evidence: {
    citizenReports: { value: string; support: EvidenceSupport };
    externalRainfall: { value: string; support: EvidenceSupport };
    terrain: { value: string; support: EvidenceSupport };
    interpolation: { value: string; support: EvidenceSupport };
  };
}

const reviewItems: ReviewItem[] = [
  {
    id: 'GAKIT-284193',
    location: 'Pala-o Market',
    barangay: 'Pala-o',
    reportedDepth: 'Ankle Deep',
    aiVerdict: 'Anomaly',
    confidence: 42,
    priority: 'Medium',
    flagReason: 'AI Conflict',
    submittedAt: 'Today, 09:54 AM',
    recommendedAction: 'Keep pending and request another nearby report.',
    explanation: 'AI/PIML marked this as anomaly because nearby citizen reports and interpolation do not support the submitted depth.',
    evidence: {
      citizenReports: { value: '0 matching reports within 500m', support: 'Weak' },
      externalRainfall: { value: 'Moderate rainfall only', support: 'Partial' },
      terrain: { value: 'Area is not a strong low-point match', support: 'Mismatch' },
      interpolation: { value: 'Estimated: no flood to ankle deep', support: 'Mismatch' },
    },
  },
  {
    id: 'GAKIT-284197',
    location: 'Tibanga Bridge Access',
    barangay: 'Tibanga',
    reportedDepth: 'Waist Deep',
    aiVerdict: 'Needs Review',
    confidence: 56,
    priority: 'High',
    flagReason: 'Depth Mismatch',
    submittedAt: 'Today, 09:28 AM',
    recommendedAction: 'Review photo evidence or ask staff to confirm depth.',
    explanation: 'The location is flood-prone, but interpolation estimates a lower water level than reported.',
    evidence: {
      citizenReports: { value: '2 nearby reports confirm flooding', support: 'Strong' },
      externalRainfall: { value: 'Heavy rainfall detected nearby', support: 'Strong' },
      terrain: { value: 'Low-lying bridge approach', support: 'Strong' },
      interpolation: { value: 'Estimated: knee deep', support: 'Mismatch' },
    },
  },
  {
    id: 'GAKIT-284201',
    location: 'Hinaplanon Road',
    barangay: 'Hinaplanon',
    reportedDepth: 'Head Deep',
    aiVerdict: 'Needs Review',
    confidence: 61,
    priority: 'High',
    flagReason: 'Weak Evidence',
    submittedAt: 'Today, 08:45 AM',
    recommendedAction: 'Escalate if another high-depth report appears nearby.',
    explanation: 'AI/PIML found high severity but limited citizen confirmation around the exact location.',
    evidence: {
      citizenReports: { value: '1 nearby report, lower depth', support: 'Partial' },
      externalRainfall: { value: 'Heavy rainfall in last hour', support: 'Strong' },
      terrain: { value: 'Low-lying road segment', support: 'Strong' },
      interpolation: { value: 'Estimated: waist deep', support: 'Partial' },
    },
  },
  {
    id: 'GAKIT-284205',
    location: 'San Miguel Crossing',
    barangay: 'San Miguel',
    reportedDepth: 'Knee Deep',
    aiVerdict: 'Anomaly',
    confidence: 38,
    priority: 'Low',
    flagReason: 'Duplicate Pattern',
    submittedAt: 'Today, 08:12 AM',
    recommendedAction: 'Mark as duplicate if location and photo match prior report.',
    explanation: 'The report appears similar to an earlier citizen submission from the same area.',
    evidence: {
      citizenReports: { value: 'Similar report submitted 6 minutes earlier', support: 'Partial' },
      externalRainfall: { value: 'Rainfall supports flooding', support: 'Strong' },
      terrain: { value: 'Known low-point crossing', support: 'Strong' },
      interpolation: { value: 'Estimated: knee deep', support: 'Strong' },
    },
  },
];

const verdicts: Array<'All' | AIVerdict> = ['All', 'Verified', 'Anomaly', 'Needs Review'];
const priorities: Array<'All' | Priority> = ['All', 'High', 'Medium', 'Low'];
const reasons: Array<'All' | FlagReason> = ['All', 'AI Conflict', 'Depth Mismatch', 'Weak Evidence', 'Duplicate Pattern'];
const REVIEW_ITEMS_PER_PAGE = 3;

const verdictStyles: Record<AIVerdict, string> = {
  Verified: 'bg-green-50 text-hazard-safe border-green-200',
  Anomaly: 'bg-red-50 text-hazard-critical border-red-200',
  'Needs Review': 'bg-amber-50 text-hazard-pending border-amber-200',
};

const priorityStyles: Record<Priority, string> = {
  High: 'text-hazard-critical',
  Medium: 'text-hazard-pending',
  Low: 'text-slate-500',
};

const supportStyles: Record<EvidenceSupport, string> = {
  Strong: 'bg-green-50 text-hazard-safe border-green-200',
  Partial: 'bg-blue-50 text-[#004aad] border-blue-200',
  Weak: 'bg-amber-50 text-hazard-pending border-amber-200',
  Mismatch: 'bg-red-50 text-hazard-critical border-red-200',
};

export function ReviewQueueTab() {
  const [query, setQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'All' | AIVerdict>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All');
  const [reasonFilter, setReasonFilter] = useState<'All' | FlagReason>('All');
  const [selectedItemId, setSelectedItemId] = useState(reviewItems[0].id);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredItems = reviewItems.filter((item) => {
    const matchesQuery = `${item.id} ${item.location} ${item.barangay}`
      .toLowerCase()
      .includes(query.toLowerCase());
    const matchesVerdict = verdictFilter === 'All' || item.aiVerdict === verdictFilter;
    const matchesPriority = priorityFilter === 'All' || item.priority === priorityFilter;
    const matchesReason = reasonFilter === 'All' || item.flagReason === reasonFilter;

    return matchesQuery && matchesVerdict && matchesPriority && matchesReason;
  });

  const selectedItem =
    reviewItems.find((item) => item.id === selectedItemId) || filteredItems[0] || reviewItems[0];
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / REVIEW_ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedItems = filteredItems.slice(
    (safeCurrentPage - 1) * REVIEW_ITEMS_PER_PAGE,
    safeCurrentPage * REVIEW_ITEMS_PER_PAGE
  );

  const resetFilters = () => {
    setQuery('');
    setVerdictFilter('All');
    setPriorityFilter('All');
    setReasonFilter('All');
    setCurrentPage(1);
  };

  return (
    <FeaturePageShell
      toolbar={
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(16rem,1fr)_11rem_11rem_12rem_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search ID, location, or barangay"
              className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
            />
          </label>

          <select
            value={verdictFilter}
            onChange={(event) => {
              setVerdictFilter(event.target.value as 'All' | AIVerdict);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            {verdicts.map((verdict) => (
              <option key={verdict}>{verdict}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => {
              setPriorityFilter(event.target.value as 'All' | Priority);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>

          <select
            value={reasonFilter}
            onChange={(event) => {
              setReasonFilter(event.target.value as 'All' | FlagReason);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none"
          >
            {reasons.map((reason) => (
              <option key={reason}>{reason}</option>
            ))}
          </select>

          <button
            onClick={resetFilters}
            className="flex items-center justify-center gap-2 rounded-lg border border-canvas-grey bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
        </div>
      }
    >
      <section className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_26rem] gap-4">
        <div className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-canvas-grey flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Flagged Reports</h3>
              <p className="text-sm text-slate-500">{filteredItems.length} reports require staff decision</p>
            </div>
            {/* <div className="text-xs font-semibold text-slate-500">AI/PIML verdict first</div> */}
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas-light text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">Report</th>
                  <th className="text-left font-semibold px-5 py-3">Location</th>
                  <th className="text-left font-semibold px-5 py-3">AI/PIML Verdict</th>
                  <th className="text-left font-semibold px-5 py-3">Confidence</th>
                  <th className="text-left font-semibold px-5 py-3">Reason</th>
                  <th className="text-left font-semibold px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-grey">
                {paginatedItems.map((item) => (
                  <tr
                    key={item.id}
                    className={selectedItem.id === item.id ? 'bg-blue-50/60' : 'hover:bg-canvas-light/70'}
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{item.id}</div>
                      <div className={`text-xs font-semibold ${priorityStyles[item.priority]}`}>{item.priority} priority</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700">{item.location}</div>
                      <div className="text-xs text-slate-500">{item.barangay}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${verdictStyles[item.aiVerdict]}`}>
                        {item.aiVerdict}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <ConfidenceBar value={item.confidence} />
                    </td>
                    <td className="px-5 py-4 text-slate-600">{item.flagReason}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setSelectedItemId(item.id)}
                        className="rounded-lg border border-canvas-grey px-3 py-2 text-xs font-semibold text-slate-700 hover:border-[#004aad] hover:text-[#004aad]"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden divide-y divide-canvas-grey">
            {paginatedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className="w-full p-4 text-left hover:bg-canvas-light"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{item.id}</div>
                    <div className="text-sm text-slate-600 mt-1">{item.location}</div>
                    <div className="text-xs text-slate-500 mt-1">{item.flagReason}</div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${verdictStyles[item.aiVerdict]}`}>
                    {item.aiVerdict}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <ReviewQueuePagination
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={filteredItems.length}
            pageSize={REVIEW_ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </div>

        <ReviewDetails item={selectedItem} />
      </section>
    </FeaturePageShell>
  );
}

function ReviewDetails({ item }: { item: ReviewItem }) {
  return (
    <aside className="bg-white border border-canvas-grey rounded-lg shadow-sm overflow-hidden">
      <div className="p-5 border-b border-canvas-grey">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">AI/PIML Assessment</h3>
            <p className="text-sm text-slate-500 mt-1">{item.id}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${verdictStyles[item.aiVerdict]}`}>
            {item.aiVerdict}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="rounded-lg bg-canvas-light border border-canvas-grey p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MapPinned className="w-4 h-4 text-[#004aad]" />
            {item.location}
          </div>
          <div className="text-sm text-slate-600 mt-2">{item.barangay}</div>
          <div className="text-xs text-slate-500 mt-1">
            Reported depth: {item.reportedDepth} | Submitted {item.submittedAt}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-900">Confidence</span>
            <span className="font-bold text-slate-900">{item.confidence}%</span>
          </div>
          <ConfidenceBar value={item.confidence} />
        </div>

        <div className="rounded-lg border border-canvas-grey p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <AlertTriangle className="w-4 h-4 text-hazard-pending" />
            Why this needs review
          </div>
          <p className="text-sm text-slate-600 mt-2">{item.explanation}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EvidenceCard icon={Users} label="Citizen Reports" value={item.evidence.citizenReports.value} support={item.evidence.citizenReports.support} />
          <EvidenceCard icon={CloudRain} label="External Rainfall" value={item.evidence.externalRainfall.value} support={item.evidence.externalRainfall.support} />
          <EvidenceCard icon={MapPinned} label="Terrain/Elevation" value={item.evidence.terrain.value} support={item.evidence.terrain.support} />
          <EvidenceCard icon={Layers} label="Interpolation" value={item.evidence.interpolation.value} support={item.evidence.interpolation.support} />
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
          <div className="text-sm font-semibold text-slate-900">Recommended Decision</div>
          <p className="text-sm text-slate-600 mt-2">{item.recommendedAction}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-lg bg-[#004aad] px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
            Confirm Verdict
          </button>
          <button className="rounded-lg border border-canvas-grey px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-canvas-light">
            Override
          </button>
          <button className="rounded-lg border border-canvas-grey px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-canvas-light">
            Escalate
          </button>
          <button className="rounded-lg border border-canvas-grey px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-canvas-light">
            Keep Pending
          </button>
        </div>
      </div>
    </aside>
  );
}

function EvidenceCard({
  icon: Icon,
  label,
  value,
  support,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  support: EvidenceSupport;
}) {
  return (
    <div className="rounded-lg border border-canvas-grey p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="w-4 h-4 text-[#004aad]" />
        {label}
      </div>
      <p className="text-xs text-slate-600 mt-2 min-h-8">{value}</p>
      <span className={`mt-3 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${supportStyles[support]}`}>
        {support}
      </span>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="mt-2">
      <div className="h-2 rounded-full bg-canvas-grey overflow-hidden">
        <div className="h-full rounded-full bg-[#004aad]" style={{ width: `${value}%` }} />
      </div>
      <div className="text-xs text-slate-500 mt-1">{value}% confidence</div>
    </div>
  );
}

function ReviewQueuePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="border-t border-canvas-grey px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-500">
        Showing {startItem}-{endItem} of {totalItems} flagged reports
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-2 rounded-lg border border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2 text-sm font-semibold text-slate-700">
          Page {currentPage} of {totalPages}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-2 rounded-lg border border-canvas-grey px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-canvas-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
