export type FloodDepth = 'ankle' | 'knee' | 'waist' | 'head' | 'overhead';

export type ReportStatus =
  | 'UNVERIFIED'
  | 'VERIFIED'
  | 'ANOMALY'
  | 'REJECTED';

export interface FloodDepthCategory {
  code: FloodDepth;
  label: string;
  approximateCm: number;
}

export interface ReportRecord {
  id: string;
  location: {
    latitude: number;
    longitude: number;
    address: string | null;
  };
  depth: FloodDepthCategory;
  status: ReportStatus;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    depth: FloodDepthCategory;
    status: ReportStatus;
    address: string | null;
    observedAt: string;
    createdAt: string;
  };
}

interface ReportFeatureCollection {
  type: 'FeatureCollection';
  features: ReportFeature[];
}

interface CreateReportInput {
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  depth: FloodDepth;
  observedAt?: string;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const ILIGAN_MAP_QUERY = new URLSearchParams({
  west: '124.1',
  south: '8.1',
  east: '124.4',
  north: '8.4',
  limit: '500',
});

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

export async function createReport(
  input: CreateReportInput
): Promise<ReportRecord> {
  const response = await fetch(`${API_URL}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new Error(await getErrorMessage(response));
  return (await response.json()) as ReportRecord;
}

export async function listPublicReports(
  signal?: AbortSignal
): Promise<ReportFeature[]> {
  const response = await fetch(`${API_URL}/reports/map?${ILIGAN_MAP_QUERY}`, {
    signal,
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(await getErrorMessage(response));
  const collection = (await response.json()) as ReportFeatureCollection;
  return collection.features;
}

export async function listDepthCategories(
  signal?: AbortSignal
): Promise<FloodDepthCategory[]> {
  const response = await fetch(`${API_URL}/reports/depth-categories`, {
    signal,
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(await getErrorMessage(response));
  return (await response.json()) as FloodDepthCategory[];
}
