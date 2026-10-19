import { z } from 'zod';
import { SCENARIO_PRESETS } from '@/types/scenario';
import { apiRequest } from '@/lib/backend/http';

const reportSchema = z.object({
  id: z.string().uuid(), reporter: z.number().int().min(1).max(12),
  latitude: z.number().min(8.09).max(8.36), longitude: z.number().min(124.14).max(124.51),
  depthCm: z.number().int().min(1).max(999).nullable(),
  observedAt: z.string().datetime({ offset: true }), submittedAt: z.string().datetime({ offset: true }).nullable().optional(),
  gpsAccuracyM: z.number().nonnegative(), locationSource: z.enum(['gps', 'manual']).optional(),
  blocked: z.boolean(), depthMethod: z.enum(['estimated', 'measured', 'category']).optional(),
  depthUncertaintyCm: z.number().nonnegative().nullable().optional(),
});

export const behaviorSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(80), savedAt: z.string().datetime({ offset: true }),
  preset: z.string().refine(id => SCENARIO_PRESETS.some(preset => preset.id === id && preset.dataFile)),
  minutes: z.number().int().nonnegative(), inspectionMinutes: z.number().int().nonnegative().nullable(),
  approveFixtures: z.boolean(), reports: z.array(reportSchema).min(1).max(50),
  location: z.object({ latitude: z.number().min(8.09).max(8.36), longitude: z.number().min(124.14).max(124.51) }),
}).refine(value => value.inspectionMinutes === null || value.inspectionMinutes <= value.minutes);

export type DemoBehavior = z.infer<typeof behaviorSchema>;
export type DemoBehaviorSnapshot = Omit<DemoBehavior, 'id' | 'name' | 'savedAt'>;
export const BEHAVIORS_KEY = 'gakit.demo.behaviors';
export const BEHAVIORS_EVENT = 'gakit-demo-behaviors';

export async function fetchDemoBehaviors(signal?: AbortSignal): Promise<DemoBehavior[]> {
  return z.array(behaviorSchema).parse(await apiRequest<unknown>('/api/v1/admin/demo/behaviors', { signal }));
}

export async function saveDemoBehavior(id: string, name: string, snapshot: DemoBehaviorSnapshot): Promise<DemoBehavior> {
  return behaviorSchema.parse(await apiRequest<unknown>(`/api/v1/admin/demo/behaviors/${id}`, {
    method: 'PUT', body: JSON.stringify({ name, ...snapshot }),
  }));
}

export async function deleteDemoBehavior(id: string): Promise<void> {
  await apiRequest(`/api/v1/admin/demo/behaviors/${id}`, { method: 'DELETE' });
}

export function readDemoBehaviors(raw: string | null): DemoBehavior[] {
  if (!raw) return [];
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    return values.flatMap(value => {
      const result = behaviorSchema.safeParse(value);
      return result.success ? [result.data] : [];
    });
  } catch { return []; }
}
