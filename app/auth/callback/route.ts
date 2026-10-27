import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Server-side PKCE exchange for OAuth sign-ins (e.g. Google). Supabase Auth
 * redirects here with an authorization `?code=` after the provider consent
 * step. Landing on the login page afterwards is intentional either way: the
 * proxy forwards signed-in users to their role's portal and leaves
 * unauthenticated (or role-less) users on the login form.
 *
 * When the provider or GoTrue rejects the attempt (uninvited account, denied
 * consent, disabled signups), Supabase redirects here with `?error=...`; we
 * surface that as a failed login rather than silently dropping it.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const loginUrl = new URL('/login', origin);

  const oauthError = searchParams.get('error') || searchParams.get('error_description');
  if (oauthError) {
    loginUrl.searchParams.set('google_failed', '1');
    return NextResponse.redirect(loginUrl);
  }

  const code = searchParams.get('code');
  if (!code) {
    loginUrl.searchParams.set('google_failed', '1');
    return NextResponse.redirect(loginUrl);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Route handlers CAN mutate cookies (unlike RSC); writes are applied
        // to the redirect response below. The try/catch keeps this adapter
        // safe if Next ever invokes it from an RSC context.
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore.
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    loginUrl.searchParams.set('google_failed', '1');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(loginUrl);
}
