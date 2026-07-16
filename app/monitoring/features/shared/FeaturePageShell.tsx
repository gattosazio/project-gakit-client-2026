import { ReactNode } from 'react';

interface FeaturePageShellProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}

export function FeaturePageShell({
  eyebrow,
  title,
  description,
  actions,
  toolbar,
  summary,
  children,
}: FeaturePageShellProps) {
  const hasHeader = eyebrow || title || description || actions || toolbar;

  return (
    <div className="space-y-4">
      {hasHeader && (
        <section className="bg-white border border-canvas-grey rounded-lg p-5 shadow-sm">
          {eyebrow && (
            <div className="text-xs font-semibold uppercase tracking-wide text-[#004aad]">
              {eyebrow}
            </div>
          )}
          {(title || description || actions) && (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              {(title || description) && (
                <div>
                  {title && <h2 className="text-2xl font-bold text-slate-900">{title}</h2>}
                  {description && <p className="text-sm text-slate-600 mt-1">{description}</p>}
                </div>
              )}
              {actions && (
                <div className="flex shrink-0 items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
          )}

          {toolbar && (
            <div className={title || description || actions ? 'mt-5 border-t border-canvas-grey pt-5' : ''}>
              {toolbar}
            </div>
          )}
        </section>
      )}

      {summary}

      {children}
    </div>
  );
}
