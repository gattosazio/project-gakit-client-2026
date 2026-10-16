/**
 * Parsing for Supabase auth links that land on `/auth/reset`.
 *
 * The browser client uses the PKCE flow, so the recovery email redirects with
 * `?code=...` (exchanged for a session), while older/implicit links carry the
 * result in the URL hash (`#type=recovery`) or an error (`#error_code=...`).
 * This module keeps that decision pure and testable, away from the page's
 * effects, so the failure modes are covered by unit tests instead of manual
 * clicking.
 */

export type RecoveryLinkResolution =
  | { kind: 'exchange-code'; code: string }
  | { kind: 'implicit-session' }
  | { kind: 'expired' }
  | { kind: 'invalid' };

/** Query/hash params that only exist to carry link credentials or error state. */
const CREDENTIAL_PARAMS = [
  'code',
  'token_hash',
  'type',
  'error',
  'error_code',
  'error_description',
  'error_uri',
] as const;

/** Hash params as a `URLSearchParams`, tolerating a missing or bare `#`. */
export function parseHashParams(hash: string): URLSearchParams {
  return new URLSearchParams((hash || '').replace(/^#/, ''));
}

/**
 * Decide what a `/auth/reset` visit represents.
 *
 * `search` and `hash` are passed as raw strings (e.g. `window.location.search`
 * / `window.location.hash`) so callers stay free of `window` and tests stay
 * trivial.
 */
export function resolveRecoveryLink(search: string, hash: string): RecoveryLinkResolution {
  const linkParams = parseHashParams(hash);

  // Supabase reports link failures in the hash, before any code exchange.
  if (linkParams.get('error_code') === 'otp_expired' || linkParams.get('error')) {
    return linkParams.get('error_code') === 'otp_expired'
      ? { kind: 'expired' }
      : { kind: 'invalid' };
  }

  const code = new URLSearchParams(search || '').get('code');
  if (code) return { kind: 'exchange-code', code };

  // Legacy implicit link: tokens are in the hash and the client has already
  // (or is about to) pick them up, so a session check is the only step left.
  if (linkParams.get('type') === 'recovery') return { kind: 'implicit-session' };

  return { kind: 'invalid' };
}

/**
 * Drop link credentials from the current URL so a refresh cannot re-submit a
 * spent code or re-render a stale error. Returns a path-relative URL suitable
 * for `history.replaceState`.
 */
export function stripCredentialParams(href: string): string {
  const url = new URL(href);
  for (const key of CREDENTIAL_PARAMS) url.searchParams.delete(key);
  url.hash = '';
  return `${url.pathname}${url.search}`;
}
