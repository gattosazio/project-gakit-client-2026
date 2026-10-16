import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dismissNotifications,
  markNotificationsRead,
  restoreNotifications,
} from '@/lib/notifications/receipts';

interface MockResult {
  error: { message: string } | null;
}

/**
 * Minimal stand-in for the Supabase query builder. Only the chains this module
 * actually uses are modelled: `from().upsert()` and `from().delete().eq().in()`.
 * `delete().eq().in()` resolves through `then` so awaiting it works.
 */
interface MockBuilder {
  upsert: (payload: Record<string, unknown>[], opts?: unknown) => Promise<MockResult>;
  delete: () => MockBuilder;
  select: (columns?: string) => MockBuilder;
  eq: (column: string, value: unknown) => MockBuilder;
  in: (column: string, values: unknown[]) => MockBuilder;
  then: (
    onFulfilled?: ((value: MockResult) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null
  ) => Promise<unknown>;
}

const supa = vi.hoisted(() => {
  interface Call {
    table: string;
    op: 'upsert' | 'delete' | null;
    payload: Record<string, unknown>[] | null;
    eq: [string, unknown][];
    in: [string, unknown[]][];
  }

  const state = {
    calls: [] as Call[],
    failMessage: null as string | null,
  };

  function client() {
    const result = (): { error: { message: string } | null } => ({
      error: state.failMessage ? { message: state.failMessage } : null,
    });

    const from = (table: string) => {
      const call: Call = { table, op: null, payload: null, eq: [], in: [] };
      state.calls.push(call);

      // Built once so `delete().eq()` and `delete().in()` return the same
      // object; awaiting it resolves via `then` at call time, which is what
      // lets `failMessage` be injected after the chain is built.
      const builder: MockBuilder = {
        upsert: (payload) => {
          call.op = 'upsert';
          call.payload = payload;
          return Promise.resolve(result());
        },
        delete: () => {
          call.op = 'delete';
          return builder;
        },
        select: () => builder,
        eq: (column, value) => {
          call.eq.push([column, value]);
          return builder;
        },
        in: (column, values) => {
          call.in.push([column, values]);
          return builder;
        },
        then: (onFulfilled, onRejected) =>
          Promise.resolve(result()).then(
            onFulfilled as ((value: { error: { message: string } | null }) => unknown) | null,
            onRejected
          ),
      };

      return builder;
    };

    return {
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
      from,
    };
  }

  return {
    get calls() {
      return state.calls;
    },
    client,
    failWith(message: string | null) {
      state.failMessage = message;
    },
    reset() {
      state.calls = [];
      state.failMessage = null;
    },
  };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => supa.client(),
}));

beforeEach(() => {
  supa.reset();
});

describe('restoreNotifications', () => {
  it('deletes the receipt rows rather than writing into the columns', async () => {
    await restoreNotifications(['weather-w1', 'flagged-r1']);

    expect(supa.calls).toHaveLength(1);
    const call = supa.calls[0];
    expect(call.table).toBe('notification_read_receipts');
    expect(call.op).toBe('delete');
    expect(call.eq).toContainEqual(['user_id', 'user-1']);
    expect(call.in).toContainEqual(['notification_id', ['weather-w1', 'flagged-r1']]);
  });

  // Regression: this used to upsert `{ read_at: null, dismissed_at: null }` and
  // Postgres rejected it — `read_at` is `NOT NULL DEFAULT now()` — which left
  // archived items impossible to restore.
  it('never upserts a NULL read_at', async () => {
    await restoreNotifications(['a']);
    await dismissNotifications(['b']);
    await markNotificationsRead(['c']);

    // Only rows that actually carry the key — dismiss intentionally omits it.
    const readAtWrites = supa.calls
      .filter((call) => call.op === 'upsert')
      .flatMap((call) => (call.payload ?? []).filter((row) => 'read_at' in row));

    expect(readAtWrites.length).toBeGreaterThan(0);
    for (const row of readAtWrites) {
      // `typeof null` is 'object', so this catches the regression directly.
      expect(typeof row.read_at).toBe('string');
    }
  });

  it('restores both archive paths at once by removing the whole row', async () => {
    // Archived either manually (dismissed) or automatically (read past 7 days);
    // a single delete resets read and dismissed together.
    await restoreNotifications(['auto-archived', 'manually-dismissed']);

    const call = supa.calls[0];
    expect(call.op).toBe('delete');
    expect(call.payload).toBeNull();
  });

  it('makes no request at all for an empty id list', async () => {
    await restoreNotifications([]);
    expect(supa.calls).toHaveLength(0);
  });

  it('logs and swallows a rejected delete instead of throwing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    supa.failWith('permission denied for table notification_read_receipts');

    await expect(restoreNotifications(['a'])).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(
      '[notifications] failed to clear receipts:',
      'permission denied for table notification_read_receipts'
    );

    spy.mockRestore();
  });
});

describe('markNotificationsRead', () => {
  it('writes a concrete ISO timestamp', async () => {
    await markNotificationsRead(['a']);

    const call = supa.calls[0];
    expect(call.op).toBe('upsert');
    expect(call.payload?.[0].read_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('dismissNotifications', () => {
  it('leaves read_at out of the write entirely', async () => {
    await dismissNotifications(['a']);

    const call = supa.calls[0];
    expect(call.op).toBe('upsert');
    expect(call.payload?.[0]).not.toHaveProperty('read_at');
    expect(call.payload?.[0].dismissed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
