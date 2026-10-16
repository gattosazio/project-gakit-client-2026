import { createClient } from '@/lib/supabase/client';

export interface NotificationReceipts {
  readIds: string[];
  dismissedIds: string[];
}

/**
 * Fetch this user's read/dismissed notification IDs from Supabase.
 * Returns null when the user isn't signed in or the query fails.
 */
export async function fetchNotificationReceipts(): Promise<NotificationReceipts | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: rows, error } = await supabase
    .from('notification_read_receipts')
    .select('notification_id, read_at, dismissed_at')
    .eq('user_id', data.user.id);

  if (error) {
    console.error('[notifications] failed to load receipts:', error.message);
    return null;
  }

  return {
    readIds: (rows ?? [])
      .filter((row) => row.read_at !== null)
      .map((row) => row.notification_id as string),
    dismissedIds: (rows ?? [])
      .filter((row) => row.dismissed_at !== null)
      .map((row) => row.notification_id as string),
  };
}

const RECEIPTS_EVENT = 'gakit-notification-receipts';

/** Kinds of receipt mutation broadcast to other mounted surfaces. */
export type ReceiptChangeKind = 'read' | 'dismissed' | 'restored';

/**
 * Broadcast receipt changes so every mounted surface (header bell, alerts
 * inbox) stays in sync without refetching.
 */
function emitReceipts(
  kind: ReceiptChangeKind,
  notificationIds: string[]
): void {
  if (notificationIds.length === 0 || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RECEIPTS_EVENT, { detail: { kind, ids: notificationIds } })
  );
}

/** Listen for receipt changes made on other surfaces. Returns unsubscribe. */
export function subscribeToReceiptChanges(
  handler: (kind: ReceiptChangeKind, notificationIds: string[]) => void
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent).detail as {
      kind: ReceiptChangeKind;
      ids: string[];
    };
    handler(detail.kind, detail.ids);
  };
  window.addEventListener(RECEIPTS_EVENT, listener);
  return () => window.removeEventListener(RECEIPTS_EVENT, listener);
}

/**
 * Upsert receipts for the given notification IDs.
 *
 * Values are always concrete timestamps — never `null`. `read_at` is
 * `NOT NULL DEFAULT now()` (migration `20260822000000`), so sending an
 * explicit NULL bypasses the default and is rejected by the constraint.
 * Use `clearReceipts` to reset a receipt instead.
 */
async function upsertReceipts(
  notificationIds: string[],
  values: { read_at?: string; dismissed_at?: string }
): Promise<void> {
  if (notificationIds.length === 0) return;
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  const { error } = await supabase.from('notification_read_receipts').upsert(
    notificationIds.map((id) => ({
      user_id: data.user!.id,
      notification_id: id,
      ...values,
    })),
    { onConflict: 'user_id,notification_id' }
  );

  if (error) {
    console.error('[notifications] failed to save receipts:', error.message);
  }
}

/**
 * Delete the receipt rows for the given IDs, resetting them to "never read,
 * never dismissed".
 *
 * Restore deletes rather than writing `NULL` into the columns: `read_at` is
 * `NOT NULL DEFAULT now()`, so an explicit NULL raises the exact constraint
 * violation we hit in production. Deleting is also the only way to cover both
 * archive paths at once — a manually dismissed row and a read-past-7-days row
 * both fully reset, and the item returns as unread.
 *
 * The RLS policy is `FOR ALL TO authenticated`, so DELETE is permitted.
 */
async function clearReceipts(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  const { error } = await supabase
    .from('notification_read_receipts')
    .delete()
    .eq('user_id', data.user.id)
    .in('notification_id', notificationIds);

  if (error) {
    console.error('[notifications] failed to clear receipts:', error.message);
  }
}

export async function markNotificationsRead(notificationIds: string[]): Promise<void> {
  await upsertReceipts(notificationIds, { read_at: new Date().toISOString() });
  emitReceipts('read', notificationIds);
}

export async function dismissNotifications(notificationIds: string[]): Promise<void> {
  await upsertReceipts(notificationIds, { dismissed_at: new Date().toISOString() });
  emitReceipts('dismissed', notificationIds);
}

/**
 * Move notifications back to the Active view (approach A: no schema change).
 *
 * Clears both receipts — dismissed and read — because an item can be archived
 * two ways: manually dismissed, or read past ARCHIVE_AFTER_DAYS. Clearing only
 * one could leave it archived. See `clearReceipts` for why this deletes.
 */
export async function restoreNotifications(notificationIds: string[]): Promise<void> {
  await clearReceipts(notificationIds);
  emitReceipts('restored', notificationIds);
}
