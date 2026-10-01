import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccessPath, getStaffRole, homePathForRole } from '@/lib/auth/roles';

const PROTECTED_PREFIXES = ['/admin', '/monitoring', '/settings'];

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value }) => supabaseResponse.cookies.set(name, value));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user) {
    if (isProtected) return redirectTo(request, '/login');
    return supabaseResponse;
  }

  // Only look up the staff role when it can affect the response: protected
  // routes and /login (authenticated users get redirected to their home).
  // This avoids a DB query on every public request.
  const needsRole = isProtected || pathname.startsWith('/login');
  const role = needsRole ? await getStaffRole(supabase, user.id) : null;
  const home = homePathForRole(role);

  if (isProtected && !canAccessPath(pathname, role)) {
    return redirectTo(request, home ?? '/login');
  }

  if (pathname.startsWith('/login') && home) {
    return redirectTo(request, home);
  }

  return supabaseResponse;
}

export default proxy;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|vendor/|data/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pmtiles|mjs|css|map)$).*)',
  ],
};
