import { MonitoringShell } from './MonitoringShell';
import { getServerAuthSnapshot } from '@/lib/supabase/server';

export default async function Page() {
  const auth = await getServerAuthSnapshot();
  return <MonitoringShell initialAuth={auth} />;
}
