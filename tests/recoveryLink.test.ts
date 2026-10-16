import { describe, expect, it } from 'vitest';
import {
  parseHashParams,
  resolveRecoveryLink,
  stripCredentialParams,
} from '@/lib/auth/recoveryLink';

describe('resolveRecoveryLink', () => {
  it('returns an exchange-code result for a PKCE recovery link', () => {
    expect(resolveRecoveryLink('?code=abc-123', '')).toEqual({
      kind: 'exchange-code',
      code: 'abc-123',
    });
  });

  it('returns an implicit-session result for a legacy hash recovery link', () => {
    expect(
      resolveRecoveryLink('', '#access_token=tok&refresh_token=ref&type=recovery')
    ).toEqual({ kind: 'implicit-session' });
  });

  it('reports an expired link from the hash error code', () => {
    expect(
      resolveRecoveryLink('', '#error=access_denied&error_code=otp_expired')
    ).toEqual({ kind: 'expired' });
  });

  it('reports invalid for a hash error with no expiry code', () => {
    expect(resolveRecoveryLink('', '#error=access_denied&error_code=otp_disabled')).toEqual({
      kind: 'invalid',
    });
  });

  it('reports invalid when the URL carries no link at all', () => {
    expect(resolveRecoveryLink('', '')).toEqual({ kind: 'invalid' });
  });

  it('prefers the hash error over a code when both are present', () => {
    expect(resolveRecoveryLink('?code=abc-123', '#error_code=otp_expired')).toEqual({
      kind: 'expired',
    });
  });

  it('ignores a recovery hash token when no code is present', () => {
    expect(resolveRecoveryLink('?notification=42', '#type=recovery')).toEqual({
      kind: 'implicit-session',
    });
  });

  it('tolerates a hash without the leading marker', () => {
    expect(resolveRecoveryLink('', 'type=recovery')).toEqual({ kind: 'implicit-session' });
  });
});

describe('parseHashParams', () => {
  it('parses a bare hash and an empty hash alike', () => {
    expect(parseHashParams('#type=recovery&code=x').get('type')).toBe('recovery');
    expect(parseHashParams('').get('type')).toBeNull();
  });
});

describe('stripCredentialParams', () => {
  it('removes recovery credentials from the query and the hash', () => {
    expect(stripCredentialParams('https://app.example/auth/reset?code=abc#type=recovery')).toBe(
      '/auth/reset'
    );
  });

  it('keeps unrelated query params', () => {
    expect(stripCredentialParams('https://app.example/auth/reset?code=abc&notification=42')).toBe(
      '/auth/reset?notification=42'
    );
  });

  it('strips error copies so a refresh does not replay the failure', () => {
    expect(
      stripCredentialParams(
        'https://app.example/auth/reset#error=access_denied&error_code=otp_expired&error_description=Nope'
      )
    ).toBe('/auth/reset');
  });
});
