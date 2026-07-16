import { PlaceholderTab } from '@/app/admin/features/shared/PlaceholderTab';
import { monitoringFeatureMap } from '../monitoringFeatureConfig';

export function HazardMapTab() {
  const feature = monitoringFeatureMap['hazard-map'];
  return (
    <PlaceholderTab
      title={feature.title}
      icon={feature.icon}
      description={feature.description}
      contents={feature.contents}
    />
  );
}
