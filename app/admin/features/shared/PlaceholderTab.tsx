import { LucideIcon } from 'lucide-react';

interface PlaceholderTabProps {
  title: string;
  icon: LucideIcon;
  description: string;
  contents: string[];
}

export function PlaceholderTab({ title, icon: Icon, description, contents }: PlaceholderTabProps) {
  return (
    <div className="bg-white border border-canvas-grey rounded-lg p-8 shadow-sm">
      <div className="flex items-center gap-3">
        <Icon className="w-6 h-6 text-gakit-maroon" />
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      </div>
      <p className="text-slate-600 mt-3">{description}</p>
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Core contents</h3>
        <ul className="mt-3 space-y-3">
          {contents.map((item) => (
            <li key={item} className="flex gap-3 text-sm text-slate-600">
              <span className="mt-1.5 w-2 h-2 rounded-full bg-gakit-maroon shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
