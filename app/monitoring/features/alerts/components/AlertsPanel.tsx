'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import type { Notification } from '@/lib/notifications';
import {
  partitionUnreadRead,
  sectionForNotificationId,
  type AlertSection,
  type AlertsView,
} from '@/lib/notifications/filters';
import { ReportsPagination } from '../../reports/ReportsPagination';
import { AlertListItem } from './AlertListItem';
import { EmptyNotifications } from './EmptyNotifications';

const NOTIFICATIONS_PER_PAGE = 25;

interface AlertsPanelProps {
  section: AlertSection;
  title: string;
  icon: LucideIcon;
  view: AlertsView;
  /** Already filtered and sorted by the section wrapper. */
  notifications: Notification[];
  readIds: string[];
  loading: boolean;
  error: string | null;
  highlightedId: string | null;
  /** Rendered under the header; holds the section's own chips + dropdowns. */
  filterBar: ReactNode;
  /** Change this to invalidate pagination (i.e. any filter/sort change). */
  resetKey: string;
  emptyState?: ReactNode;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  onDismissRequest: (id: string) => void;
  onOpenReports: (reportId?: string) => void;
  onSelectWeatherAlert?: (alert: NonNullable<Notification['weatherAlert']>) => void;
  onMarkAllRead?: (ids: string[]) => void;
}

/**
 * Shared mechanics for one side of the alerts inbox: unread/read grouping,
 * pagination, empty/loading/error states, and highlight routing. Section
 * specifics (which filters, which columns) stay in the wrappers.
 *
 * Pagination and the `?notification=` deep link are derived during render
 * rather than synced in effects: the page falls back to 1 whenever `resetKey`
 * changes, and a matching highlight pins the page to the row's index.
 */
