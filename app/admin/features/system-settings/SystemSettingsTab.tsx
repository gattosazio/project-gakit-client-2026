import { adminFeatureMap } from '../adminFeatureConfig';
import { PlaceholderTab } from '../shared/PlaceholderTab';

export function SystemSettingsTab() {
  const feature = adminFeatureMap['system-settings'];
  return (
    <PlaceholderTab
      title={feature.title}
      icon={feature.icon}
      description={feature.description}
      contents={feature.contents}
    />
  );
}
