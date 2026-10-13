'use client';

const REPORTER_TOKEN_KEY = 'gakit_reporter_device_token';

/**
 * Returns a persistent anonymous UUID for the current device/browser.
 * Generates and saves one to localStorage if it doesn't already exist.
 */
export function getOrCreateReporterToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    let token = localStorage.getItem(REPORTER_TOKEN_KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(REPORTER_TOKEN_KEY, token);
    }
    return token;
  } catch {
    // In incognito or storage-disabled environments, fall back to ephemeral UUID
    return crypto.randomUUID();
  }
}

/**
 * Header map including X-Reporter-ID for report submission.
 */
export function reporterHeaders(): Record<string, string> {
  const token = getOrCreateReporterToken();
  return token ? { 'X-Reporter-ID': token } : {};
}
