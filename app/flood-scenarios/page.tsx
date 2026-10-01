import type { Metadata } from 'next';
import { FloodScenariosShell } from './FloodScenariosShell';
import { getServerAuthSnapshot } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Flood Scenario Simulator | Project GAKIT',
  description:
    'Interactive flood simulation and preparedness tool for Iligan City. Explore physics-informed inundation models for PAGASA rainfall warnings and historical typhoons.',
  openGraph: {
    title: 'Flood Scenario Simulator | Project GAKIT',
    description:
      'Interactive flood simulation and disaster preparedness tool for Iligan City. Educational and drill planning scenarios.',
  },
};

export default async function Page() {
  const auth = await getServerAuthSnapshot();
  return <FloodScenariosShell initialAuth={auth} />;
}