export function AlertsPanel({
  section,
  title,
  icon: Icon,
  view,
  notifications,
  readIds,
  loading,
  error,
  highlightedId,
  filterBar,
  resetKey,
  emptyState,
  onMarkRead,
  onDismiss,
  onRestore,
  onDismissRequest,
  onOpenReports,
  onSelectWeatherAlert,
  onMarkAllRead,
}: AlertsPanelProps) {
  const [pageState, setPageState] = useState({ key: resetKey, page: 1 });
  const [unreadCollapsed, setUnreadCollapsed] = useState(false);
  const [readCollapsed, setReadCollapsed] = useState(false);

  const isArchivedView = view === 'archived';

  const { unread, read } = useMemo(
    () => partitionUnreadRead(notifications, readIds),
    [notifications, readIds]
  );

  // Archived items are already "done" — no unread/read split there.
  const orderedNotifications = useMemo(
    () => (isArchivedView ? notifications : [...unread, ...read]),
    [isArchivedView, notifications, read, unread]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(orderedNotifications.length / NOTIFICATIONS_PER_PAGE)
  );

  // Which group a deep-linked row belongs to, or -1 when this panel doesn't
  // own the highlight (or the row was filtered out).
  const highlightedIndex =
    highlightedId && sectionForNotificationId(highlightedId) === section
      ? orderedNotifications.findIndex((n) => n.id === highlightedId)
      : -1;
  const highlightOwnsView = highlightedIndex >= 0;

  const page = highlightOwnsView
    ? Math.floor(highlightedIndex / NOTIFICATIONS_PER_PAGE) + 1
    : pageState.key === resetKey
      ? pageState.page
      : 1;
  const safePage = Math.min(page, totalPages);

  const pagedNotifications = useMemo(
    () =>
      orderedNotifications.slice(
        (safePage - 1) * NOTIFICATIONS_PER_PAGE,
        safePage * NOTIFICATIONS_PER_PAGE
      ),
    [orderedNotifications, safePage]
  );

  const pagedUnread = useMemo(
    () => pagedNotifications.filter((n) => !readIds.includes(n.id)),
    [pagedNotifications, readIds]
  );
  const pagedRead = useMemo(
    () => pagedNotifications.filter((n) => readIds.includes(n.id)),
    [pagedNotifications, readIds]
  );

  // A deep-linked row must be visible, so force its group open. Clicking any
  // control clears the highlight (see the inbox's click-away listener), which
  // hands control back to the user's own collapse state.
  const highlightedIsRead = highlightOwnsView && !!highlightedId && readIds.includes(highlightedId);
  const showUnreadGroup =
    !isArchivedView && (!unreadCollapsed || (highlightOwnsView && !highlightedIsRead));
  const showReadGroup = !readCollapsed || (highlightOwnsView && highlightedIsRead);

  const setPage = (next: number) => setPageState({ key: resetKey, page: next });

  const handleMarkAllRead = () => {
    if (unread.length === 0) return;
    onMarkAllRead?.(unread.map((n) => n.id));
    setReadCollapsed(false);
    setUnreadCollapsed(false);
  };

  const count = notifications.length;
  const unreadCount = unread.length;

  const renderRow = (notification: Notification, isRead: boolean) => (
    <AlertListItem
      key={notification.id}
      notification={notification}
      view={view}
      onOpenReports={onOpenReports}
      onSelectWeatherAlert={onSelectWeatherAlert}
      onMarkRead={onMarkRead}
      onDismiss={onDismiss}
      onRestore={onRestore}
      isRead={isRead}
      highlighted={highlightedId === notification.id}
    />
  );

  const groupButtonClass =
    'flex w-full items-center gap-1.5 bg-canvas-light px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700';

  return (
    <section
      aria-label={title}
      className="min-w-0 self-start overflow-hidden rounded-2xl border border-canvas-grey bg-white shadow-sm"
    >
      <header className="space-y-2 border-b border-canvas-grey p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-canvas-light text-gakit-maroon">
                <Icon className="h-4 w-4" />
              </span>
              <span className="truncate">{title}</span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-500" aria-live="polite">
              {loading
                ? 'Loading…'
                : error
                  ? 'Unable to load'
                  : `${count} ${count === 1 ? 'alert' : 'alerts'}${
                      !isArchivedView && unreadCount > 0 ? ` · ${unreadCount} unread` : ''
                    }`}
            </p>
          </div>
          {!isArchivedView && !loading && !error && unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-canvas-grey bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-gakit-maroon hover:text-gakit-maroon"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>
        {filterBar}
      </header>

      {error ? (
        <div className="p-5 text-sm text-red-700">{error}</div>
      ) : count === 0 && !loading ? (
        <div className="p-2">{emptyState ?? <EmptyNotifications />}</div>
      ) : (
        <>
          <div className="divide-y divide-canvas-grey">
            {!isArchivedView && (
              <div>
                <button
                  type="button"
                  onClick={() => setUnreadCollapsed((c) => !c)}
                  aria-expanded={showUnreadGroup}
                  className={groupButtonClass}
                >
                  {showUnreadGroup ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Unread
                </button>
                {showUnreadGroup &&
                  (pagedUnread.length > 0 ? (
                    pagedUnread.map((n) => renderRow(n, false))
                  ) : (
                    <p className="px-3 py-2 text-xs text-slate-400">
                      No unread notifications.
                    </p>
                  ))}
              </div>
            )}

            {(isArchivedView || read.length > 0) && (
              <div>
                <button
                  type="button"
                  onClick={() => setReadCollapsed((c) => !c)}
                  aria-expanded={showReadGroup}
                  className={groupButtonClass}
                >
                  {showReadGroup ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {isArchivedView ? 'Archived' : `Read (${read.length})`}
                </button>
                {showReadGroup &&
                  (isArchivedView
                    ? pagedNotifications.map((n) => renderRow(n, true))
                    : pagedRead.length > 0
                      ? pagedRead.map((n) => renderRow(n, true))
                      : null)}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <ReportsPagination
              currentPage={safePage}
              totalPages={totalPages}
              totalItems={orderedNotifications.length}
              pageSize={NOTIFICATIONS_PER_PAGE}
              onPageChange={setPage}
              itemLabel="alerts"
            />
          )}
        </>
      )}
    </section>
  );
}
