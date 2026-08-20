const configuredApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000';

const apiOrigin = configuredApiBaseUrl.replace(/\/$/, '');

export const API_BASE_URL = apiOrigin.endsWith('/api/v1')
  ? apiOrigin
  : `${apiOrigin}/api/v1`;
