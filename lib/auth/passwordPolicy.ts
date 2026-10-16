/**
 * Password rules for the self-service account area.
 *
 * Kept pure (no React, no Supabase) so the rules live in one place and are
 * covered by unit tests instead of manual clicking. Callers surface the
 * returned `message` inline; `code` is available when a caller needs to react
 * to a specific failure (e.g. highlight a particular field).
 */

export const MIN_PASSWORD_LENGTH = 8;

export type PasswordPolicyCode =
  | 'missing-current'
  | 'too-short'
  | 'mismatch'
  | 'unchanged';

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; code: PasswordPolicyCode; message: string };

/**
 * Validate a new password and its confirmation. Shared by any flow that sets a
 * password without re-entering an existing one (invite, recovery).
 */
export function validateNewPassword(
  next: string,
  confirm: string
): PasswordPolicyResult {
  if (next.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      code: 'too-short',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (next !== confirm) {
    return { ok: false, code: 'mismatch', message: "Passwords don't match." };
  }
  return { ok: true };
}

/**
 * Validate a password change from inside the account area, where the current
 * password is re-entered to prove ownership before the update.
 */
export function validatePasswordChange({
  current,
  next,
  confirm,
}: {
  current: string;
  next: string;
  confirm: string;
}): PasswordPolicyResult {
  if (current === '') {
    return {
      ok: false,
      code: 'missing-current',
      message: 'Enter your current password.',
    };
  }

  const pair = validateNewPassword(next, confirm);
  if (!pair.ok) return pair;

  if (next === current) {
    return {
      ok: false,
      code: 'unchanged',
      message: 'Choose a password different from your current one.',
    };
  }

  return { ok: true };
}
