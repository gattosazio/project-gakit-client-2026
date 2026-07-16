import { adminFeatureMap } from '../adminFeatureConfig';
import { PlaceholderTab } from '../shared/PlaceholderTab';

export function PlatformOverviewTab() {
  const feature = adminFeatureMap.dashboard;
  return (
    <PlaceholderTab
      title={feature.title}
      icon={feature.icon}
      description={feature.description}
      contents={feature.contents}
    />
  );
}
