import { LucideIcon } from 'lucide-react';

export interface PortalNavItem<T extends string = string> {
  id: T;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  contents: string[];
}
