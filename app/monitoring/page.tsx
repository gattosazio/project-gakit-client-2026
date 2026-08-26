import { Suspense } from 'react';
import { MonitoringShell } from './MonitoringShell';
import { getServerAuthSnapshot } from '@/lib/supabase/server';

export default async function Page() {
  const auth = await getServerAuthSnapshot();
  return (
    <Suspense fallback={null}>
      <MonitoringShell initialAuth={auth} />
    </Suspense>
  );
}
