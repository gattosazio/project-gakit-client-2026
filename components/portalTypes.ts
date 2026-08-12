import { LucideIcon } from 'lucide-react';

export interface PortalNavItem<T extends string = string> {
  id: T;
  label: string;
  mobileLabel?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  contents: string[];
}
