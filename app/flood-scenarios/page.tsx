import { FloodScenariosShell } from './FloodScenariosShell';
import { getServerAuthSnapshot } from '@/lib/supabase/server';

export default async function Page() {
  const auth = await getServerAuthSnapshot();
  return <FloodScenariosShell initialAuth={auth} />;
}
