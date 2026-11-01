import { Icon } from "../Icon";
import { Spinner } from "../Spinner";

interface FormFooterProps {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
}

export function FormFooter({ pending, submitLabel, onCancel }: FormFooterProps) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
      <button type="button" className="btn-secondary" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? <Spinner className="h-4 w-4" /> : <Icon name="plus" />}
        {pending ? "Adding…" : submitLabel}
      </button>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-red-700">
      <Icon name="alert" className="mt-0.5 h-4 w-4" />
      <span>{message}</span>
    </p>
  );
}
