import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getStaffRole, type AuthSnapshot } from '@/lib/auth/roles';

/**
 * Resolves the caller's auth state for server components. Anonymous visitors
 * cost zero network round trips (cookie-only session probe); authenticated
 * users get a verified user plus staff role so portals and the public header
 * can render account UI in the first HTML paint.
 */
export async function getServerAuthSnapshot(): Promise<AuthSnapshot> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // RSC cannot mutate cookies; middleware owns token refresh.
        setAll: () => {},
      },
    }
  );

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return { email: null, role: null };

  const { data } = await supabase.auth.getUser();
  if (!data.user) return { email: null, role: null };

  const role = await getStaffRole(supabase, data.user.id);
  return { email: data.user.email ?? null, role };
}
