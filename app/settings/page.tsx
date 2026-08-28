import { Suspense } from 'react';
import { SettingsPage } from './SettingsPage';
import { getServerAuthSnapshot } from '@/lib/supabase/server';

export default async function Page() {
  const auth = await getServerAuthSnapshot();
  return (
    <Suspense fallback={null}>
      <SettingsPage initialAuth={auth} />
    </Suspense>
  );
}