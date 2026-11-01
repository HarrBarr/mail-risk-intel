import type { ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon = "inbox", title, children, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "px-4 py-6" : "px-6 py-14"}`}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {children ? <div className="mt-1 max-w-sm text-sm text-slate-600">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
