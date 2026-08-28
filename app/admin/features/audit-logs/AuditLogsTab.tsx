'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { FeaturePageShell } from '@/components/FeaturePageShell';
import { AdminPagination } from '../shared/AdminPagination';
import {
  AUDIT_ACTION_OPTIONS,
  auditActionMeta,
  formatJsonDetails,
  shortenId,
} from '../shared/adminFormatting';
import { listAuditLogs } from '../../actions/admin';
import type { AuditLogEntry } from '@/types/admin';
import { formatDateTime } from '@/lib/reports/reportFormatting';

const LOGS_PER_PAGE = 15;

export function AuditLogsTab({ active = true }: { active?: boolean }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('all');
  const [actorEmail, setActorEmail] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const seq = requestSeqRef.current + 1;
      requestSeqRef.current = seq;
      setLoading(true);
      setError(null);

      void listAuditLogs({
        page: currentPage,
        limit: LOGS_PER_PAGE,
        action: action === 'all' ? undefined : action,
        actor_email: actorEmail.trim() || undefined,
        from_date: fromDate ? `${fromDate}T00:00:00Z` : undefined,
        to_date: toDate ? `${toDate}T23:59:59Z` : undefined,
      })
        .then((result) => {
          if (seq !== requestSeqRef.current) return;
          setLogs(result.items);
          setTotal(result.total);
          setTotalPages(Math.max(1, result.totalPages));
        })
        .catch((err: unknown) => {
          if (seq !== requestSeqRef.current) return;
          setError(
            err instanceof Error ? err.message : 'Failed to load audit logs'
          );
          setLogs([]);
          setTotal(0);
          setTotalPages(1);
        })
        .finally(() => {
          if (seq === requestSeqRef.current) setLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [active, currentPage, action, actorEmail, fromDate, toDate]);

  const canReset =
    action !== 'all' ||
    actorEmail.trim() !== '' ||
    fromDate !== '' ||
    toDate !== '';

  const resetFilters = () => {
    setAction('all');
    setActorEmail('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  return (
    <FeaturePageShell
      bare
      toolbar={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_12rem_10rem_10rem_auto]">
          <label className="flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={actorEmail}
              onChange={(event) => {
                setActorEmail(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter by actor email"
              className="w-full bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
            />
          </label>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2 text-sm text-slate-700 outline-none focus:border-gakit-maroon/40 focus:bg-white"
          >
            <option value="all">All actions</option>
            {AUDIT_ACTION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {auditActionMeta(value).label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2">
            <span className="text-xs font-semibold text-slate-400">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-sm text-slate-700 outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-canvas-grey bg-canvas-light px-3 py-2">
            <span className="text-xs font-semibold text-slate-400">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-sm text-slate-700 outline-none"
            />
          </label>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!canReset}
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
              canReset
                ? 'border-canvas-grey bg-white text-slate-700 hover:bg-canvas-light hover:border-slate-300 cursor-pointer'
                : 'border-canvas-grey/60 bg-canvas-light/60 text-slate-400 cursor-not-allowed opacity-60'
            }`}
          >
            <RotateCcw
              className={`h-4 w-4 transition-colors ${
                canReset ? 'text-gakit-maroon' : 'text-slate-400'
              }`}
            />
            Reset
          </button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm">
        {error ? (
          <div className="p-6 text-sm text-red-700">{error}</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="bg-canvas-light text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Time</th>
                    <th className="px-5 py-3 text-left font-semibold">Action</th>
                    <th className="px-5 py-3 text-left font-semibold">Actor</th>
                    <th className="px-5 py-3 text-left font-semibold">Resource</th>
                    <th className="px-5 py-3 text-left font-semibold">Details</th>
                    <th className="px-5 py-3 text-left font-semibold">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-grey">
                  {logs.map((log) => {
                    const meta = auditActionMeta(log.action);
                    return (
                      <tr key={log.id} className="hover:bg-canvas-light/70">
                        <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-slate-800">
                            {log.actorEmail ?? 'System'}
                          </div>
                          <div className="font-mono text-xs text-slate-400">
                            {shortenId(log.actorUserId)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {log.resourceType}
                          </div>
                          <div className="font-mono text-xs text-slate-400">
                            {shortenId(log.resourceId)}
                          </div>
                        </td>
                        <td className="max-w-[16rem] px-5 py-3.5 text-xs text-slate-600">
                          <span
                            className="block truncate"
                            title={formatJsonDetails(log.details)}
                          >
                            {formatJsonDetails(log.details)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-400">
                          {log.ipAddress ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-10 text-center text-sm text-slate-500"
                      >
                        No audit entries match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-canvas-grey lg:hidden">
              {logs.map((log) => {
                const meta = auditActionMeta(log.action);
                return (
                  <div key={log.id} className="space-y-1.5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-slate-800">
                      {log.actorEmail ?? 'System'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {log.resourceType}
                      {log.resourceId ? ` · ${shortenId(log.resourceId)}` : ''}
                      {log.ipAddress ? ` · ${log.ipAddress}` : ''}
                    </div>
                    <div className="line-clamp-2 text-xs text-slate-600">
                      {formatJsonDetails(log.details)}
                    </div>
                  </div>
                );
              })}
              {logs.length === 0 && !loading && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  No audit entries match the current filters.
                </div>
              )}
            </div>

            <AdminPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              pageSize={LOGS_PER_PAGE}
              itemLabel="entries"
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </FeaturePageShell>
  );
}