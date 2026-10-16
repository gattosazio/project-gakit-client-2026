import { describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
  validatePasswordChange,
} from '@/lib/auth/passwordPolicy';

describe('validateNewPassword', () => {
  it('accepts a long-enough, matching pair', () => {
    expect(validateNewPassword('s3cret-pass', 's3cret-pass')).toEqual({ ok: true });
  });

  it('rejects a password shorter than the minimum', () => {
    const result = validateNewPassword('short', 'short');
    expect(result).toMatchObject({ ok: false, code: 'too-short' });
  });

  it('enforces the minimum at the boundary', () => {
    const exact = 'a'.repeat(MIN_PASSWORD_LENGTH);
    expect(validateNewPassword(exact, exact).ok).toBe(true);
    expect(validateNewPassword(exact.slice(1), exact.slice(1))).toMatchObject({
      code: 'too-short',
    });
  });

  it('rejects a mismatched confirmation', () => {
    expect(validateNewPassword('s3cret-pass', 's3cret-pass2')).toMatchObject({
      ok: false,
      code: 'mismatch',
    });
  });

  it('reports shortness before a mismatch', () => {
    expect(validateNewPassword('abc', 'xyz')).toMatchObject({ code: 'too-short' });
  });
});

describe('validatePasswordChange', () => {
  it('accepts a valid change', () => {
    expect(
      validatePasswordChange({
        current: 'old-password',
        next: 'new-password',
        confirm: 'new-password',
      })
    ).toEqual({ ok: true });
  });

  it('requires the current password', () => {
    expect(
      validatePasswordChange({ current: '', next: 'new-password', confirm: 'new-password' })
    ).toMatchObject({ ok: false, code: 'missing-current' });
  });

  it('rejects reusing the current password', () => {
    expect(
      validatePasswordChange({
        current: 'same-password',
        next: 'same-password',
        confirm: 'same-password',
      })
    ).toMatchObject({ ok: false, code: 'unchanged' });
  });

  it('still applies the length and match rules', () => {
    expect(
      validatePasswordChange({ current: 'old-password', next: 'short', confirm: 'short' })
    ).toMatchObject({ code: 'too-short' });
    expect(
      validatePasswordChange({
        current: 'old-password',
        next: 'new-password',
        confirm: 'new-password2',
      })
    ).toMatchObject({ code: 'mismatch' });
  });
});
