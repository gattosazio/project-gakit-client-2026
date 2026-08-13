import { Suspense } from 'react';
import { AdminShell } from './AdminShell';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AdminShell />
    </Suspense>
  );
}
