import { AdminShell } from './AdminShell';
import { getServerAuthSnapshot } from '@/lib/supabase/server';

export default async function Page() {
  const auth = await getServerAuthSnapshot();
  return <AdminShell initialAuth={auth} />;
}
