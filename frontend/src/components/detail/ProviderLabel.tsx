export function ProviderLabel({ provider, model }: { provider: string; model: string }) {
  return (
    <span>
      processed by <span className="font-medium text-slate-700">{provider}</span>
      {model ? <span className="font-mono"> / {model}</span> : null}
    </span>
  );
}
