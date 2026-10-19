'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getDisplayName, type AuthSnapshot } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/client';
import { AccountCard } from './components/AccountCard';
import { SettingsSection } from './components/SettingsSection';
import { ProfileSection } from './components/ProfileSection';
import { PasswordSection } from './components/PasswordSection';
import { SessionsSection } from './components/SessionsSection';
import { DisplayPreferencesSection } from './components/DisplayPreferencesSection';
import { SettingsLayout } from './components/SettingsLayout';
import type { SectionId } from './components/SettingsNav';
import { DeveloperToolsSection } from './components/DeveloperToolsSection';

export function SettingsPage({ initialAuth }: { initialAuth?: AuthSnapshot }) {
  const role = initialAuth?.role ?? null;
  const email = initialAuth?.email ?? null;

  const [name, setName] = useState(initialAuth?.name ?? '');
  const [user, setUser] = useState<User | null>(null);
  const [active, setActive] = useState<SectionId>('account');

  // Sync active section with hash
  useEffect(() => {
    const readHash = () => {
      const raw = window.location.hash.replace('#', '');
      if (raw === 'account' || raw === 'security' || raw === 'appearance') {
        setActive(raw);
      } else if (raw === 'developer' && role === 'admin') {
        setActive('developer');
      } else if (!raw) {
        setActive('account');
      }
    };

    readHash();
    window.addEventListener('hashchange', readHash);
    return () => {
      window.removeEventListener('hashchange', readHash);
    };
  }, [role]);

  // Fetch full user for timestamps
  useEffect(() => {
    let cancelled = false;
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelled || !data.user) return;
        setUser(data.user);
        setName(
          (prev) =>
            prev ||
            getDisplayName(data.user.user_metadata, data.user.email ?? null) ||
            ''
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsLayout role={role} active={active}>
      {active === 'developer' && role === 'admin' && <SettingsSection title="Developer tools" description="Control global report demo approval and isolated storm demonstrations."><DeveloperToolsSection /></SettingsSection>}
      {active === 'account' && (
        <div className="space-y-6">
          <AccountCard
            name={name}
            email={email}
            role={role}
            memberSince={user?.created_at ?? null}
            lastSignIn={user?.last_sign_in_at ?? null}
          />
          <SettingsSection
            title="Profile"
            description="How your name appears across the portal."
          >
            <ProfileSection initialName={name} onSaved={setName} />
          </SettingsSection>
        </div>
      )}

      {active === 'security' && (
        <div className="space-y-6">
          <SettingsSection
            title="Password"
            description="Choose a new password. You will be asked for your current one first."
          >
            <PasswordSection email={email} />
          </SettingsSection>
          <SettingsSection
            title="Sessions"
            description="Control where your account is signed in."
          >
            <SessionsSection />
          </SettingsSection>
        </div>
      )}

      {active === 'appearance' && (
        <SettingsSection
          title="Map display"
          description="Preferences for how flood scenarios are shown on the map. Saved to this browser."
        >
          <DisplayPreferencesSection />
        </SettingsSection>
      )}
    </SettingsLayout>
  );
}
