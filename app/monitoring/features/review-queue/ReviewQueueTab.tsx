import { PlaceholderTab } from '@/app/admin/features/shared/PlaceholderTab';
import { monitoringFeatureMap } from '../monitoringFeatureConfig';

export function ReviewQueueTab() {
  const feature = monitoringFeatureMap['review-queue'];
  return (
    <PlaceholderTab
      title={feature.title}
      icon={feature.icon}
      description={feature.description}
      contents={feature.contents}
    />
  );
}
