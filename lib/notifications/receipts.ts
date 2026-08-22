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

/**
 * Broadcast receipt changes so every mounted surface (header bell, alerts
 * inbox) stays in sync without refetching.
 */
function emitReceipts(
  kind: 'read' | 'dismissed',
  notificationIds: string[]
): void {
  if (notificationIds.length === 0 || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RECEIPTS_EVENT, { detail: { kind, ids: notificationIds } })
  );
}

/** Listen for receipt changes made on other surfaces. Returns unsubscribe. */
export function subscribeToReceiptChanges(
  handler: (kind: 'read' | 'dismissed', notificationIds: string[]) => void
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent).detail as {
      kind: 'read' | 'dismissed';
      ids: string[];
    };
    handler(detail.kind, detail.ids);
  };
  window.addEventListener(RECEIPTS_EVENT, listener);
  return () => window.removeEventListener(RECEIPTS_EVENT, listener);
}

/** Upsert receipts for the given notification IDs. */
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

export async function markNotificationsRead(notificationIds: string[]): Promise<void> {
  await upsertReceipts(notificationIds, { read_at: new Date().toISOString() });
  emitReceipts('read', notificationIds);
}

export async function dismissNotifications(notificationIds: string[]): Promise<void> {
  await upsertReceipts(notificationIds, { dismissed_at: new Date().toISOString() });
  emitReceipts('dismissed', notificationIds);
}
