import { SettingsPage } from './SettingsPage';
import { getServerAuthSnapshot } from '@/lib/supabase/server';

export default async function Page() {
  const auth = await getServerAuthSnapshot();
  return <SettingsPage initialAuth={auth} />;
}