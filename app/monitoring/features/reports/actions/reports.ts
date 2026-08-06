import type {
  FloodDepth,
  ReportRecord,
  ReportStatus,
} from '@/app/public-view/actions/public.view';

export interface ReportListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: ReportStatus;
  depth?: FloodDepth;
}

export interface PaginatedReports {
  items: ReportRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function getErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function listReports(
  query: ReportListQuery,
  signal?: AbortSignal
): Promise<PaginatedReports> {
  const parameters = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });

  if (query.search) parameters.set('search', query.search);
  if (query.status) parameters.set('status', query.status);
  if (query.depth) parameters.set('depth', query.depth);

  const response = await fetch(`${API_URL}/reports?${parameters}`, {
    signal,
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(await getErrorMessage(response));
  return (await response.json()) as PaginatedReports;
}
