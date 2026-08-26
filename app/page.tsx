import { PublicViewPage } from './public-view/PublicViewPage';
import { getServerAuthSnapshot } from '@/lib/supabase/server';

export default async function Home() {
  const auth = await getServerAuthSnapshot();
  return <PublicViewPage initialAuth={auth} />;
}
