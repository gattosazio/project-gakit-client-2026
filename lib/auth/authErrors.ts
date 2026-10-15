/**
 * Maps raw Supabase auth errors to short, user-facing copy. Supabase surfaces
 * terse or technical messages ("Invalid login credentials", "User is banned"),
 * which are not helpful to GAKIT officials; this keeps the wording consistent
 * and friendly while never hiding the failure.
 */

const SUSPENDED_HINTS = ['banned', 'disabled', 'suspended', 'deactivated'];

/** Normalize the many shapes an auth error can take into a plain message. */
function messageOf(error: { message?: string } | string | null | undefined): string {
  if (typeof error === 'string') return error;
  return error?.message ?? '';
}

/** Friendly copy for a failed sign-in or OAuth attempt. */
export function friendlyAuthError(
  error: { message?: string } | string | null | undefined
): string {
  const message = messageOf(error).trim();
  const lower = message.toLowerCase();

  if (SUSPENDED_HINTS.some((hint) => lower.includes(hint))) {
    return 'This account has been deactivated. Contact the GAKIT administrator to restore access.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Your email has not been confirmed yet. Check your inbox for the confirmation link.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  return message || 'Something went wrong. Please try again.';
}

/**
 * Friendly copy for a failed invite redemption. Distinguishes an expired token
 * from one that was already used (or is otherwise invalid) so the invitee knows
 * whether to wait or to ask for a fresh link.
 */
export function friendlyInviteError(
  error: { message?: string } | string | null | undefined
): string {
  const lower = messageOf(error).toLowerCase();

  if (lower.includes('expire')) {
    return 'This invite link has expired. Ask the GAKIT administrator to send a new one.';
  }
  return 'This invite link is invalid or was already used. Ask the GAKIT administrator to send a new one.';
}
