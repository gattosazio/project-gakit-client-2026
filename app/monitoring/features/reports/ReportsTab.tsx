import { PlaceholderTab } from '@/app/admin/features/shared/PlaceholderTab';
import { monitoringFeatureMap } from '../monitoringFeatureConfig';

export function ReportsTab() {
  const feature = monitoringFeatureMap.reports;
  return (
    <PlaceholderTab
      title={feature.title}
      icon={feature.icon}
      description={feature.description}
      contents={feature.contents}
    />
  );
}
