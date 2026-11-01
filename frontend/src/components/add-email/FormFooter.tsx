import { Icon } from "../Icon";
import { Spinner } from "../Spinner";
import styles from "./AddEmail.module.css";

interface FormFooterProps {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
}

export function FormFooter({ pending, submitLabel, onCancel }: FormFooterProps) {
  return (
    <div className={styles.footer}>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? <Spinner size={16} /> : <Icon name="plus" />}
        {pending ? "Adding…" : submitLabel}
      </button>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={styles.error}>
      <Icon name="alert" />
      <span>{message}</span>
    </p>
  );
}
