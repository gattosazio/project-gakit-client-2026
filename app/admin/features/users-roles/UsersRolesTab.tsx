import { adminFeatureMap } from '../adminFeatureConfig';
import { PlaceholderTab } from '../shared/PlaceholderTab';

export function UsersRolesTab() {
  const feature = adminFeatureMap['users-roles'];
  return (
    <PlaceholderTab
      title={feature.title}
      icon={feature.icon}
      description={feature.description}
      contents={feature.contents}
    />
  );
}
