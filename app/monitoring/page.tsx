import { Suspense } from 'react';
import { MonitoringShell } from './MonitoringShell';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MonitoringShell />
    </Suspense>
  );
}
