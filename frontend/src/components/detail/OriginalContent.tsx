import { Icon } from "../Icon";

export function OriginalContent({ raw }: { raw: string }) {
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold text-slate-900">Original content</h3>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
          <Icon name="chevronDown" className="h-4 w-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words border-t border-slate-100 bg-slate-50 px-4 py-3 font-mono text-xs leading-relaxed text-slate-800">
        {raw}
      </pre>
    </details>
  );
}
