import { redirect } from 'next/navigation';
import { getServerAuthSnapshot } from '@/lib/supabase/server';
import { DemoWorkspace } from './DemoWorkspace';

export const metadata = { title: 'Demo Workspace | GAKIT', robots: { index: false, follow: false } };

export default async function DemoPage() {
  const auth = await getServerAuthSnapshot();
  if (auth.role !== 'admin') redirect('/monitoring');
  return <DemoWorkspace />;
}
