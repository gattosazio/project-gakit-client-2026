import { adminFeatureMap } from '../adminFeatureConfig';
import { PlaceholderTab } from '../shared/PlaceholderTab';

export function AccessRequestsTab() {
  const feature = adminFeatureMap['access-requests'];
  return (
    <PlaceholderTab
      title={feature.title}
      icon={feature.icon}
      description={feature.description}
      contents={feature.contents}
    />
  );
}
