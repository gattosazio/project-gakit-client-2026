import { authHeaders } from '@/lib/supabase/client';
import { RateLimitedError } from '@/lib/backend/apiErrors';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function extractDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as { detail?: unknown; errors?: unknown };

  // FastAPI 422 bodies carry field-level errors alongside `detail`.
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    if (first && typeof first === 'object') {
      const err = first as { field?: string; message?: string };
      if (typeof err.field === 'string' && typeof err.message === 'string') {
        return `${err.field}: ${err.message}`;
      }
      if (typeof err.message === 'string') return err.message;
    }
  }

  const detail = payload.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === 'object' && 'msg' in first) {
      return String((first as { msg: unknown }).msg);
    }
  }
  return null;
}

/**
 * Authenticated JSON fetch against the GAKIT backend. Merges the caller's
 * Supabase access token into the Authorization header; surfaces backend
 * `detail` messages (and rate-limit errors) as typed errors.
 */
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: extraHeaders, ...rest } = options ?? {};
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
      ...(extraHeaders ?? {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = extractDetail(body);

    if (response.status === 429) {
      throw new RateLimitedError(
        "You're sending requests too quickly. Please wait a moment and try again."
      );
    }

    throw new Error(
      detail ||
        `Request to ${path} failed with status ${response.status} ${response.statusText}`
    );
  }

  return body as T;
}