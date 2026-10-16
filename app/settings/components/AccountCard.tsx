'use client';

import { ShieldCheck } from 'lucide-react';
import { homePathForRole, type StaffRole } from '@/lib/auth/roles';

const ROLE_LABEL: Record<StaffRole, string> = {
  admin: 'Administrator',
  staff: 'Staff',
};

const PORTAL_LABEL: Record<string, string> = {
  '/admin': 'Administration',
  '/monitoring': 'Monitoring',
};

function initials(name: string, email: string | null): string {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-700">{value}</dd>
    </div>
  );
}


export function AccountCard({
  name,
  email,
  role,
  memberSince,
  lastSignIn,
}: {
  name: string;
  email: string | null;
  role: StaffRole | null;
  memberSince: string | null;
  lastSignIn: string | null;
}) {
  const home = homePathForRole(role);

  return (
    <section className="rounded-2xl border border-canvas-grey bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-maroon-50 text-lg font-bold text-gakit-maroon">
          {initials(name, email)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-slate-900">
            {name || 'Unnamed user'}
          </p>
          <p className="truncate text-sm text-slate-500">
            {email ?? 'No email on file'}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-canvas-grey pt-5 sm:grid-cols-2">
        <Field label="Role" value={role ? ROLE_LABEL[role] : '—'} />
        <Field label="Home portal" value={home ? PORTAL_LABEL[home] ?? home : '—'} />
        <Field label="Member since" value={formatDate(memberSince)} />
        <Field label="Last sign-in" value={formatDateTime(lastSignIn)} />
      </dl>

      <p className="mt-5 flex items-start gap-2 border-t border-canvas-grey pt-4 text-xs text-slate-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        Your email address and role are managed by a GAKIT administrator. Ask
        them if either needs to change.
      </p>
    </section>
  );
}
