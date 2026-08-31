import { CheckCircle2 } from 'lucide-react';

export function EmptyNotifications() {
  return (
    <div className="p-10 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-hazard-safe" />
      <p className="mt-3 text-sm font-semibold text-slate-700">
        No matching notifications
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Try another filter or refresh the latest activity.
      </p>
    </div>
  );
}
