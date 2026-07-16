import { adminFeatureMap } from '../adminFeatureConfig';
import { PlaceholderTab } from '../shared/PlaceholderTab';

export function AuditLogsTab() {
  const feature = adminFeatureMap['audit-logs'];
  return (
    <PlaceholderTab
      title={feature.title}
      icon={feature.icon}
      description={feature.description}
      contents={feature.contents}
    />
  );
}
